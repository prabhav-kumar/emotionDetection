import io from 'socket.io-client';

// Singleton instance
let instance = null;

class WebRTCService {
    constructor() {
        // Return existing instance if available
        if (instance) {
            return instance;
        }
        
        this.socket = null;
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.isInitiator = false;
        this.roomId = null;
        this.localTranscriptionService = null;
        this.remoteTranscriptionService = null;
        this.onTranscriptReceived = null;
        this.pendingIceCandidates = [];
        this.callStarted = false;
        this.onCallStarted = null;
        this.processedTranscripts = new Set();
        this.isTranscribing = false;
        this.callStartTime = null;
        this._audioEnabled = true;
        this._videoEnabled = true;
        this._initialized = false;
        this._lastKnownAudioState = true;
        this._lastKnownVideoState = true;
        
        // Set this instance as the singleton
        instance = this;

        // WebRTC configuration
        this.configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' },
                { 
                    urls: 'turn:numb.viagenie.ca',
                    username: 'webrtc@live.com',
                    credential: 'muazkh'
                },
                {
                    urls: 'turn:turn.anyfirewall.com:443?transport=tcp',
                    username: 'webrtc',
                    credential: 'webrtc'
                }
            ],
            iceCandidatePoolSize: 10,
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require'
        };
        
        // Supported browsers and versions
        this.supportedBrowsers = {
            chrome: 55,
            firefox: 44,
            safari: 11,
            edge: 79,
            opera: 42
        };
    }

    /**
     * Checks if the current browser is compatible with WebRTC
     * @returns {boolean} True if compatible, throws error if not
     */
    checkBrowserCompatibility() {
        const browserInfo = this.getBrowserInfo();
        const { name, version } = browserInfo;
        
        // Check if browser is supported
        if (!name || !this.supportedBrowsers[name.toLowerCase()]) {
            const errorMsg = `Your browser (${name || 'Unknown'}) doesn't support WebRTC. Please use Chrome, Firefox, Safari, or Edge.`;
            console.error(errorMsg);
            throw new Error(errorMsg);
        }
        
        // Check if browser version is supported
        if (version && parseInt(version) < this.supportedBrowsers[name.toLowerCase()]) {
            const minVersion = this.supportedBrowsers[name.toLowerCase()];
            const errorMsg = `Your browser version (${name} ${version}) is too old for WebRTC. Please update to ${name} ${minVersion}+ or use another modern browser.`;
            console.error(errorMsg);
            throw new Error(errorMsg);
        }
        
        // Check for adapter.js or provide fallbacks for older browsers
        if (!window.RTCPeerConnection) {
            const errorMsg = 'WebRTC is not supported in this browser. Please use a modern browser.';
            console.error(errorMsg);
            throw new Error(errorMsg);
        }
        
        return true;
    }
    
    /**
     * Gets browser name and version
     * @returns {Object} Browser name and version
     */
    getBrowserInfo() {
        const ua = navigator.userAgent;
        let name = "Unknown";
        let version = "";
        
        // Extract browser name and version
        if (ua.indexOf("Chrome") > -1) {
            name = "Chrome";
            version = ua.match(/Chrome\/(\d+)/)[1];
        } else if (ua.indexOf("Firefox") > -1) {
            name = "Firefox";
            version = ua.match(/Firefox\/(\d+)/)[1];
        } else if (ua.indexOf("Safari") > -1 && ua.indexOf("Chrome") === -1) {
            name = "Safari";
            version = ua.match(/Version\/(\d+)/)[1];
        } else if (ua.indexOf("Edge") > -1 || ua.indexOf("Edg") > -1) {
            name = "Edge";
            const match = ua.match(/Edge\/(\d+)/) || ua.match(/Edg\/(\d+)/);
            version = match ? match[1] : "";
        } else if (ua.indexOf("Opera") > -1 || ua.indexOf("OPR") > -1) {
            name = "Opera";
            const match = ua.match(/Opera\/(\d+)/) || ua.match(/OPR\/(\d+)/);
            version = match ? match[1] : "";
        }
        
        return { name, version };
    }
    
    async initialize(roomId, isInitiator = false, onCallStarted = null) {
        try {
            // Prevent multiple initializations with lock mechanism
            if (this._initializing) {
                console.log('WebRTC initialization already in progress');
                return this.localStream; // Return existing stream if initialization is in progress
            }
            
            this._initializing = true;
            
            // Check if already initialized with valid stream and same room
            if (this._initialized && this.localStream && this.localStream.active && this.roomId === roomId) {
                console.log('WebRTC service already initialized with active stream for this room');
                this._initializing = false;
                return this.localStream;
            }

            // If initialized but different room or invalid stream, cleanup first
            if (this._initialized || this.localStream) {
                console.log('Cleaning up existing resources before reinitializing');
                await this.cleanup();
                // Ensure all tracks are stopped and streams are nullified
                if (this.localStream) {
                    this.localStream.getTracks().forEach(track => track.stop());
                    this.localStream = null;
                }
                if (this.remoteStream) {
                    this.remoteStream.getTracks().forEach(track => track.stop());
                    this.remoteStream = null;
                }
            }
            
            this._initialized = false; // Reset initialization flag after cleanup
            
            this.onCallStarted = onCallStarted;
            const { default: DeepgramService } = await import('./DeepgramService');
            this.roomId = roomId;
            this.isInitiator = isInitiator;
            this.callStartTime = null;
            // Initialize core state
            this.processedTranscripts = new Set();

            // Connect to signaling server
            if (!this.socket) {
                this.socket = io(window.location.origin, {
                    reconnection: true,
                    reconnectionAttempts: 5,
                    reconnectionDelay: 1000,
                    timeout: 10000
                });
                this.setupSocketListeners();
            }
        
            // Join the room
            this.socket.emit('join', { room: this.roomId, isTherapist: this.isInitiator });
            console.log(`Joining room: ${this.roomId} as ${isInitiator ? 'initiator' : 'participant'}`);
        
            // Get local media stream
            this.checkBrowserCompatibility();
            if (!navigator.mediaDevices) {
                console.error('mediaDevices API not supported in this browser.');
                const browserInfo = this.getBrowserInfo();
                throw new Error(`Media devices API not supported in ${browserInfo.name} ${browserInfo.version}. Please use a modern browser like Chrome (55+), Firefox (44+), Safari (11+), or Edge (79+).`);
            }
        
            // Create new localStream
            let devices = [];
            try {
                devices = await navigator.mediaDevices.enumerateDevices();
            } catch (enumError) {
                console.error('Failed to enumerate devices:', enumError);
                throw new Error('Cannot access media devices. Please check your camera and microphone permissions.');
            }
            
            const hasVideo = devices.some(device => device.kind === 'videoinput');
            const hasAudio = devices.some(device => device.kind === 'audioinput');
            if (!hasVideo && !hasAudio) {
                console.error('No video or audio input devices detected');
                throw new Error('No camera or microphone found. Please check your device connections and browser permissions.');
            }
            
            // Get media stream with current enabled states
            const constraints = {
                video: hasVideo ? {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                } : false,
                audio: hasAudio ? {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                } : false
            };

            try {
                // Check if we already have an active stream before creating a new one
                if (this.localStream && this.localStream.active) {
                    console.log('Reusing existing active local stream');
                } else {
                    // Stop any existing tracks before creating a new stream
                    if (this.localStream) {
                        this.localStream.getTracks().forEach(track => track.stop());
                        this.localStream = null;
                    }
                    
                    console.log('Creating new media stream with constraints:', constraints);
                    this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
                }
                
                // Set initial track states based on stored preferences
                if (this.localStream) {
                    const videoTrack = this.localStream.getVideoTracks()[0];
                    const audioTrack = this.localStream.getAudioTracks()[0];
                    
                    if (videoTrack) {
                        videoTrack.enabled = this._videoEnabled;
                        this._lastKnownVideoState = this._videoEnabled;
                    }
                    if (audioTrack) {
                        audioTrack.enabled = this._audioEnabled;
                        this._lastKnownAudioState = this._audioEnabled;
                    }
                }
                console.log('Local stream obtained:', this.localStream);
            } catch (error) {
                console.error('Error accessing media devices:', error);
                throw error;
            }

            // Initialize transcription service
            if (this.localStream) {
                this.isTranscribing = true;
                // Always clean up any existing transcription service first
                if (this.localTranscriptionService) {
                    await this.localTranscriptionService.stopTranscription();
                    this.localTranscriptionService = null;
                }
                
                // Create new transcription service only if it doesn't exist
                this.localTranscriptionService = new DeepgramService();
                await this.localTranscriptionService.initialize(this.localStream, true);
                
                // Reset processed transcripts set to avoid duplicates from previous sessions
                this.processedTranscripts = new Set();
                
                this.localTranscriptionService.setOnTranscriptReceived((transcript) => {
                    if (transcript.text.trim()) {
                        const event = new CustomEvent('transcription', { 
                            detail: { 
                                text: transcript.text,
                                isLocal: true,
                                timestamp: new Date().toLocaleTimeString()
                            }
                        });
                        document.dispatchEvent(event);
                        // Deduplicate transcripts before processing
                        const transcriptKey = `${transcript.text}-${transcript.isLocal}`;
                        if (!this.processedTranscripts.has(transcriptKey)) {
                            this.processedTranscripts.add(transcriptKey);
                            if (this.onTranscriptReceived) {
                                this.onTranscriptReceived(transcript);
                            }
                        }
                    }
                });
            }
        
            // Add event listener for device changes only once
            if (!this._deviceChangeListenerAdded) {
                navigator.mediaDevices.addEventListener('devicechange', async () => {
                    console.log('Media devices changed, updating available devices');
                    try {
                        const updatedDevices = await navigator.mediaDevices.enumerateDevices();
                        console.log('Updated devices:', updatedDevices);
                    } catch (error) {
                        console.error('Error enumerating devices after change:', error);
                    }
                });
                this._deviceChangeListenerAdded = true;
            }
        
            // Verify stream tracks are active
            const videoTrack = this.localStream.getVideoTracks()[0];
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (videoTrack) {
                console.log('Video track active:', videoTrack.enabled);
                videoTrack.onended = () => {
                    console.log('Video track ended');
                    if (this.onMediaError) {
                        this.onMediaError('Video device disconnected');
                    }
                };
            }
            if (audioTrack) {
                console.log('Audio track active:', audioTrack.enabled);
                audioTrack.onended = () => {
                    console.log('Audio track ended');
                    if (this.onMediaError) {
                        this.onMediaError('Audio device disconnected');
                    }
                };
            }
            // Set initial track states and mark as initialized
            await Promise.all([
                this.setAudioEnabled(this._audioEnabled),
                this.setVideoEnabled(this._videoEnabled)
            ]);
            
            this._initialized = true;
            return this.localStream;
        } catch (error) {
            console.error('Error accessing media devices:', error);
            this.isTranscribing = false;
            this._initialized = false;
            throw error;
        }
    }

    setupSocketListeners() {
        this.socket.on('joined', async ({ room, numClients, callStarted, clientId }) => {
            console.log(`Successfully joined room ${room} with ${numClients} clients. Call started: ${callStarted}`);
            console.log(`My socket ID: ${clientId}`);
            this.socketId = clientId; // Store my socket ID for better identification
            this.callStarted = callStarted;

            if (!this.isInitiator && !this.callStarted) {
                throw new Error('Therapist hasn\'t started the call yet. Please wait.');
            }

            if (this.isInitiator) {
                this.callStarted = true;
                this.callStartTime = Date.now();
                this.socket.emit('start-call', { room: this.roomId, startTime: this.callStartTime });
                if (this.onCallStarted) this.onCallStarted(this.callStartTime);
            }
            
            // Ensure local stream is initialized before creating peer connection
            if (!this.localStream) {
                console.log('Waiting for local stream initialization...');
                return;
            }
            
            try {
                await this.createPeerConnection(); // Create peer connection only after local stream is ready
                
                // Only initiator creates an offer when they detect another peer
                if (numClients === 2 && this.isInitiator) {
                    console.log('Creating and sending offer as initiator');
                    // Add a small delay to ensure both peers are ready
                    setTimeout(async () => {
                        try {
                            // Ensure peer connection is in stable state before creating offer
                            if (this.peerConnection.signalingState === 'stable') {
                                await this.createOffer();
                            } else {
                                console.log('Waiting for signaling state to stabilize...');
                                await new Promise(resolve => {
                                    const checkState = () => {
                                        if (this.peerConnection.signalingState === 'stable') {
                                            resolve();
                                        } else {
                                            setTimeout(checkState, 100);
                                        }
                                    };
                                    checkState();
                                });
                                await this.createOffer();
                            }
                        } catch (error) {
                            console.error('Error creating offer:', error);
                            // Attempt to recreate peer connection and retry offer
                            await this.createPeerConnection();
                            await this.createOffer();
                        }
                    }, 3000); // Increased delay to ensure non-initiator has time to set up
                }
            } catch (error) {
                console.error('Error setting up peer connection:', error);
            }
        });

        this.socket.on('call-started', (data) => {
            console.log('Call started event received');
            this.callStarted = true;
            this.callStartTime = data.startTime || Date.now();
            if (this.onCallStarted) {
                this.onCallStarted(this.callStartTime);
            }
        });
        
        // Handle user connection with role information
        this.socket.on('user-connected', ({ userId, role, displayName }) => {
            console.log(`User connected: ${userId} as ${role} (${displayName || 'Unknown'})`);
            
            // Store connected user information
            if (!this.connectedUsers) {
                this.connectedUsers = new Map();
            }
            
            this.connectedUsers.set(userId, { role, displayName, connected: true });
            
            // Emit custom event for UI components to react
            const event = new CustomEvent('user-connected', { 
                detail: { userId, role, displayName }
            });
            document.dispatchEvent(event);
            
            // If we're the initiator and this is a patient connecting, we might want to start the call
            if (this.isInitiator && role === 'patient' && !this.callStarted) {
                console.log('Patient connected, initiator starting call');
                this.callStarted = true;
                this.callStartTime = Date.now();
                this.socket.emit('start-call', { room: this.roomId, startTime: this.callStartTime });
                if (this.onCallStarted) this.onCallStarted(this.callStartTime);
            }
            
            // Attempt to establish peer connection if not already done
            if (this.peerConnection && this.peerConnection.connectionState !== 'connected') {
                console.log('User connected, attempting to establish/improve connection');
                this.peerConnection.restartIce();
            }
        });

        // Handle reconnection attempts
        let reconnectionAttempts = 0;
        const maxReconnectionAttempts = 3;
        const reconnectionDelay = 2000; // 2 seconds

        const attemptReconnection = async () => {
            if (reconnectionAttempts >= maxReconnectionAttempts) {
                console.log('Max reconnection attempts reached');
                this.handleDisconnection();
                return;
            }
            reconnectionAttempts++;
            console.log(`Attempting reconnection (${reconnectionAttempts}/${maxReconnectionAttempts})`);
            
            try {
                await this.createPeerConnection();
                if (this.isInitiator) {
                    await this.createOffer();
                }
            } catch (error) {
                console.error('Reconnection attempt failed:', error);
                setTimeout(attemptReconnection, reconnectionDelay);
            }
        };

        this.socket.on('offer', async (description) => {
            if (!this.isInitiator) {
                try {
                    console.log('Received offer from initiator, preparing to answer');
                    if (!this.peerConnection) {
                        console.log('Creating peer connection for non-initiator');
                        await this.createPeerConnection();
                    }
                    
                    // Check if we can set remote description
                    if (this.peerConnection.signalingState !== 'stable') {
                        console.log('Resetting peer connection state...');
                        await Promise.all([
                            this.peerConnection.setLocalDescription({type: 'rollback'}),
                            this.peerConnection.setRemoteDescription(new RTCSessionDescription(description))
                        ]);
                    } else {
                        console.log('Setting remote description from offer');
                        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(description));
                    }
                    
                    // Process any pending ICE candidates
                    if (this.pendingIceCandidates.length > 0) {
                        console.log(`Processing ${this.pendingIceCandidates.length} pending ICE candidates`);
                        const candidatePromises = this.pendingIceCandidates.map(candidate => 
                            this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
                                .catch(err => console.error('Error adding pending ICE candidate:', err))
                        );
                        await Promise.all(candidatePromises);
                        this.pendingIceCandidates = [];
                    }
                    
                    console.log('Creating answer');
                    const answer = await this.peerConnection.createAnswer();
                    console.log('Setting local description');
                    await this.peerConnection.setLocalDescription(answer);
                    console.log('Sending answer');
                    this.socket.emit('answer', { room: this.roomId, answer });
                } catch (error) {
                    console.error('Error handling offer:', error);
                    await attemptReconnection();
                }
            }
        });

        this.socket.on('answer', async (description) => {
            if (this.isInitiator && this.peerConnection) {
                try {
                    console.log('Setting remote description from answer');
                    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(description));
                    console.log('Answer processed successfully');
                    
                    // Process any pending ICE candidates
                    if (this.pendingIceCandidates.length > 0) {
                        console.log(`Processing ${this.pendingIceCandidates.length} pending ICE candidates`);
                        for (const candidate of this.pendingIceCandidates) {
                            try {
                                await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                            } catch (err) {
                                console.error('Error adding pending ICE candidate:', err);
                            }
                        }
                        this.pendingIceCandidates = [];
                    }
                } catch (error) {
                    console.error('Error handling answer:', error);
                    await attemptReconnection();
                }
            }
        });

        // Store ice candidates if received before remote description is set
        this.pendingIceCandidates = [];
        
        this.socket.on('ice-candidate', async (candidate) => {
            try {
                if (this.peerConnection && this.peerConnection.remoteDescription) {
                    console.log('Adding ICE candidate:', candidate);
                    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                } else {
                    console.log('Storing ICE candidate for later processing');
                    this.pendingIceCandidates.push(candidate);
                }
            } catch (error) {
                console.error('Error adding ICE candidate:', error);
            }
        });

        this.socket.on('user-disconnected', ({ userId, role }) => {
            console.log(`User disconnected: ${userId} as ${role}`);
            
            // Update connected users map
            if (this.connectedUsers && this.connectedUsers.has(userId)) {
                const userInfo = this.connectedUsers.get(userId);
                userInfo.connected = false;
                this.connectedUsers.set(userId, userInfo);
                
                // Emit custom event for UI components to react
                const event = new CustomEvent('user-disconnected', { 
                    detail: { userId, role, displayName: userInfo.displayName }
                });
                document.dispatchEvent(event);
            }
            
            // Handle disconnection with improved logging
            this.handleDisconnection(userId, role);
        });

        // Handle transcription events
        this.socket.on('transcription', (data) => {
            if (!data || !data.text || !data.timestamp) return;
            
            // Create a unique key for the transcript
            const transcriptKey = `${data.text}-${data.timestamp}-${data.isLocal}`;
            
            // Only process if we haven't seen this transcript before
            if (!this.processedTranscripts.has(transcriptKey)) {
                this.processedTranscripts.add(transcriptKey);
                console.log('Received remote transcription:', data);
                
                // Initialize remote transcription service if needed
                if (!this.remoteTranscriptionService && this.remoteStream) {
                    console.log('Initializing remote transcription service');
                    this.initializeRemoteTranscription(this.remoteStream);
                }
                
                // Dispatch the transcription event
                const event = new CustomEvent('transcription', {
                    detail: {
                        text: data.text,
                        isLocal: data.isLocal,
                        timestamp: data.timestamp
                    }
                });
                document.dispatchEvent(event);
            }
        });
        
        // Handle media state changes from remote peer
        this.socket.on('media-state-change', (data) => {
            console.log('Remote peer media state change:', data);
            if (data && data.type) {
                // Update UI or take appropriate action based on remote peer's media state
                const event = new CustomEvent('remote-media-change', {
                    detail: {
                        type: data.type,
                        enabled: data.enabled
                    }
                });
                document.dispatchEvent(event);
            }
        });
    }

    /**
     * Toggle microphone on/off
     */
    get audioEnabled() {
        return this._audioEnabled;
    }

    set audioEnabled(value) {
        this._audioEnabled = value;
        if (this.localStream) {
            const audioTracks = this.localStream.getAudioTracks();
            audioTracks.forEach(track => track.enabled = value);
        }
    }

    get videoEnabled() {
        return this._videoEnabled;
    }

    set videoEnabled(value) {
        this._videoEnabled = value;
        if (this.localStream) {
            const videoTracks = this.localStream.getVideoTracks();
            videoTracks.forEach(track => track.enabled = value);
        }
    }

    async toggleAudio(forcedState = null) {
        if (!this.localStream || !this._initialized) {
            console.warn('Cannot toggle audio: stream not initialized');
            return false;
        }

        const audioTracks = this.localStream.getAudioTracks();
        if (audioTracks.length === 0) {
            console.warn('No audio tracks available');
            return false;
        }

        try {
            const currentState = audioTracks[0].enabled;
            const newState = forcedState !== null ? forcedState : !currentState;
            
            console.log(`Toggling audio from ${currentState} to ${newState}`);
            
            // Update all audio tracks
            for (const track of audioTracks) {
                track.enabled = newState;
                console.log(`Audio track ${track.id} ${newState ? 'enabled' : 'disabled'}`);
            }
            
            this._audioEnabled = newState;
            this._lastKnownAudioState = newState;

            // Handle transcription service - ensure this happens synchronously
            if (this.localTranscriptionService) {
                console.log(`${newState ? 'Resuming' : 'Pausing'} local transcription due to audio ${newState ? 'enable' : 'mute'}`);
                try {
                    if (newState) {
                        await this.localTranscriptionService.resumeTranscription();
                    } else {
                        await this.localTranscriptionService.pauseTranscription();
                    }
                } catch (transcriptionError) {
                    console.error('Error updating transcription state:', transcriptionError);
                    // Continue with the toggle even if transcription update fails
                }
            }
            
            // Notify remote peer if socket is connected
            if (this.socket && this.socket.connected && this.roomId) {
                console.log(`Notifying peer about audio state change: ${newState}`);
                this.socket.emit('media-state-change', {
                    room: this.roomId,
                    type: 'audio',
                    enabled: newState
                });
            }
            
            console.log(`Audio ${newState ? 'enabled' : 'disabled'}`);
            return newState;
        } catch (error) {
            console.error('Error toggling audio:', error);
            return false;
        }
    }

    /**
     * Toggle video on/off
     */
    async toggleVideo(forcedState = null) {
        if (!this.localStream || !this._initialized) {
            console.warn('Cannot toggle video: stream not initialized');
            return false;
        }

        const videoTracks = this.localStream.getVideoTracks();
        if (videoTracks.length === 0) {
            console.warn('No video tracks available');
            return false;
        }

        try {
            const currentState = videoTracks[0].enabled;
            const newState = forcedState !== null ? forcedState : !currentState;
            
            console.log(`Toggling video from ${currentState} to ${newState}`);
            
            // Update all video tracks
            for (const track of videoTracks) {
                try {
                    track.enabled = newState;
                    console.log(`Video track ${track.id} ${newState ? 'enabled' : 'disabled'}`);
                } catch (trackError) {
                    console.error(`Error toggling video track ${track.id}:`, trackError);
                }
            }
            
            this._videoEnabled = newState;
            this._lastKnownVideoState = newState;

            // Notify remote peer if socket is connected
            if (this.socket && this.socket.connected && this.roomId) {
                console.log(`Notifying peer about video state change: ${newState}`);
                this.socket.emit('media-state-change', {
                    room: this.roomId,
                    type: 'video',
                    enabled: newState
                });
            }
            
            console.log(`Video ${newState ? 'enabled' : 'disabled'}`);
            return newState;
        } catch (error) {
            console.error('Error toggling video:', error);
            return false;
        }
    }

    async createPeerConnection() {
        try {
            if (this.peerConnection) {
                console.log('Cleaning up existing peer connection');
                this.peerConnection.close();
                // Clear remote stream when connection is closed
                if (this.remoteStream) {
                    this.remoteStream.getTracks().forEach(track => track.stop());
                    this.remoteStream = null;
                }
            }

            console.log('Creating new RTCPeerConnection with config:', this.configuration);
            this.peerConnection = new RTCPeerConnection(this.configuration);
            
            // Enhanced ICE candidate handling
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    console.log('Generated ICE candidate for:', event.candidate.sdpMid);
                    this.socket.emit('ice-candidate', { 
                        room: this.roomId, 
                        candidate: event.candidate 
                    });
                }
            };

            // Monitor ICE connection state
            this.peerConnection.oniceconnectionstatechange = () => {
                console.log('ICE Connection State:', this.peerConnection.iceConnectionState);
                if (this.peerConnection.iceConnectionState === 'failed') {
                    console.log('ICE Connection failed, attempting to restart');
                    this.peerConnection.restartIce();
                } else if (this.peerConnection.iceConnectionState === 'disconnected') {
                    console.log('ICE Connection disconnected, waiting for recovery...');
                    setTimeout(() => {
                        if (this.peerConnection.iceConnectionState === 'disconnected') {
                            this.handleDisconnection();
                        }
                    }, 5000);
                }
            };

            // Monitor connection state
            this.peerConnection.onconnectionstatechange = () => {
                console.log('Connection State:', this.peerConnection.connectionState);
                if (this.peerConnection.connectionState === 'failed') {
                    console.log('Connection failed, initiating cleanup');
                    this.handleDisconnection();
                }
            };

            // Enhanced track handling with proper stream management
            this.peerConnection.ontrack = async (event) => {
                console.log('ontrack event received:', event);
                console.log('Received track kind:', event.track.kind);
                console.log('Received track enabled:', event.track.enabled);
                console.log('Received track readyState:', event.track.readyState);
                console.log('Received track stream ID:', event.streams[0]?.id);
                
                // Always create a new MediaStream if it doesn't exist
                if (!this.remoteStream) {
                    this.remoteStream = new MediaStream();
                    console.log('Created new remote MediaStream');
                }

                // Always add the track to ensure we have the latest version
                const existingTrack = this.remoteStream.getTracks().find(t => t.kind === event.track.kind);
                if (existingTrack) {
                    this.remoteStream.removeTrack(existingTrack);
                }
                this.remoteStream.addTrack(event.track);
                const streamUpdateEvent = new CustomEvent('remote-stream-update', { detail: this.remoteStream });
                document.dispatchEvent(streamUpdateEvent);
                console.log(`Added ${event.track.kind} track to remote stream`);

                // Notify any registered stream handlers
                if (this.onRemoteStream) {
                    this.onRemoteStream(this.remoteStream);
                }

                try {
                    const track = event.track;
                    const trackKind = track.kind;

                    // We no longer directly manipulate the video element here
                    // The VideoCallInterface component will handle this through the remoteStream state
                    // and the onRemoteStream callback

                    // Set up track monitoring
                    track.onended = () => {
                        console.log(`Remote ${trackKind} track ended`);
                        if (this.remoteStream.getTracks().length === 0) {
                            this.handleDisconnection();
                        } else {
                            // If only one track remains, check its kind and update state accordingly
                            const remainingTrack = this.remoteStream.getTracks()[0];
                            if (remainingTrack.kind === 'audio') {
                                document.dispatchEvent(new CustomEvent('remote-media-change', { detail: { type: 'video', enabled: false } }));
                            } else if (remainingTrack.kind === 'video') {
                                document.dispatchEvent(new CustomEvent('remote-media-change', { detail: { type: 'audio', enabled: false } }));
                            }
                        }
                    };

                    track.onmute = () => {
                        console.log(`Remote ${trackKind} track muted`);
                         document.dispatchEvent(new CustomEvent('remote-media-change', { detail: { type: trackKind, enabled: false } }));
                    };
                    track.onunmute = () => {
                        console.log(`Remote ${trackKind} track unmuted`);
                        document.dispatchEvent(new CustomEvent('remote-media-change', { detail: { type: trackKind, enabled: true } }));
                    };

                    // Initialize transcription for audio tracks only once
                    if (trackKind === 'audio') {
                        console.log('Initializing remote transcription');
                        await this.initializeRemoteTranscription(this.remoteStream);
                    }

                    // Notify stream handlers
                    if (this.onRemoteStream) {
                        this.onRemoteStream(this.remoteStream);
                    }
                } catch (error) {
                    console.error('Error handling remote track:', error);
                }
            };

            // Add local tracks with enhanced error handling
            if (this.localStream) {
                const tracks = this.localStream.getTracks();
                console.log(`Adding ${tracks.length} local tracks`);
                
                for (const track of tracks) {
                    try {
                        const sender = this.peerConnection.addTrack(track, this.localStream);
                        console.log(`Added local ${track.kind} track`);
                        
                        if (track.kind === 'audio') {
                            this.audioSender = sender;
                        } else if (track.kind === 'video') {
                            this.videoSender = sender;
                        }
                    } catch (error) {
                        console.error(`Error adding ${track.kind} track:`, error);
                    }
                }
            } else {
                console.warn('No local stream available for peer connection');
            }

            return this.peerConnection;
        } catch (error) {
            console.error('Error creating peer connection:', error);
            throw error;
        }
    }

    async createOffer() {
        try {
            if (!this.peerConnection) {
                console.error('Cannot create offer: peer connection is null');
                await this.createPeerConnection();
            }
            
            console.log('Creating offer...');
            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true,
                iceRestart: true // Force ICE restart to get fresh candidates
            });
            
            console.log('Setting local description...');
            await this.peerConnection.setLocalDescription(offer);
            
            // Wait for ICE gathering to complete or timeout after 5 seconds
            await new Promise((resolve) => {
                const checkState = () => {
                    if (this.peerConnection.iceGatheringState === 'complete') {
                        console.log('ICE gathering completed');
                        resolve();
                    }
                };
                
                const iceGatheringTimeout = setTimeout(() => {
                    console.log('ICE gathering timed out, proceeding anyway');
                    resolve();
                }, 5000);
                
                this.peerConnection.addEventListener('icegatheringstatechange', () => {
                    checkState();
                    if (this.peerConnection.iceGatheringState === 'complete') {
                        clearTimeout(iceGatheringTimeout);
                    }
                });
                
                checkState(); // Check immediately in case it's already complete
            });
            
            console.log('Sending offer to remote peer...');
            this.socket.emit('offer', { room: this.roomId, offer: this.peerConnection.localDescription });
        } catch (error) {
            console.error('Error creating offer:', error);
            await this.handleDisconnection();
            throw error;
        }
    }

    handleDisconnection(userId = null, role = null) {
        console.log(`Handling disconnection${userId ? ` for ${role} (${userId})` : ''}`);
        console.log('Handling disconnection...');
        if (this.peerConnection) {
            // Close all tracks
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => track.stop());
            }
            if (this.remoteStream) {
                this.remoteStream.getTracks().forEach(track => track.stop());
            }
            
            // Close peer connection
            this.peerConnection.close();
            this.peerConnection = null;
        }

        // Reset connection state
        this.remoteStream = null;
        this.pendingIceCandidates = [];
        this.audioSender = null;
        this.videoSender = null;
        
        if (this.onDisconnected) {
            this.onDisconnected();
        }
        
        // Attempt to reconnect if we're still in the room
        if (this.roomId && this.socket && this.socket.connected) {
            console.log('Attempting to reconnect...');
            // Keep the local stream if it exists for reconnection
            setTimeout(() => {
                this.socket.emit('join', { room: this.roomId });
            }, 1000); // Small delay to ensure socket is ready
        }
    }


    cleanup() {
        console.log('Cleaning up WebRTC service');
        
        // Clean up transcription services first
        if (this.localTranscriptionService) {
            console.log('Stopping local transcription service');
            this.localTranscriptionService.stopTranscription();
            this.localTranscriptionService = null;
        }
        
        if (this.remoteTranscriptionService) {
            console.log('Stopping remote transcription service');
            this.remoteTranscriptionService.stopTranscription();
            this.remoteTranscriptionService = null;
        }

        // Clean up media tracks with proper state management
        if (this.localStream) {
            console.log('Stopping local stream tracks');
            const tracks = this.localStream.getTracks();
            tracks.forEach(track => {
                track.enabled = false; // Disable before stopping
                track.stop();
                this.localStream.removeTrack(track);
            });
            this.localStream = null;
        }
        
        if (this.remoteStream) {
            console.log('Stopping remote stream tracks');
            const tracks = this.remoteStream.getTracks();
            tracks.forEach(track => {
                track.enabled = false; // Disable before stopping
                track.stop();
                this.remoteStream.removeTrack(track);
            });
            this.remoteStream = null;
        }
        
        // Clean up peer connection
        if (this.peerConnection) {
            console.log('Closing peer connection');
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        // Clean up socket connection
        if (this.socket) {
            console.log('Closing socket connection');
            this.socket.close();
            this.socket = null;
        }
        
        // Reset all state variables
        this._initialized = false;
        this.isTranscribing = false;
        this._audioEnabled = true;
        this._videoEnabled = true;
        this._lastKnownAudioState = true;
        this._lastKnownVideoState = true;
        this.audioSender = null;
        this.videoSender = null;
        this.processedTranscripts.clear();
        this.pendingIceCandidates = [];
    }

    setOnRemoteStream(callback) {
        this.onRemoteStream = (stream) => {
            // Add detailed logging for remote stream
            if (stream) {
                console.group('Remote Stream Details');
                console.log('Stream active:', stream.active);
                stream.getTracks().forEach(track => {
                    console.log(`Track ${track.id} (${track.kind}):`,
                        `enabled: ${track.enabled},`,
                        `readyState: ${track.readyState},`,
                        `muted: ${track.muted}`);
                });
                console.groupEnd();
            }
            
            // Dispatch event for UI components
            const event = new CustomEvent('remote-stream-update', {
                detail: stream,
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(event);
            
            // Handle autoplay restrictions
            if (stream) {
                const videoElements = document.querySelectorAll('video');
                videoElements.forEach(video => {
                    if (video.srcObject !== stream) {
                        video.srcObject = stream;
                        
                        // Mute video initially to bypass autoplay restrictions
                        video.muted = true;
                        
                        // Try to play with error handling
                        const playWithFallback = () => {
                            video.play().catch(error => {
                                console.warn('Autoplay prevented:', error);
                                // Show play button overlay if autoplay fails
                                const playButton = document.createElement('button');
                                playButton.className = 'autoplay-fallback';
                                playButton.textContent = 'Click to Play';
                                playButton.onclick = () => {
                                    video.play().then(() => {
                                        playButton.remove();
                                        // Unmute after user interaction
                                        video.muted = false;
                                    });
                                };
                                video.parentNode.appendChild(playButton);
                            });
                        };
                        
                        // Try playing immediately
                        playWithFallback();
                        
                        // Also handle audio elements if they exist
                        const audioElements = document.querySelectorAll('audio');
                        audioElements.forEach(audio => {
                            if (audio.srcObject !== stream) {
                                audio.srcObject = stream;
                                audio.play().catch(error => {
                                    console.warn('Audio autoplay prevented:', error);
                                });
                            }
                        });
                    }
                });
            }
            
            // Call original callback
            callback(stream);
        };
    }

    setOnDisconnected(callback) {
        this.onDisconnected = callback;
    }

    setOnMediaError(callback) {
        this.onMediaError = callback;
    }

    async cleanupAsync() {
        await this.cleanup();
        // Additional async cleanup if needed in the future
        return Promise.resolve();
        
        // Reset track references
        this.audioTracks = null;
        this.videoTracks = null;
        
        // Reset state
        this._audioEnabled = true;
        this._videoEnabled = true;
        this.isTranscribing = false;
    }

    setAudioEnabled(enabled) {
        this._audioEnabled = enabled;
        if (this.localStream) {
            const audioTracks = this.localStream.getAudioTracks();
            let trackStateChanged = false;

            for (const track of audioTracks) {
                if (track.readyState === 'live') {
                    track.enabled = enabled;
                    trackStateChanged = true;
                    console.log(`Audio track ${track.id} ${enabled ? 'enabled' : 'disabled'}`);
                } else {
                    console.warn(`Audio track ${track.id} not live, current state: ${track.readyState}`);
                }
            }

            // Update last known state only if track state actually changed
            if (trackStateChanged) {
                this._lastKnownAudioState = enabled;
                
                // Notify peer about audio state change
                if (this.socket && this.roomId) {
                    this.socket.emit('media-state-change', {
                        room: this.roomId,
                        type: 'audio',
                        enabled
                    });
                }

                // Handle transcription service when audio is toggled
                if (this.localTranscriptionService) {
                    if (enabled) {
                        this.localTranscriptionService.resumeTranscription();
                        console.log('Transcription resumed');
                        // Clear processed transcripts when resuming to avoid stale entries
                        this.processedTranscripts = new Set();
                    } else {
                        this.localTranscriptionService.pauseTranscription();
                        console.log('Transcription paused');
                    }
                }
            }
        }
        return this._audioEnabled;
    }

    async initialize(roomId, isInitiator = false, onCallStarted = null) {
        try {
            // Check if already initialized with valid stream and same room
            if (this._initialized && this.localStream && this.localStream.active && this.roomId === roomId) {
                console.log('WebRTC service already initialized with active stream for this room, returning existing stream');
                return this.localStream;
            }

            // If initialized but different room or invalid stream, cleanup first
            if (this._initialized || this.localStream) {
                console.log('Cleaning up existing resources before reinitializing');
                await this.cleanup();
                // Ensure all tracks are stopped and streams are nullified
                if (this.localStream) {
                    this.localStream.getTracks().forEach(track => track.stop());
                    this.localStream = null;
                }
                if (this.remoteStream) {
                    this.remoteStream.getTracks().forEach(track => track.stop());
                    this.remoteStream = null;
                }
            }
            
            this._initialized = false; // Reset initialization flag after cleanup
            this.onCallStarted = onCallStarted;
            const { default: DeepgramService } = await import('./DeepgramService');
            this.roomId = roomId;
            this.isInitiator = isInitiator;
            this.callStartTime = null;
            
            // Connect to signaling server
            if (!this.socket) {
                this.socket = io(window.location.origin, {
                    reconnection: true,
                    reconnectionAttempts: 5,
                    reconnectionDelay: 1000,
                    timeout: 10000
                });
                this.setupSocketListeners();
            }
        
            // Join the room
            this.socket.emit('join', { room: this.roomId, isTherapist: this.isInitiator });
            console.log(`Joining room: ${this.roomId} as ${isInitiator ? 'initiator' : 'participant'}`);
        
            // Get local media stream
            this.checkBrowserCompatibility();
            if (!navigator.mediaDevices) {
                console.error('mediaDevices API not supported in this browser.');
                const browserInfo = this.getBrowserInfo();
                throw new Error(`Media devices API not supported in ${browserInfo.name} ${browserInfo.version}. Please use a modern browser like Chrome (55+), Firefox (44+), Safari (11+), or Edge (79+).`);
            }
        
            // Create new localStream
            let devices = [];
            try {
                devices = await navigator.mediaDevices.enumerateDevices();
            } catch (enumError) {
                console.error('Failed to enumerate devices:', enumError);
                throw new Error('Cannot access media devices. Please check your camera and microphone permissions.');
            }
            
            const hasVideo = devices.some(device => device.kind === 'videoinput');
            const hasAudio = devices.some(device => device.kind === 'audioinput');
            if (!hasVideo && !hasAudio) {
                console.error('No video or audio input devices detected');
                throw new Error('No camera or microphone found. Please check your device connections and browser permissions.');
            }
            
            // Get media stream with current enabled states
            const constraints = {
                video: hasVideo ? {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                } : false,
                audio: hasAudio ? {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                } : false
            };

            try {
                // Check if we already have an active stream before creating a new one
                if (this.localStream && this.localStream.active) {
                    console.log('Reusing existing active local stream');
                } else {
                    // Stop any existing tracks before creating a new stream
                    if (this.localStream) {
                        this.localStream.getTracks().forEach(track => track.stop());
                        this.localStream = null;
                    }
                    
                    console.log('Creating new media stream with constraints:', constraints);
                    this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
                }
                
                // Set initial track states based on stored preferences
                if (this.localStream) {
                    const videoTrack = this.localStream.getVideoTracks()[0];
                    const audioTrack = this.localStream.getAudioTracks()[0];
                    
                    if (videoTrack) {
                        videoTrack.enabled = this._videoEnabled;
                        this._lastKnownVideoState = this._videoEnabled;
                    }
                    if (audioTrack) {
                        audioTrack.enabled = this._audioEnabled;
                        this._lastKnownAudioState = this._audioEnabled;
                    }
                }
                console.log('Local stream obtained:', this.localStream);
            } catch (error) {
                console.error('Error accessing media devices:', error);
                throw error;
            }

            // Initialize transcription service
            if (this.localStream) {
                this.isTranscribing = true;
                // Always clean up any existing transcription service first
                if (this.localTranscriptionService) {
                    await this.localTranscriptionService.stopTranscription();
                    this.localTranscriptionService = null;
                }
                
                // Create new transcription service only if it doesn't exist
                this.localTranscriptionService = new DeepgramService();
                await this.localTranscriptionService.initialize(this.localStream, true);
                
                // Reset processed transcripts set to avoid duplicates from previous sessions
                this.processedTranscripts = new Set();
                
                this.localTranscriptionService.setOnTranscriptReceived((transcript) => {
                    if (transcript.text.trim()) {
                        const event = new CustomEvent('transcription', { 
                            detail: { 
                                text: transcript.text,
                                isLocal: true,
                                timestamp: new Date().toLocaleTimeString()
                            }
                        });
                        document.dispatchEvent(event);
                        // Deduplicate transcripts before processing
                        const transcriptKey = `${transcript.text}-${transcript.isLocal}`;
                        if (!this.processedTranscripts.has(transcriptKey)) {
                            this.processedTranscripts.add(transcriptKey);
                            if (this.onTranscriptReceived) {
                                this.onTranscriptReceived(transcript);
                            }
                        }
                    }
                });
            }
        
            // Add event listener for device changes only once
            if (!this._deviceChangeListenerAdded) {
                navigator.mediaDevices.addEventListener('devicechange', async () => {
                    console.log('Media devices changed, updating available devices');
                    try {
                        const updatedDevices = await navigator.mediaDevices.enumerateDevices();
                        console.log('Updated devices:', updatedDevices);
                    } catch (error) {
                        console.error('Error enumerating devices after change:', error);
                    }
                });
                this._deviceChangeListenerAdded = true;
            }
        
            // Verify stream tracks are active
            const videoTrack = this.localStream.getVideoTracks()[0];
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (videoTrack) {
                console.log('Video track active:', videoTrack.enabled);
                videoTrack.onended = () => {
                    console.log('Video track ended');
                    if (this.onMediaError) {
                        this.onMediaError('Video device disconnected');
                    }
                };
            }
            if (audioTrack) {
                console.log('Audio track active:', audioTrack.enabled);
                audioTrack.onended = () => {
                    console.log('Audio track ended');
                    if (this.onMediaError) {
                        this.onMediaError('Audio device disconnected');
                    }
                };
            }
            // Set initial track states and mark as initialized
            await Promise.all([
                this.setAudioEnabled(this._audioEnabled),
                this.setVideoEnabled(this._videoEnabled)
            ]);
            
            this._initialized = true;
            return this.localStream;
        } catch (error) {
            console.error('Error accessing media devices:', error);
            this.isTranscribing = false;
            this._initialized = false;
            throw error;
        }
    }

    setupSocketListeners() {
        this.socket.on('joined', async ({ room, numClients, callStarted, clientId }) => {
            console.log(`Successfully joined room ${room} with ${numClients} clients. Call started: ${callStarted}`);
            console.log(`My socket ID: ${clientId}`);
            this.socketId = clientId; // Store my socket ID for better identification
            this.callStarted = callStarted;

            if (!this.isInitiator && !this.callStarted) {
                throw new Error('Therapist hasn\'t started the call yet. Please wait.');
            }

            if (this.isInitiator) {
                this.callStarted = true;
                this.callStartTime = Date.now();
                this.socket.emit('start-call', { room: this.roomId, startTime: this.callStartTime });
                if (this.onCallStarted) this.onCallStarted(this.callStartTime);
            }
            
            // Ensure local stream is initialized before creating peer connection
            if (!this.localStream) {
                console.log('Waiting for local stream initialization...');
                return;
            }
            
            try {
                await this.createPeerConnection(); // Create peer connection only after local stream is ready
                
                // Only initiator creates an offer when they detect another peer
                if (numClients === 2 && this.isInitiator) {
                    console.log('Creating and sending offer as initiator');
                    // Add a small delay to ensure both peers are ready
                    setTimeout(async () => {
                        try {
                            // Ensure peer connection is in stable state before creating offer
                            if (this.peerConnection.signalingState === 'stable') {
                                await this.createOffer();
                            } else {
                                console.log('Waiting for signaling state to stabilize...');
                                await new Promise(resolve => {
                                    const checkState = () => {
                                        if (this.peerConnection.signalingState === 'stable') {
                                            resolve();
                                        } else {
                                            setTimeout(checkState, 100);
                                        }
                                    };
                                    checkState();
                                });
                                await this.createOffer();
                            }
                        } catch (error) {
                            console.error('Error creating offer:', error);
                            // Attempt to recreate peer connection and retry offer
                            await this.createPeerConnection();
                            await this.createOffer();
                        }
                    }, 3000); // Increased delay to ensure non-initiator has time to set up
                }
            } catch (error) {
                console.error('Error setting up peer connection:', error);
            }
        });

        this.socket.on('call-started', (data) => {
            console.log('Call started event received');
            this.callStarted = true;
            this.callStartTime = data.startTime || Date.now();
            if (this.onCallStarted) {
                this.onCallStarted(this.callStartTime);
            }
        });
        
        // Handle user connection with role information
        this.socket.on('user-connected', ({ userId, role, displayName }) => {
            console.log(`User connected: ${userId} as ${role} (${displayName || 'Unknown'})`);
            
            // Store connected user information
            if (!this.connectedUsers) {
                this.connectedUsers = new Map();
            }
            
            this.connectedUsers.set(userId, { role, displayName, connected: true });
            
            // Emit custom event for UI components to react
            const event = new CustomEvent('user-connected', { 
                detail: { userId, role, displayName }
            });
            document.dispatchEvent(event);
            
            // If we're the initiator and this is a patient connecting, we might want to start the call
            if (this.isInitiator && role === 'patient' && !this.callStarted) {
                console.log('Patient connected, initiator starting call');
                this.callStarted = true;
                this.callStartTime = Date.now();
                this.socket.emit('start-call', { room: this.roomId, startTime: this.callStartTime });
                if (this.onCallStarted) this.onCallStarted(this.callStartTime);
            }
            
            // Attempt to establish peer connection if not already done
            if (this.peerConnection && this.peerConnection.connectionState !== 'connected') {
                console.log('User connected, attempting to establish/improve connection');
                this.peerConnection.restartIce();
            }
        });

        // Handle reconnection attempts
        let reconnectionAttempts = 0;
        const maxReconnectionAttempts = 3;
        const reconnectionDelay = 2000; // 2 seconds

        const attemptReconnection = async () => {
            if (reconnectionAttempts >= maxReconnectionAttempts) {
                console.log('Max reconnection attempts reached');
                this.handleDisconnection();
                return;
            }
            reconnectionAttempts++;
            console.log(`Attempting reconnection (${reconnectionAttempts}/${maxReconnectionAttempts})`);
            
            try {
                await this.createPeerConnection();
                if (this.isInitiator) {
                    await this.createOffer();
                }
            } catch (error) {
                console.error('Reconnection attempt failed:', error);
                setTimeout(attemptReconnection, reconnectionDelay);
            }
        };

        this.socket.on('offer', async (description) => {
            if (!this.isInitiator) {
                try {
                    console.log('Received offer from initiator, preparing to answer');
                    if (!this.peerConnection) {
                        console.log('Creating peer connection for non-initiator');
                        await this.createPeerConnection();
                    }
                    
                    // Check if we can set remote description
                    if (this.peerConnection.signalingState !== 'stable') {
                        console.log('Resetting peer connection state...');
                        await Promise.all([
                            this.peerConnection.setLocalDescription({type: 'rollback'}),
                            this.peerConnection.setRemoteDescription(new RTCSessionDescription(description))
                        ]);
                    } else {
                        console.log('Setting remote description from offer');
                        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(description));
                    }
                    
                    // Process any pending ICE candidates
                    if (this.pendingIceCandidates.length > 0) {
                        console.log(`Processing ${this.pendingIceCandidates.length} pending ICE candidates`);
                        const candidatePromises = this.pendingIceCandidates.map(candidate => 
                            this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
                                .catch(err => console.error('Error adding pending ICE candidate:', err))
                        );
                        await Promise.all(candidatePromises);
                        this.pendingIceCandidates = [];
                    }
                    
                    console.log('Creating answer');
                    const answer = await this.peerConnection.createAnswer();
                    console.log('Setting local description');
                    await this.peerConnection.setLocalDescription(answer);
                    console.log('Sending answer');
                    this.socket.emit('answer', { room: this.roomId, answer });
                } catch (error) {
                    console.error('Error handling offer:', error);
                    await attemptReconnection();
                }
            }
        });

        this.socket.on('answer', async (description) => {
            if (this.isInitiator && this.peerConnection) {
                try {
                    console.log('Setting remote description from answer');
                    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(description));
                    console.log('Answer processed successfully');
                    
                    // Process any pending ICE candidates
                    if (this.pendingIceCandidates.length > 0) {
                        console.log(`Processing ${this.pendingIceCandidates.length} pending ICE candidates`);
                        for (const candidate of this.pendingIceCandidates) {
                            try {
                                await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                            } catch (err) {
                                console.error('Error adding pending ICE candidate:', err);
                            }
                        }
                        this.pendingIceCandidates = [];
                    }
                } catch (error) {
                    console.error('Error handling answer:', error);
                    await attemptReconnection();
                }
            }
        });

        // Store ice candidates if received before remote description is set
        this.pendingIceCandidates = [];
        
        this.socket.on('ice-candidate', async (candidate) => {
            try {
                if (this.peerConnection && this.peerConnection.remoteDescription) {
                    console.log('Adding ICE candidate:', candidate);
                    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                } else {
                    console.log('Storing ICE candidate for later processing');
                    this.pendingIceCandidates.push(candidate);
                }
            } catch (error) {
                console.error('Error adding ICE candidate:', error);
            }
        });

        this.socket.on('user-disconnected', ({ userId, role }) => {
            console.log(`User disconnected: ${userId} as ${role}`);
            
            // Update connected users map
            if (this.connectedUsers && this.connectedUsers.has(userId)) {
                const userInfo = this.connectedUsers.get(userId);
                userInfo.connected = false;
                this.connectedUsers.set(userId, userInfo);
                
                // Emit custom event for UI components to react
                const event = new CustomEvent('user-disconnected', { 
                    detail: { userId, role, displayName: userInfo.displayName }
                });
                document.dispatchEvent(event);
            }
            
            // Handle disconnection with improved logging
            this.handleDisconnection(userId, role);
        });

        // Handle transcription events
        this.socket.on('transcription', (data) => {
            if (!data || !data.text || !data.timestamp) return;
            
            // Create a unique key for the transcript
            const transcriptKey = `${data.text}-${data.timestamp}-${data.isLocal}`;
            
            // Only process if we haven't seen this transcript before
            if (!this.processedTranscripts.has(transcriptKey)) {
                this.processedTranscripts.add(transcriptKey);
                console.log('Received remote transcription:', data);
                
                // Initialize remote transcription service if needed
                if (!this.remoteTranscriptionService && this.remoteStream) {
                    console.log('Initializing remote transcription service');
                    this.initializeRemoteTranscription(this.remoteStream);
                }
                
                // Dispatch the transcription event
                const event = new CustomEvent('transcription', {
                    detail: {
                        text: data.text,
                        isLocal: data.isLocal,
                        timestamp: data.timestamp
                    }
                });
                document.dispatchEvent(event);
            }
        });
        
        // Handle media state changes from remote peer
        this.socket.on('media-state-change', (data) => {
            console.log('Remote peer media state change:', data);
            if (data && data.type) {
                // Update UI or take appropriate action based on remote peer's media state
                const event = new CustomEvent('remote-media-change', {
                    detail: {
                        type: data.type,
                        enabled: data.enabled
                    }
                });
                document.dispatchEvent(event);
            }
        });
    }

    /**
     * Toggle microphone on/off
     */
    get audioEnabled() {
        return this._audioEnabled;
    }

    set audioEnabled(value) {
        this._audioEnabled = value;
        if (this.localStream) {
            const audioTracks = this.localStream.getAudioTracks();
            audioTracks.forEach(track => track.enabled = value);
        }
    }

    get videoEnabled() {
        return this._videoEnabled;
    }

    set videoEnabled(value) {
        this._videoEnabled = value;
        if (this.localStream) {
            const videoTracks = this.localStream.getVideoTracks();
            videoTracks.forEach(track => track.enabled = value);
        }
    }

    async toggleAudio(forcedState = null) {
        if (!this.localStream || !this._initialized) {
            console.warn('Cannot toggle audio: stream not initialized');
            return false;
        }

        const audioTracks = this.localStream.getAudioTracks();
        if (audioTracks.length === 0) {
            console.warn('No audio tracks available');
            return false;
        }

        try {
            const currentState = audioTracks[0].enabled;
            const newState = forcedState !== null ? forcedState : !currentState;
            
            console.log(`Toggling audio from ${currentState} to ${newState}`);
            
            // Update all audio tracks
            for (const track of audioTracks) {
                track.enabled = newState;
                console.log(`Audio track ${track.id} ${newState ? 'enabled' : 'disabled'}`);
            }
            
            this._audioEnabled = newState;
            this._lastKnownAudioState = newState;

            // Handle transcription service - ensure this happens synchronously
            if (this.localTranscriptionService) {
                console.log(`${newState ? 'Resuming' : 'Pausing'} local transcription due to audio ${newState ? 'enable' : 'mute'}`);
                try {
                    if (newState) {
                        await this.localTranscriptionService.resumeTranscription();
                    } else {
                        await this.localTranscriptionService.pauseTranscription();
                    }
                } catch (transcriptionError) {
                    console.error('Error updating transcription state:', transcriptionError);
                    // Continue with the toggle even if transcription update fails
                }
            }
            
            // Notify remote peer if socket is connected
            if (this.socket && this.socket.connected && this.roomId) {
                console.log(`Notifying peer about audio state change: ${newState}`);
                this.socket.emit('media-state-change', {
                    room: this.roomId,
                    type: 'audio',
                    enabled: newState
                });
            }
            
            console.log(`Audio ${newState ? 'enabled' : 'disabled'}`);
            return newState;
        } catch (error) {
            console.error('Error toggling audio:', error);
            return false;
        }
    }

    /**
     * Toggle video on/off
     */
    async toggleVideo(forcedState = null) {
        if (!this.localStream || !this._initialized) {
            console.warn('Cannot toggle video: stream not initialized');
            return false;
        }

        const videoTracks = this.localStream.getVideoTracks();
        if (videoTracks.length === 0) {
            console.warn('No video tracks available');
            return false;
        }

        try {
            const currentState = videoTracks[0].enabled;
            const newState = forcedState !== null ? forcedState : !currentState;
            
            console.log(`Toggling video from ${currentState} to ${newState}`);
            
            // Update all video tracks
            for (const track of videoTracks) {
                try {
                    track.enabled = newState;
                    console.log(`Video track ${track.id} ${newState ? 'enabled' : 'disabled'}`);
                } catch (trackError) {
                    console.error(`Error toggling video track ${track.id}:`, trackError);
                }
            }
            
            this._videoEnabled = newState;
            this._lastKnownVideoState = newState;

            // Notify remote peer if socket is connected
            if (this.socket && this.socket.connected && this.roomId) {
                console.log(`Notifying peer about video state change: ${newState}`);
                this.socket.emit('media-state-change', {
                    room: this.roomId,
                    type: 'video',
                    enabled: newState
                });
            }
            
            console.log(`Video ${newState ? 'enabled' : 'disabled'}`);
            return newState;
        } catch (error) {
            console.error('Error toggling video:', error);
            return false;
        }
    }

    async createPeerConnection() {
        try {
            if (this.peerConnection) {
                console.log('Cleaning up existing peer connection');
                this.peerConnection.close();
                // Clear remote stream when connection is closed
                if (this.remoteStream) {
                    this.remoteStream.getTracks().forEach(track => track.stop());
                    this.remoteStream = null;
                }
            }

            console.log('Creating new RTCPeerConnection with config:', this.configuration);
            this.peerConnection = new RTCPeerConnection(this.configuration);
            
            // Enhanced ICE candidate handling
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    console.log('Generated ICE candidate for:', event.candidate.sdpMid);
                    this.socket.emit('ice-candidate', { 
                        room: this.roomId, 
                        candidate: event.candidate 
                    });
                }
            };

            // Monitor ICE connection state
            this.peerConnection.oniceconnectionstatechange = () => {
                console.log('ICE Connection State:', this.peerConnection.iceConnectionState);
                if (this.peerConnection.iceConnectionState === 'failed') {
                    console.log('ICE Connection failed, attempting to restart');
                    this.peerConnection.restartIce();
                } else if (this.peerConnection.iceConnectionState === 'disconnected') {
                    console.log('ICE Connection disconnected, waiting for recovery...');
                    setTimeout(() => {
                        if (this.peerConnection.iceConnectionState === 'disconnected') {
                            this.handleDisconnection();
                        }
                    }, 5000);
                }
            };

            // Monitor connection state
            this.peerConnection.onconnectionstatechange = () => {
                console.log('Connection State:', this.peerConnection.connectionState);
                if (this.peerConnection.connectionState === 'failed') {
                    console.log('Connection failed, initiating cleanup');
                    this.handleDisconnection();
                }
            };

            // Enhanced track handling with proper stream management
            this.peerConnection.ontrack = async (event) => {
                console.log('ontrack event received:', event);
                console.log('Received track kind:', event.track.kind);
                console.log('Received track enabled:', event.track.enabled);
                console.log('Received track readyState:', event.track.readyState);
                console.log('Received track stream ID:', event.streams[0]?.id);
                
                // Always create a new MediaStream if it doesn't exist
                if (!this.remoteStream) {
                    this.remoteStream = new MediaStream();
                    console.log('Created new remote MediaStream');
                }

                // Always add the track to ensure we have the latest version
                const existingTrack = this.remoteStream.getTracks().find(t => t.kind === event.track.kind);
                if (existingTrack) {
                    this.remoteStream.removeTrack(existingTrack);
                }
                this.remoteStream.addTrack(event.track);
                const streamUpdateEvent = new CustomEvent('remote-stream-update', { detail: this.remoteStream });
                document.dispatchEvent(streamUpdateEvent);
                console.log(`Added ${event.track.kind} track to remote stream`);

                // Notify any registered stream handlers
                if (this.onRemoteStream) {
                    this.onRemoteStream(this.remoteStream);
                }

                try {
                    const track = event.track;
                    const trackKind = track.kind;

                    // We no longer directly manipulate the video element here
                    // The VideoCallInterface component will handle this through the remoteStream state
                    // and the onRemoteStream callback

                    // Set up track monitoring
                    track.onended = () => {
                        console.log(`Remote ${trackKind} track ended`);
                        if (this.remoteStream.getTracks().length === 0) {
                            this.handleDisconnection();
                        } else {
                            // If only one track remains, check its kind and update state accordingly
                            const remainingTrack = this.remoteStream.getTracks()[0];
                            if (remainingTrack.kind === 'audio') {
                                document.dispatchEvent(new CustomEvent('remote-media-change', { detail: { type: 'video', enabled: false } }));
                            } else if (remainingTrack.kind === 'video') {
                                document.dispatchEvent(new CustomEvent('remote-media-change', { detail: { type: 'audio', enabled: false } }));
                            }
                        }
                    };

                    track.onmute = () => {
                        console.log(`Remote ${trackKind} track muted`);
                         document.dispatchEvent(new CustomEvent('remote-media-change', { detail: { type: trackKind, enabled: false } }));
                    };
                    track.onunmute = () => {
                        console.log(`Remote ${trackKind} track unmuted`);
                        document.dispatchEvent(new CustomEvent('remote-media-change', { detail: { type: trackKind, enabled: true } }));
                    };

                    // Initialize transcription for audio tracks only once
                    if (trackKind === 'audio') {
                        console.log('Initializing remote transcription');
                        await this.initializeRemoteTranscription(this.remoteStream);
                    }

                    // Notify stream handlers
                    if (this.onRemoteStream) {
                        this.onRemoteStream(this.remoteStream);
                    }
                } catch (error) {
                    console.error('Error handling remote track:', error);
                }
            };

            // Add local tracks with enhanced error handling
            if (this.localStream) {
                const tracks = this.localStream.getTracks();
                console.log(`Adding ${tracks.length} local tracks`);
                
                for (const track of tracks) {
                    try {
                        const sender = this.peerConnection.addTrack(track, this.localStream);
                        console.log(`Added local ${track.kind} track`);
                        
                        if (track.kind === 'audio') {
                            this.audioSender = sender;
                        } else if (track.kind === 'video') {
                            this.videoSender = sender;
                        }
                    } catch (error) {
                        console.error(`Error adding ${track.kind} track:`, error);
                    }
                }
            } else {
                console.warn('No local stream available for peer connection');
            }

            return this.peerConnection;
        } catch (error) {
            console.error('Error creating peer connection:', error);
            throw error;
        }
    }

    async createOffer() {
        try {
            if (!this.peerConnection) {
                console.error('Cannot create offer: peer connection is null');
                await this.createPeerConnection();
            }
            
            console.log('Creating offer...');
            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true,
                iceRestart: true // Force ICE restart to get fresh candidates
            });
            
            console.log('Setting local description...');
            await this.peerConnection.setLocalDescription(offer);
            
            // Wait for ICE gathering to complete or timeout after 5 seconds
            await new Promise((resolve) => {
                const checkState = () => {
                    if (this.peerConnection.iceGatheringState === 'complete') {
                        console.log('ICE gathering completed');
                        resolve();
                    }
                };
                
                const iceGatheringTimeout = setTimeout(() => {
                    console.log('ICE gathering timed out, proceeding anyway');
                    resolve();
                }, 5000);
                
                this.peerConnection.addEventListener('icegatheringstatechange', () => {
                    checkState();
                    if (this.peerConnection.iceGatheringState === 'complete') {
                        clearTimeout(iceGatheringTimeout);
                    }
                });
                
                checkState(); // Check immediately in case it's already complete
            });
            
            console.log('Sending offer to remote peer...');
            this.socket.emit('offer', { room: this.roomId, offer: this.peerConnection.localDescription });
        } catch (error) {
            console.error('Error creating offer:', error);
            await this.handleDisconnection();
            throw error;
        }
    }

    handleDisconnection(userId = null, role = null) {
        console.log(`Handling disconnection${userId ? ` for ${role} (${userId})` : ''}`);
        console.log('Handling disconnection...');
        if (this.peerConnection) {
            // Close all tracks
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => track.stop());
            }
            if (this.remoteStream) {
                this.remoteStream.getTracks().forEach(track => track.stop());
            }
            
            // Close peer connection
            this.peerConnection.close();
            this.peerConnection = null;
        }

        // Reset connection state
        this.remoteStream = null;
        this.pendingIceCandidates = [];
        this.audioSender = null;
        this.videoSender = null;
        
        if (this.onDisconnected) {
            this.onDisconnected();
        }
        
        // Attempt to reconnect if we're still in the room
        if (this.roomId && this.socket && this.socket.connected) {
            console.log('Attempting to reconnect...');
            // Keep the local stream if it exists for reconnection
            setTimeout(() => {
                this.socket.emit('join', { room: this.roomId });
            }, 1000); // Small delay to ensure socket is ready
        }
    }


    cleanup() {
        console.log('Cleaning up WebRTC service');
        
        // Clean up transcription services first
        if (this.localTranscriptionService) {
            console.log('Stopping local transcription service');
            this.localTranscriptionService.stopTranscription();
            this.localTranscriptionService = null;
        }
        
        if (this.remoteTranscriptionService) {
            console.log('Stopping remote transcription service');
            this.remoteTranscriptionService.stopTranscription();
            this.remoteTranscriptionService = null;
        }

        // Clean up media tracks with proper state management
        if (this.localStream) {
            console.log('Stopping local stream tracks');
            const tracks = this.localStream.getTracks();
            tracks.forEach(track => {
                track.enabled = false; // Disable before stopping
                track.stop();
                this.localStream.removeTrack(track);
            });
            this.localStream = null;
        }
        
        if (this.remoteStream) {
            console.log('Stopping remote stream tracks');
            const tracks = this.remoteStream.getTracks();
            tracks.forEach(track => {
                track.enabled = false; // Disable before stopping
                track.stop();
                this.remoteStream.removeTrack(track);
            });
            this.remoteStream = null;
        }
        
        // Clean up peer connection
        if (this.peerConnection) {
            console.log('Closing peer connection');
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        // Clean up socket connection
        if (this.socket) {
            console.log('Closing socket connection');
            this.socket.close();
            this.socket = null;
        }
        
        // Reset all state variables
        this._initialized = false;
        this.isTranscribing = false;
        this._audioEnabled = true;
        this._videoEnabled = true;
        this._lastKnownAudioState = true;
        this._lastKnownVideoState = true;
        this.audioSender = null;
        this.videoSender = null;
        this.processedTranscripts.clear();
        this.pendingIceCandidates = [];
    }

    setOnRemoteStream(callback) {
        this.onRemoteStream = (stream) => {
            // Add detailed logging for remote stream
            if (stream) {
                console.group('Remote Stream Details');
                console.log('Stream active:', stream.active);
                stream.getTracks().forEach(track => {
                    console.log(`Track ${track.id} (${track.kind}):`,
                        `enabled: ${track.enabled},`,
                        `readyState: ${track.readyState},`,
                        `muted: ${track.muted}`);
                });
                console.groupEnd();
            }
            
            // Dispatch event for UI components
            const event = new CustomEvent('remote-stream-update', {
                detail: stream,
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(event);
            
            // Handle autoplay restrictions
            if (stream) {
                const videoElements = document.querySelectorAll('video');
                videoElements.forEach(video => {
                    if (video.srcObject !== stream) {
                        video.srcObject = stream;
                        
                        // Mute video initially to bypass autoplay restrictions
                        video.muted = true;
                        
                        // Try to play with error handling
                        const playWithFallback = () => {
                            video.play().catch(error => {
                                console.warn('Autoplay prevented:', error);
                                // Show play button overlay if autoplay fails
                                const playButton = document.createElement('button');
                                playButton.className = 'autoplay-fallback';
                                playButton.textContent = 'Click to Play';
                                playButton.onclick = () => {
                                    video.play().then(() => {
                                        playButton.remove();
                                        // Unmute after user interaction
                                        video.muted = false;
                                    });
                                };
                                video.parentNode.appendChild(playButton);
                            });
                        };
                        
                        // Try playing immediately
                        playWithFallback();
                        
                        // Also handle audio elements if they exist
                        const audioElements = document.querySelectorAll('audio');
                        audioElements.forEach(audio => {
                            if (audio.srcObject !== stream) {
                                audio.srcObject = stream;
                                audio.play().catch(error => {
                                    console.warn('Audio autoplay prevented:', error);
                                });
                            }
                        });
                    }
                });
            }
            
            // Call original callback
            callback(stream);
        };
    }

    setOnDisconnected(callback) {
        this.onDisconnected = callback;
    }

    setOnMediaError(callback) {
        this.onMediaError = callback;
    }

    async cleanup() {
        console.log('Starting full cleanup of WebRTC resources');
        
        // Cleanup existing transcription services first
        if (this.localTranscriptionService) {
            console.log('Stopping local transcription service');
            try {
                await this.localTranscriptionService.stopTranscription();
            } catch (error) {
                console.error('Error stopping local transcription:', error);
            }
            this.localTranscriptionService = null;
        }
        
        if (this.remoteTranscriptionService) {
            console.log('Stopping remote transcription service');
            try {
                await this.remoteTranscriptionService.stopTranscription();
            } catch (error) {
                console.error('Error stopping remote transcription:', error);
            }
            this.remoteTranscriptionService = null;
        }
        
        // Clean up local stream tracks
        if (this.localStream) {
            console.log('Stopping local stream tracks');
            const tracks = this.localStream.getTracks();
            for (const track of tracks) {
                try {
                    track.enabled = false; // Disable before stopping
                    track.onended = null; // Remove event listeners
                    track.stop();
                    console.log(`Stopped local ${track.kind} track: ${track.id}`);
                } catch (error) {
                    console.error(`Error stopping local ${track.kind} track:`, error);
                }
            }
            this.localStream = null;
        }
        
        // Clean up remote stream tracks
        if (this.remoteStream) {
            console.log('Stopping remote stream tracks');
            const tracks = this.remoteStream.getTracks();
            for (const track of tracks) {
                try {
                    track.enabled = false; // Disable before stopping
                    track.onended = null; // Remove event listeners
                    track.stop();
                    console.log(`Stopped remote ${track.kind} track: ${track.id}`);
                } catch (error) {
                    console.error(`Error stopping remote ${track.kind} track:`, error);
                }
            }
            this.remoteStream = null;
        }
        
        // Close peer connection
        if (this.peerConnection) {
            console.log('Closing peer connection');
            try {
                this.peerConnection.onicecandidate = null;
                this.peerConnection.ontrack = null;
                this.peerConnection.oniceconnectionstatechange = null;
                this.peerConnection.onconnectionstatechange = null;
                this.peerConnection.close();
            } catch (error) {
                console.error('Error closing peer connection:', error);
            }
            this.peerConnection = null;
        }
        
        // Close socket connection
        if (this.socket) {
            console.log('Disconnecting socket');
            try {
                this.socket.disconnect();
            } catch (error) {
                console.error('Error disconnecting socket:', error);
            }
            this.socket = null;
        }
        
        // Reset all state variables
        this._initialized = false;
        this._initializing = false;
        this.isTranscribing = false;
        this.callStarted = false;
        this.callStartTime = null;
        this.processedTranscripts = new Set();
        this.pendingIceCandidates = [];
        
        // Reset media states
        this._audioEnabled = true;
        this._videoEnabled = true;
        this._lastKnownAudioState = true;
        this._lastKnownVideoState = true;
        
        console.log('WebRTC cleanup completed');
        console.log('Starting full cleanup of WebRTC resources');
        
        // Cleanup existing transcription services first
        if (this.localTranscriptionService) {
            console.log('Stopping local transcription service');
            try {
                await this.localTranscriptionService.stopTranscription();
            } catch (error) {
                console.error('Error stopping local transcription:', error);
            }
            this.localTranscriptionService = null;
        }
        
        if (this.remoteTranscriptionService) {
            console.log('Stopping remote transcription service');
            try {
                await this.remoteTranscriptionService.stopTranscription();
            } catch (error) {
                console.error('Error stopping remote transcription:', error);
            }
            this.remoteTranscriptionService = null;
        }
        
        // Clean up local stream tracks
        if (this.localStream) {
            console.log('Stopping local stream tracks');
            const tracks = this.localStream.getTracks();
            for (const track of tracks) {
                try {
                    track.enabled = false; // Disable before stopping
                    track.onended = null; // Remove event listeners
                    track.stop();
                    console.log(`Stopped local ${track.kind} track: ${track.id}`);
                } catch (error) {
                    console.error(`Error stopping local ${track.kind} track:`, error);
                }
            }
            this.localStream = null;
        }
        
        // Clean up remote stream tracks
        if (this.remoteStream) {
            console.log('Stopping remote stream tracks');
            const tracks = this.remoteStream.getTracks();
            for (const track of tracks) {
                try {
                    track.enabled = false; // Disable before stopping
                    track.onended = null; // Remove event listeners
                    track.stop();
                    console.log(`Stopped remote ${track.kind} track: ${track.id}`);
                } catch (error) {
                    console.error(`Error stopping remote ${track.kind} track:`, error);
                }
            }
            this.remoteStream = null;
        }
        
        // Close peer connection
        if (this.peerConnection) {
            console.log('Closing peer connection');
            try {
                this.peerConnection.onicecandidate = null;
                this.peerConnection.ontrack = null;
                this.peerConnection.oniceconnectionstatechange = null;
                this.peerConnection.onconnectionstatechange = null;
                this.peerConnection.close();
            } catch (error) {
                console.error('Error closing peer connection:', error);
            }
            this.peerConnection = null;
        }
        
        // Close socket connection
        if (this.socket) {
            console.log('Disconnecting socket');
            try {
                this.socket.disconnect();
            } catch (error) {
                console.error('Error disconnecting socket:', error);
            }
            this.socket = null;
        }
        
        // Reset all state variables
        this._initialized = false;
        this.isTranscribing = false;
        this.callStarted = false;
        this.callStartTime = null;
        this.processedTranscripts = new Set();
        this.pendingIceCandidates = [];
        
        // Ensure we don't have any lingering references to audio processing
        this.audioTracks = null;
        this.videoTracks = null;
        
        // Reset media states
        this._audioEnabled = true;
        this._videoEnabled = true;
        this._lastKnownAudioState = true;
        this._lastKnownVideoState = true;
        
        console.log('WebRTC cleanup completed');
    }

    async setVideoEnabled(enabled) {
        console.log(`Setting video enabled: ${enabled}`);
        this._videoEnabled = enabled;
        
        if (!this.localStream) {
            console.warn('Cannot set video enabled: No local stream available');
            return this._videoEnabled;
        }

        const videoTracks = this.localStream.getVideoTracks();
        if (videoTracks.length === 0) {
            console.warn('No video tracks available');
            return this._videoEnabled;
        }

        let trackStateChanged = false;
        const trackPromises = videoTracks.map(async (track) => {
            try {
                if (track.readyState === 'live') {
                    track.enabled = enabled;
                    trackStateChanged = true;
                    console.log(`Video track ${track.id} ${enabled ? 'enabled' : 'disabled'}`);
                } else {
                    // Attempt to restart the track if it's not live
                    try {
                        await this.restartVideoTrack();
                        track.enabled = enabled;
                        trackStateChanged = true;
                        console.log(`Restarted and ${enabled ? 'enabled' : 'disabled'} video track ${track.id}`);
                    } catch (restartError) {
                        console.error(`Failed to restart video track ${track.id}:`, restartError);
                    }
                }
            } catch (trackError) {
                console.error(`Error setting video track ${track.id} state:`, trackError);
            }
        });

        await Promise.all(trackPromises);

        // Update last known state and notify peer only if track state actually changed
        if (trackStateChanged) {
            this._lastKnownVideoState = enabled;
            
            // Notify peer about video state change
            if (this.socket && this.socket.connected && this.roomId) {
                console.log(`Notifying peer about video state change: ${enabled}`);
                this.socket.emit('media-state-change', {
                    room: this.roomId,
                    type: 'video',
                    enabled
                });
            }
        }

        return this._videoEnabled;
    }

    async restartVideoTrack() {
        try {
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                }
            });

            const oldVideoTrack = this.localStream.getVideoTracks()[0];
            if (oldVideoTrack) {
                oldVideoTrack.stop();
                this.localStream.removeTrack(oldVideoTrack);
            }

            const newVideoTrack = newStream.getVideoTracks()[0];
            this.localStream.addTrack(newVideoTrack);

            // Update the track in the peer connection if it exists
            if (this.peerConnection) {
                const senders = this.peerConnection.getSenders();
                const videoSender = senders.find(sender => sender.track && sender.track.kind === 'video');
                if (videoSender) {
                    await videoSender.replaceTrack(newVideoTrack);
                }
            }

            return newVideoTrack;
        } catch (error) {
            console.error('Error restarting video track:', error);
            throw error;
        }
    }

    async initializeRemoteTranscription(remoteStream) {
        try {
            if (!remoteStream) {
                console.error('Cannot initialize remote transcription: no remote stream');
                return;
            }
            
            const { default: DeepgramService } = await import('./DeepgramService');
            if (!this.remoteTranscriptionService) {
                this.remoteTranscriptionService = new DeepgramService();
                await this.remoteTranscriptionService.initialize(remoteStream, false);
            }
            
            // Set up transcript handler for remote transcription
            this.remoteTranscriptionService.setOnTranscriptReceived((transcript) => {
                if (transcript.text.trim()) {
                    console.log('Remote transcript received:', transcript);
                    const event = new CustomEvent('transcription', { 
                        detail: { 
                            text: transcript.text,
                            isLocal: false,
                            timestamp: new Date().toLocaleTimeString()
                        }
                    });
                    document.dispatchEvent(event);
                    
                    if (this.onTranscriptReceived) {
                        this.onTranscriptReceived(transcript);
                    }
                }
            });
            
            console.log('Remote transcription service initialized successfully');
        } catch (error) {
            console.error('Failed to initialize remote transcription:', error);
        }
    }
    
    setOnTranscriptReceived(callback) {
        this.onTranscriptReceived = callback;
    }

    get audioEnabled() {
        return this.audioTracks.some(t => t?.enabled ?? this._lastKnownAudioState);
    }

    get videoEnabled() {
        return this.videoTracks.some(t => t?.enabled ?? this._lastKnownVideoState);
    }

    async verifyHardwareState(type) {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const hasDevice = devices.some(d => d.kind === `${type}input`);
            
            if (!hasDevice) {
                console.error(`${type} device not detected`);
                this[`_${type}Enabled`] = false;
                return false;
            }
            return true;
        } catch (error) {
            console.error(`Error verifying ${type} hardware:`, error);
            return false;
        }
    }
}

export default WebRTCService;