class DeepgramService {
    constructor() {
        this.connection = null;
        this.isRecording = false;
        this.onTranscriptReceived = null;
        this.audioContext = null;
        this.sourceNode = null;
        this.processorNode = null;
        this.isLocal = true;
        this.audioStream = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        this.lastTranscript = null;
        this.lastTranscriptTime = 0;
        this.isProcessing = false;
        this.isPaused = false; // Add flag to track paused state
        this.transcriptCache = new Map(); // Add cache for deduplication
        this.cacheTimeout = 3000; // Reduced timeout to prevent stale cache entries
        this.similarityThreshold = 0.85; // Adjusted for Levenshtein-based similarity
    }

    async initialize(audioStream, isLocal = true) {
        if (this.isProcessing) {
            console.warn('DeepgramService is already processing audio');
            return;
        }

        this.isLocal = isLocal;
        this.audioStream = audioStream;
        this.isProcessing = true;
        await this.connectToDeepgram();
    }
    
    async connectToDeepgram() {
        try {
            const DEEPGRAM_API_KEY = import.meta.env.VITE_DEEPGRAM_API_KEY;
            if (!DEEPGRAM_API_KEY) {
                throw new Error('Deepgram API key not found');
            }

            if (this.connection) {
                this.connection.close();
            }

            // Create WebSocket connection with proper URL (no token in URL)
            const wsUrl = 'wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=48000&channels=1&smart_format=true&model=nova-2&language=en-US';
            
            // Create connection with proper headers
            this.connection = new WebSocket(wsUrl, [
                'token',
                DEEPGRAM_API_KEY
            ]);
            
            // Handle connection open event
            this.connection.addEventListener('open', () => {
                console.log(`Deepgram connected for ${this.isLocal ? 'local' : 'remote'} stream`);
                this.reconnectAttempts = 0;
                this.startTranscription(this.audioStream);
            });

            this.connection.onmessage = (event) => {
                // console.log('Deepgram message received:', event.data); // Optional: for debugging
                const data = JSON.parse(event.data);
                if (data.channel?.alternatives?.[0]?.transcript) {
                    const currentTime = Date.now();
                    const transcriptText = data.channel.alternatives[0].transcript.trim();
                    if (!transcriptText) return;
                    const confidence = data.channel.alternatives[0].confidence || 0;
                    const isFinal = data.is_final || false;
                    // Use a more robust ID including is_final status
                    const transcriptId = `${transcriptText}-${data.start}-${data.duration}-${confidence}-${isFinal}`;
                    
                    // Clean old cache entries
                    for (const [id, time] of this.transcriptCache.entries()) {
                        if (currentTime - time > this.cacheTimeout) {
                            this.transcriptCache.delete(id);
                        }
                    }
                    
                    // Check if we've recently processed this exact transcript
                    if (this.transcriptCache.has(transcriptId)) {
                        const cachedTime = this.transcriptCache.get(transcriptId);
                        if (currentTime - cachedTime < this.cacheTimeout) {
                            // console.log('Exact duplicate transcript detected (cache hit), skipping:', transcriptText); // Optional: for debugging
                            return;
                        }
                    }
                    
                    // Check for similar transcripts to avoid duplicates with slight differences
                    let isDuplicate = false;
                    for (const [id, time] of this.transcriptCache.entries()) {
                        if (currentTime - time < this.cacheTimeout) {
                            const cachedText = id.split('-')[0]; // Extract text part from ID
                            if (this.isSimilarText(transcriptText, cachedText)) {
                                // console.log('Similar transcript detected, skipping:', transcriptText); // Optional: for debugging
                                isDuplicate = true;
                                break;
                            }
                        }
                    }
                    
                    if (isDuplicate) return;
                    
                    // Add to cache and process
                    this.transcriptCache.set(transcriptId, currentTime);
                    this.lastTranscript = transcriptText;
                    this.lastTranscriptTime = currentTime;
                    
                    const transcript = {
                        text: transcriptText,
                        isLocal: this.isLocal,
                        timestamp: new Date().toLocaleTimeString()
                    };
                    // console.log('Transcript created:', transcript); // Optional: for debugging
                    if (this.onTranscriptReceived) {
                        this.onTranscriptReceived(transcript);
                    } else {
                        document.dispatchEvent(new CustomEvent('transcription', { detail: transcript }));
                    }
                }
            };

            this.connection.onclose = () => {
                console.log(`Deepgram connection closed for ${this.isLocal ? 'local' : 'remote'} stream`);
                if (this.isRecording && this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
                    setTimeout(() => this.connectToDeepgram(), 2000 * this.reconnectAttempts); // Exponential backoff
                }
            };

            this.connection.onerror = (error) => {
                console.error('Deepgram WebSocket error:', error);
            };

        } catch (error) {
            console.error('Deepgram connection error:', error);
            throw error;
        }
    }

    async startTranscription(audioStream) {
        console.log('Starting transcription, audioStream:', audioStream, 'audioContext:', this.audioContext);
        if (!this.connection || this.connection.readyState !== WebSocket.OPEN) {
            console.warn('Deepgram connection not ready, delaying transcription start');
            // Optionally retry connection or wait
            return; 
        }

        if (this.isRecording) {
            console.warn('Transcription is already running');
            return;
        }

        const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
        const maxRetries = 5;
        let attempt = 0;

        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!this.audioContext || this.audioContext.state === 'closed') {
                this.audioContext = new AudioContextClass({ sampleRate: 48000 });
                await this.audioContext.resume();
                console.log('AudioContext created and resumed');
                // Add delay to allow audioContext state to update
                await delay(300);
                console.log('Delay after audioContext resume completed');
            }
            
            if (!audioStream) {
                console.error('No audio stream provided to startTranscription');
                throw new Error('Audio stream is required to start transcription.');
            }
            
            // Ensure AudioWorklet module is loaded
            try {
                await this.audioContext.audioWorklet.addModule('/AudioProcessor.js');
            } catch (moduleError) {
                console.error('Failed to load AudioWorklet module:', moduleError);
                throw new Error('Could not load audio processor.');
            }
            
            // Retry loop for audioContext readiness checking state with validation
            while ((!this.audioContext || typeof this.audioContext.state !== 'string' || (this.audioContext.state !== 'running' && this.audioContext.state !== 'suspended')) && attempt < maxRetries) {
                const state = this.audioContext ? this.audioContext.state : 'null';
                console.warn(`AudioContext not ready or invalid state (state: ${state}), retrying... attempt ${attempt + 1}`);
                console.log('AudioContext object:', this.audioContext);
                await delay(200);
                attempt++;
            }
            
            if (!this.audioContext || typeof this.audioContext.state !== 'string' || (this.audioContext.state !== 'running' && this.audioContext.state !== 'suspended')) {
                const state = this.audioContext ? this.audioContext.state : 'null';
                console.error(`AudioContext is not ready or invalid after retries, state: ${state}`);
                throw new Error('AudioContext is required for createMediaStreamSource.');
            }
            
            this.sourceNode = this.audioContext.createMediaStreamSource(audioStream);
            this.processorNode = new AudioWorkletNode(this.audioContext, 'audio-processor');

            this.processorNode.port.onmessage = (e) => {
                if (this.connection?.readyState === WebSocket.OPEN && !this.isPaused) {
                    this.connection.send(e.data);
                }
            };

            this.sourceNode.connect(this.processorNode);
            this.processorNode.connect(this.audioContext.destination); // Connect to destination to potentially allow monitoring/muting
            this.isRecording = true;
            this.isPaused = false; // Ensure not paused on start
            console.log(`Transcription started for ${this.isLocal ? 'local' : 'remote'} stream`);
            
        } catch (error) {
            console.error('Transcription start failed:', error);
            this.stopTranscription(); // Clean up on failure
            throw error;
        }
    }

    // Helper method to check text similarity to avoid duplicates with minor differences
    isSimilarText(text1, text2) {
        const lowerText1 = text1.toLowerCase().trim();
        const lowerText2 = text2.toLowerCase().trim();

        // Exact match check
        if (lowerText1 === lowerText2) return true;

        // Cross-instance duplicate check
        if (DeepgramService.globalTranscriptCache.has(lowerText1)) return true;

        // Calculate normalized similarity score
        const similarityScore = this.calculateSimilarity(lowerText1, lowerText2);
        return similarityScore >= this.similarityThreshold;
    }

    calculateSimilarity(str1, str2) {
        // Implement Levenshtein distance for better similarity measurement
        const len1 = str1.length;
        const len2 = str2.length;
        
        if (Math.abs(len1 - len2) > Math.max(len1, len2) * 0.2) {
            return false;
        }
        
        const matrix = [];
        for (let i = 0; i <= len1; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= len2; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                const cost = str1[i-1] === str2[j-1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i-1][j] + 1,
                    matrix[i][j-1] + 1,
                    matrix[i-1][j-1] + cost
                );
            }
        }
        
        const distance = matrix[len1][len2];
        const maxLength = Math.max(len1, len2);
        return 1 - distance / maxLength >= this.similarityThreshold;
    }
    
    stopTranscription() {
        console.log(`Stopping transcription for ${this.isLocal ? 'local' : 'remote'} stream`);
        if (this.isRecording || this.isProcessing) {
            this.isRecording = false;
            this.isProcessing = false;
            this.isPaused = false;
            
            if (this.processorNode) {
                try {
                    this.processorNode.disconnect();
                    this.sourceNode?.disconnect(); // Disconnect source if it exists
                } catch (e) {
                    console.log('Error disconnecting audio nodes:', e);
                }
                this.processorNode = null;
                this.sourceNode = null;
            }
            
            if (this.audioContext && this.audioContext.state !== 'closed') {
                this.audioContext.close().catch(e => console.error('Error closing AudioContext:', e));
                this.audioContext = null;
                console.log('Audio context closed');
            }
            
            if (this.connection) {
                if (this.connection.readyState === WebSocket.OPEN || this.connection.readyState === WebSocket.CONNECTING) {
                    this.connection.close();
                    console.log('WebSocket connection closed');
                }
                this.connection = null;
            }

            this.lastTranscript = null;
            this.lastTranscriptTime = 0;
            this.transcriptCache.clear(); // Clear the cache when stopping
            console.log(`Transcription stopped for ${this.isLocal ? 'local' : 'remote'} stream`);
            DeepgramService.globalTranscriptCache.delete(this.lastTranscript);
            
            // Clear any other resources
            this.audioStream = null;
            this.onTranscriptReceived = null;
        }
    }
    
    pauseTranscription() {
        if (this.isRecording && !this.isPaused && this.processorNode && this.sourceNode) {
            try {
                // Disconnect the processor node to pause audio processing
                this.sourceNode.disconnect(this.processorNode);
                this.isPaused = true;
                console.log(`Transcription paused for ${this.isLocal ? 'local' : 'remote'} stream`);
            } catch (error) {
                console.error('Error pausing transcription:', error);
            }
        }
    }
    
    resumeTranscription() {
        if (this.isRecording && this.isPaused && this.sourceNode && this.processorNode) {
            try {
                // Reconnect the processor node to resume audio processing
                this.sourceNode.connect(this.processorNode);
                this.isPaused = false;
                console.log(`Transcription resumed for ${this.isLocal ? 'local' : 'remote'} stream`);
            } catch (error) {
                console.error('Error resuming transcription:', error);
            }
        }
    }

    setOnTranscriptReceived(callback) {
        this.onTranscriptReceived = callback;
    }
}

export default DeepgramService;

// Static property for cross-instance tracking
DeepgramService.globalTranscriptCache = new Set();