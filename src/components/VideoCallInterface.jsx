import React, { useState, useEffect, useRef } from 'react';
import { FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash, FaPhoneSlash } from 'react-icons/fa';
import { BsFillChatDotsFill } from 'react-icons/bs';
import axios from 'axios'; // Added axios import
import WebRTCService from '../services/WebRTCService';
import { io } from 'socket.io-client';
import '../main_styles/VideoCall.css';
import TranscriptionChat from './TranscriptionChat';

const VideoCallInterface = ({
  isInitiator,
  roomId,
  remoteUserType,
  onCallEnd
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [remoteAudioEnabled, setRemoteAudioEnabled] = useState(true);
  const [remoteVideoEnabled, setRemoteVideoEnabled] = useState(true);
  const [remoteAudioMuted, setRemoteAudioMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const webrtcRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const callTimerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [transcripts, setTranscripts] = useState([]);
  const [emotions, setEmotions] = useState([]);
  const socket = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const mediaRecorder = useRef(null);
  const recordedChunks = useRef([]);
  const [hasRemoteStream, setHasRemoteStream] = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showTranscription, setShowTranscription] = useState(false);
  const [lastAnalysisTranscripts, setLastAnalysisTranscripts] = useState([]);
  const [lastAnalysisEmotions, setLastAnalysisEmotions] = useState([]);
  const [showTranscriptionBox, setShowTranscriptionBox] = useState(false);
  const audioRef = useRef(null);
  const [emotionDetectionStatus, setEmotionDetectionStatus] = useState('idle'); // Added for status tracking
  const [isFinalAnalysisPending, setIsFinalAnalysisPending] = useState(false); // Flag to trigger save on state update
  const [sessionEmotion, setSessionEmotion] = useState(null);
  const [sessionAnalyses, setSessionAnalyses] = useState([]);
  const [workingTranscripts, setWorkingTranscripts] = useState([]);
  const [workingEmotion, setWorkingEmotion] = useState(null);

  const emotionMap = {
    '01': 'Neutral',
    '02': 'Calm',
    '03': 'Happy',
    '04': 'Sad',
    '05': 'Angry',
    '06': 'Fear',
    '07': 'Disgust',
    '08': 'Surprise'
  };

  const emotionColors = [
    { name: 'Happy', color: '#4CAF50' },
    { name: 'Sad', color: '#2196F3' },
    { name: 'Angry', color: '#F44336' },
    { name: 'Neutral', color: '#9E9E9E' },
    { name: 'Surprise', color: '#FFC107' },
    { name: 'Fear', color: '#673AB7' },
    { name: 'Disgust', color: '#795548' },
    { name: 'Calm', color: '#009688' }
  ];

  // Function to send audio for emotion detection
  const sendAudioForEmotionDetection = async (isFinalAnalysis = false) => {
    if (recordedChunks.current.length === 0) {
      console.warn('No recorded chunks to send for emotion detection.');
      return;
    }
    setEmotionDetectionStatus('processing');
    console.log('Processing recorded chunks in onstop/sendAudioForEmotionDetection. Number of chunks:', recordedChunks.current.length);
    
    try {
      const audioBlob = new Blob(recordedChunks.current, { type: 'audio/webm' });
      console.log('Created audio blob:', {
        size: audioBlob.size,
        type: audioBlob.type,
        chunks: recordedChunks.current.length
      });
      
      // Get the actual transcript text from Deepgram if available
      let transcriptText = '';
      // Try to get the last transcript from DeepgramService or state
      if (transcripts.length > 0) {
        transcriptText = transcripts[transcripts.length - 1].text;
      }
      
      // Prepare form data
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio_segment.webm');
      if (transcriptText) {
        formData.append('transcript', transcriptText);
      }

      console.log('Sending audio blob for emotion detection. Size:', audioBlob.size);

      const response = await fetch('https://82c776d7f8f8.ngrok-free.app/analyze-complete-audio', {
        method: 'POST',
        headers: {
          'ngrok-skip-browser-warning': 'true',
          'bypass-tunnel-reminder': 'true',
          'Accept': 'application/json'
        },
        credentials: 'include',
        mode: 'cors',
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Emotion detection server error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`Emotion detection server responded with ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('Emotion detection response:', data);
      
      if (!data.emotion) {
        console.error('API Response:', data);
        throw new Error('No emotion data in response. Please check the emotion analysis service.');
      }
      
      if (!data.transcript) {
        console.warn('No transcript data in response. Using default text.');
        data.transcript = 'Patient speech analyzed';
      }

      const mappedEmotion = emotionMap[data.emotion] || 'Neutral';
      const emotionColor = emotionColors.find(e => e.name === mappedEmotion)?.color || '#9E9E9E';
      
      // Generate a unique id for both transcript and emotion
      const transcriptId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
      const newEmotion = {
        id: transcriptId, // Match transcript id
        emotion: mappedEmotion,
        timestamp: Date.now().toString(),
        displayTimestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }),
        color: emotionColor
      };
      console.log('Setting new emotion:', newEmotion);
      setEmotions(prev => [...prev, newEmotion]);

      // Use transcript from backend if available, otherwise fallback
      let finalTranscript = data.transcript && data.transcript !== '' ? data.transcript : transcriptText || 'Patient speech analyzed';
      // Prevent duplicate: only add if not already present
      const lastTranscript = transcripts[transcripts.length - 1];
      if (!lastTranscript || lastTranscript.text !== finalTranscript) {
        const newTranscript = {
          id: transcriptId, // Match emotion id
          text: finalTranscript,
          timestamp: newEmotion.timestamp,
          displayTimestamp: newEmotion.displayTimestamp,
          speaker: lastTranscript ? lastTranscript.speaker : (isInitiator ? 'Therapist' : 'Patient'),
          isLocal: false
        };
        setTranscripts(prevTranscripts => [...prevTranscripts, newTranscript]);
      }

      // Set the overall session emotion after analysis
      setSessionEmotion({
        emotion: mappedEmotion,
        color: emotionColor,
        displayTimestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      });

      setWorkingEmotion({
        emotion: mappedEmotion,
        color: emotionColor,
        displayTimestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      });

      if (isFinalAnalysis) {
        const emotionId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
        const now = Date.now().toString();
        setSessionAnalyses(prev => [...prev, {
          transcripts: workingTranscripts,
          emotion: {
            id: emotionId,
            emotion: mappedEmotion,
            timestamp: now,
            displayTimestamp: new Date(Number(now)).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            }),
            color: emotionColor
          }
        }]);
        setWorkingTranscripts([]);
        setWorkingEmotion(null);
      }

    } catch (error) {
      console.error('Error in sendAudioForEmotionDetection:', error);
      setError(`Failed to analyze audio: ${error.message}`);
    } finally {
      recordedChunks.current = []; // Clear chunks after processing
      if (isFinalAnalysis) {
        setIsFinalAnalysisPending(true); // Set flag to trigger save via useEffect
      }
    }
  };

  const toggleAnalysis = async () => {
    try {
      const newAnalysisState = !isAnalyzing;
      
      if (!newAnalysisState) {
        // Stopping analysis
        setIsAnalyzing(false); // Set state first
        if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
          console.log('Manually stopping recording via toggleAnalysis...');
          // The onstop handler will call sendAudioForEmotionDetection.
          // We need to ensure isFinalAnalysis is true for that call.
          // One way is to modify onstop or have a flag that onstop checks.
          // For simplicity here, we assume onstop will handle the final save if isAnalyzing is false.
          // A more robust solution might involve passing a parameter to stop() if the API supports it,
          // or setting a ref that onstop can check.
          mediaRecorder.current.onstop = () => {
            console.log('MediaRecorder onstop event triggered (from toggleAnalysis stop). State:', mediaRecorder.current?.state);
            sendAudioForEmotionDetection(true); // Pass true for isFinalAnalysis
          };
          mediaRecorder.current.stop();
        } else if (recordedChunks.current.length > 0) {
            // If recorder was already stopped or inactive but chunks exist (e.g. due to error handling)
            console.log('No active recorder, but chunks exist. Sending final analysis.');
            sendAudioForEmotionDetection(true); // isFinalAnalysis = true
        }
        return;
      }
  
      // Starting new analysis
      setIsAnalyzing(true); // Add this line to set analysis state
      setShowTranscriptionBox(true);
      setShowTranscription(true);
      
      // Start recording
      if (remoteStream && remoteStream.getAudioTracks && remoteStream.getAudioTracks().length > 0) {
        try {
          // Stop any existing recording first
          if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
            console.log('Stopping existing recording...');
            mediaRecorder.current.stop();
            // Wait for the recorder to actually stop
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          // Test available MIME types with more robust browser detection
          const mimeTypes = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/ogg',
            'audio/mp4',
            'audio/wav',
            '' // Empty string as fallback (browser default)
          ];
          
          let selectedMimeType = null;
          for (const mimeType of mimeTypes) {
            try {
              if (mimeType === '' || MediaRecorder.isTypeSupported(mimeType)) {
                selectedMimeType = mimeType;
                console.log(`Using MIME type: ${mimeType || 'browser default'}`); 
                break;
              }
            } catch (e) {
              console.warn(`Error checking support for ${mimeType}:`, e);
            }
          }
          
          if (!selectedMimeType) {
            throw new Error('No supported audio recording format found');
          }
          
          // Create recording options with or without mimeType
          const recordingOptions = selectedMimeType ? {
            mimeType: selectedMimeType,
            audioBitsPerSecond: 128000
          } : {
            audioBitsPerSecond: 128000
          };
          
          // Initialize and start MediaRecorder with better browser compatibility
          console.log('Checking audio tracks before initialization...');
          const audioTracks = remoteStream.getAudioTracks();
          console.log('Audio tracks:', audioTracks.length, 'First track settings:', audioTracks[0].getSettings());

          try {
            console.log('Initializing MediaRecorder with options:', recordingOptions);
            
            const isFirefox = navigator.userAgent.indexOf('Firefox') !== -1;
            const isChrome = navigator.userAgent.indexOf('Chrome') !== -1;
            const isEdge = navigator.userAgent.indexOf('Edg') !== -1;
            const isSafari = navigator.userAgent.indexOf('Safari') !== -1 && !isChrome;
            
            console.log('Browser detection:', { isFirefox, isChrome, isEdge, isSafari });
            
            // Ensure we are using a fresh clone of the remoteStream for MediaRecorder
            if (!remoteStream) {
              throw new Error('Remote stream is not available for recording.');
            }
            const streamForMediaRecorder = remoteStream.clone();
            console.log('Cloned stream for MediaRecorder:', streamForMediaRecorder.id);
            
            // Initialize MediaRecorder with preferred MIME type
            mediaRecorder.current = new MediaRecorder(streamForMediaRecorder, {
              mimeType: 'audio/webm;codecs=opus',
              audioBitsPerSecond: 128000
            });
            console.log('MediaRecorder state after initialization:', mediaRecorder.current.state);
            recordedChunks.current = [];
            
            // Set up event handlers
            mediaRecorder.current.ondataavailable = (event) => {
              if (event.data.size > 0) {
                recordedChunks.current.push(event.data);
                console.log('Received data chunk of size:', event.data.size, 'Total chunks:', recordedChunks.current.length);
              }
            };

            mediaRecorder.current.onstop = () => {
              console.log('MediaRecorder onstop event triggered. State:', mediaRecorder.current?.state);
              // When stopping analysis via toggle, isAnalyzing will be false.
              // Otherwise, it's an intermediate stop (e.g., timeslice).
              sendAudioForEmotionDetection(!isAnalyzing); 
            };
            
            mediaRecorder.current.onerror = (event) => {
              console.error('MediaRecorder error:', event.error);
              setError(`Recording error: ${event.error.message}`);
              setIsAnalyzing(false);
            };
            
            // Start recording with increased delay and additional validation
            await new Promise(resolve => setTimeout(resolve, 1000)); // Increased to 1 second
            console.log('Starting MediaRecorder after delay...');
            console.log('MediaRecorder state before start:', mediaRecorder.current.state);

            // Validate audio tracks immediately before starting
            const audioTracks = streamForMediaRecorder.getAudioTracks();
            if (audioTracks.length === 0) {
              throw new Error('No audio tracks found in the stream for MediaRecorder.');
            }
            for (const track of audioTracks) {
              console.log(`Audio track [${track.id}] state: readyState=${track.readyState}, enabled=${track.enabled}, muted=${track.muted}`);
              if (track.readyState !== 'live' || !track.enabled) {
                throw new Error(`Audio track [${track.id}] is not live or not enabled. State: readyState=${track.readyState}, enabled=${track.enabled}. Cannot start MediaRecorder.`);
              }
            }
            
            if (mediaRecorder.current.state === 'inactive') {
              console.log('Attempting to start MediaRecorder with timeslice 1000ms');
              mediaRecorder.current.start(1000); // Timeslice: emit data every 1 second
              // Only set isAnalyzing to true if start() does not throw an error immediately
              console.log('MediaRecorder started successfully (no immediate error)');
              setIsAnalyzing(true);
            } else {
              throw new Error(`MediaRecorder is in unexpected state: ${mediaRecorder.current.state}. Cannot start recording.`);
            }
          } catch (error) { // This catch is for errors during initialization or the start attempt
            console.error('Error during MediaRecorder start process (1st attempt):', error);
            // Fallback: try to re-initialize MediaRecorder with a more basic MIME type if possible
            if (error.name === 'NotSupportedError') {
              console.warn('Initial MediaRecorder.start() failed, trying with default browser codec...');
              if (remoteStream) {
                const fallbackStream = remoteStream.clone();
                try {
                  mediaRecorder.current = new MediaRecorder(fallbackStream, { audioBitsPerSecond: 128000 });
                  console.log('MediaRecorder initialized with default codec, state:', mediaRecorder.current.state);
                  
                  // Set up event handlers for fallback MediaRecorder
                  mediaRecorder.current.ondataavailable = (event) => {
                    console.log('Fallback MediaRecorder ondataavailable:', event.data.size, 'bytes');
                    if (event.data.size > 0) {
                      recordedChunks.current.push(event.data);
                      console.log('Total chunks after fallback data:', recordedChunks.current.length);
                    }
                  };

                  mediaRecorder.current.onstop = () => {
                    console.log('Fallback MediaRecorder onstop triggered. Chunks:', recordedChunks.current.length);
                    sendAudioForEmotionDetection(!isAnalyzing); // Pass true if stopping analysis
                  };

                  mediaRecorder.current.onerror = (event) => {
                    console.error('Fallback MediaRecorder error:', event.error);
                    setError(`Fallback recording error: ${event.error.message}`);
                    setIsAnalyzing(false);
                  };
                  
                  try {
                    mediaRecorder.current.start(1000);
                    console.log('MediaRecorder successfully started with default codec');
                    setIsAnalyzing(true);
                  } catch (startError) {
                    console.error('Failed to start MediaRecorder with default codec:', startError);
                    setError('Failed to start recording with default codec');
                    setIsAnalyzing(false);
                  }
                } catch (initError) {
                  console.error('Failed to initialize MediaRecorder with default codec:', initError);
                  setError('Failed to initialize recording with default codec');
                  setIsAnalyzing(false);
                }
              } else {
                console.error('Remote stream unavailable for recording');
                setError('Failed to start recording: Remote stream unavailable');
                setIsAnalyzing(false);
              }
            } else {
              setError(`Failed to start recording: ${error.message}`);
              setIsAnalyzing(false);
            }
          } // This closes the try block for MediaRecorder start process
        } catch (initError) { // This is the outer catch for the broader toggleAnalysis function
          console.error('Error initializing MediaRecorder or during analysis setup:', initError);
          setError(`Failed to initialize recording or analysis: ${initError.message}`);
            setIsAnalyzing(false);
          }
          
        // This extraneous catch block below is the source of the syntax error and will be removed.
        // } catch (error) {
        //   console.error('Error in recording setup:', error);
        //   setError(`Failed to start recording: ${error.message}`);
        //   setIsAnalyzing(false);
        //   return;
        // }
      } else {
        setError('No audio tracks found in remote stream. Cannot start recording.');
        setIsAnalyzing(false);
        return;
      }
    } catch (error) {
      console.error('Error in toggleAnalysis:', error);
      setError(`Analysis error: ${error.message}`);
      setIsAnalyzing(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [transcripts]);

  // Effect to handle remote stream changes
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream && remoteStream !== localStream) {
      try {
        if (remoteVideoRef.current.srcObject !== remoteStream) {
          remoteVideoRef.current.srcObject = remoteStream;
          remoteVideoRef.current.muted = remoteAudioMuted;
          remoteVideoRef.current.play().catch(e => console.error('Error playing remote video:', e));
        }
      } catch (error) {
        console.error('Error setting remote stream:', error);
      }
    }
  }, [remoteStream, remoteAudioMuted, localStream]);

  // Effect to handle local stream changes
  useEffect(() => {
    if (localVideoRef.current && localStream && localStream !== remoteStream) {
      try {
        if (localVideoRef.current.srcObject !== localStream) {
          localVideoRef.current.srcObject = localStream;
          localVideoRef.current.muted = true;
          localVideoRef.current.play().catch(e => console.error('Error playing local video:', e));
        }
      } catch (error) {
        console.error('Error setting local stream:', error);
      }
    }
  }, [localStream, remoteStream]);

  const [error, setError] = useState(null);

  const handleTranscription = (e) => {
    if (e.detail?.text?.trim()) {
      // Log details of the remote transcript event being processed on the therapist's side
      if (isInitiator && e.detail && !e.detail.isLocal && console && console.log) {
        console.log('[Therapist Log] handleTranscription for REMOTE speech - e.detail:', JSON.parse(JSON.stringify(e.detail)));
      }

      // Generate a unique id for this transcript
      const transcriptId = Date.now().toString() + Math.random().toString(36).substr(2, 5);

      // Add transcript to state
      setWorkingTranscripts(prev => {
        if (prev.length > 0 && prev[prev.length-1].text === e.detail.text && prev[prev.length-1].isLocal === e.detail.isLocal) {
          return prev; // Basic deduplication
        }

        let finalNumericTimestamp;
        const finalTranscriptId = transcriptId;

        if (e.detail.isLocal) {
          finalNumericTimestamp = e.detail.originalTimestamp || Date.now();
        } else {
          finalNumericTimestamp = Date.now();
        }

        return [
          ...prev,
          {
            id: transcriptId,
            text: e.detail.text,
            isLocal: e.detail.isLocal,
            speaker: e.detail.isLocal ? (isInitiator ? 'Therapist' : 'You') : (isInitiator ? 'Patient' : 'Therapist'),
            timestamp: finalNumericTimestamp,
            displayTimestamp: new Date(finalNumericTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            transcriptId: finalTranscriptId
          }
        ];
      });

      // Trigger emotion detection for every patient transcript
      if (!isInitiator && !e.detail.isLocal) { // Patient transcript (remote on therapist side)
        // Send audio for emotion detection (simulate by sending transcript text)
        // In a real app, you would send the audio chunk for this transcript
        fetch('https://82c776d7f8f8.ngrok-free.app/analyze-complete-audio', {
          method: 'POST',
          headers: {
            'ngrok-skip-browser-warning': 'true',
            'bypass-tunnel-reminder': 'true',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ transcript: e.detail.text, id: transcriptId })
        })
        .then(res => res.json())
        .then(data => {
          if (data && data.emotion) {
            setEmotions(prev => [...prev, {
              id: transcriptId,
              emotion: data.emotion,
              timestamp: Date.now().toString(),
              displayTimestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              color: '#9E9E9E' // You can map color as before
            }]);
          }
        })
        .catch(err => console.error('Emotion detection error:', err));
      }
    }
  };

  const handleRemoteMediaChange = (e) => {
    if (e.detail.type === 'audio') {
      setRemoteAudioEnabled(e.detail.enabled);
      if (!e.detail.enabled) {
        setRemoteAudioMuted(true);
      } else {
        setRemoteAudioMuted(false);
      }
    } else if (e.detail.type === 'video') {
      setRemoteVideoEnabled(e.detail.enabled);
    }
  };

  useEffect(() => {
    // Initialize socket connection for emotion detection with fallback URLs
    const serverUrls = [
      'https://82c776d7f8f8.ngrok-free.app'
    ];

    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds

    const connectWithFallback = async (urls, index = 0) => {
      if (index >= urls.length) {
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Retrying connection attempt ${retryCount} of ${maxRetries}...`);
          setTimeout(() => connectWithFallback(urls, 0), retryDelay);
          return;
        }
        console.error('Failed to connect to any emotion detection server after all retries');
        return;
      }

      try {
        if (socket.current) {
          socket.current.disconnect();
          socket.current.removeAllListeners();
        }

        socket.current = io(urls[index], {
          reconnectionAttempts: 5,
          timeout: 15000,
          transports: ['polling', 'websocket'],
          forceNew: true,
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          secure: true,
          rejectUnauthorized: false,
          extraHeaders: {
            'ngrok-skip-browser-warning': 'true'
          }
        });

        socket.current.on('connect', () => {
          console.log(`Successfully connected to ${urls[index]}`);
          retryCount = 0; // Reset retry count on successful connection
        });

        socket.current.on('connect_error', (error) => {
          console.error(`Connection error to ${urls[index]}:`, error);
          socket.current.disconnect();
          connectWithFallback(urls, index + 1);
        });

        socket.current.on('disconnect', (reason) => {
          console.log(`Disconnected from ${urls[index]}, reason: ${reason}`);
          if (reason === 'io server disconnect' || reason === 'transport close') {
            connectWithFallback(urls, index + 1);
          }
        });

        socket.current.on('error', (error) => {
          console.error(`Socket error on ${urls[index]}:`, error);
          socket.current.disconnect();
          connectWithFallback(urls, index + 1);
        });

        socket.current.on('emotion_result', (result) => {
          if (result && result.emotion) {
            setEmotions(prev => [...prev, {
              emotion: result.emotion,
              timestamp: Date.now(),
              displayTimestamp: new Date().toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
              })
            }]);
          }
        });

        socket.current.on('error_analysis', (error) => {
          console.error('Emotion analysis error:', error);
        });
      } catch (error) {
        console.error(`Failed to connect to ${urls[index]}:`, error);
        connectWithFallback(urls, index + 1);
      }
    };

    connectWithFallback(serverUrls);

    // Setup audio context for streaming
    const setupAudioContext = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
      }

      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }

      sourceRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
      sourceRef.current.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);
    };

    // Start audio streaming when remote stream is available
    const startAudioStreaming = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Set up audio context and analyser
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);
        
        // Configure media recorder
        mediaRecorder.current = new MediaRecorder(stream, {
          audioBitsPerSecond: 128000,
          mimeType: 'audio/webm;codecs=opus'
        });
        
        mediaRecorder.current.ondataavailable = (event) => {
          if (event.data.size > 0) {
            recordedChunks.current.push(event.data);
            const reader = new FileReader();
            
            reader.onloadend = () => {
              if (socket.current) {
                const base64Data = reader.result.includes(',') 
                  ? reader.result
                  : `data:audio/webm;base64,${reader.result.split('base64,')[1] || reader.result}`;
                
                socket.current.emit('stream-data', {
                  audioData: base64Data,
                  timestamp: Date.now()
                });
              }
            };
            
            reader.readAsDataURL(event.data);
          }
        };
        
        mediaRecorder.current.start(1000); // Send data every second
      } catch (error) {
        console.error('Error starting audio streaming:', error);
      }
    };

    socket.current.on('emotion-prediction', (data) => {
      if (isInitiator && console && console.log) { // Log only on therapist's side
        console.log('[Therapist Log] Received raw emotion-prediction event:', JSON.parse(JSON.stringify(data)));
      }
      // Ensure data is valid, not a fallback, contains an emotion, and has a numeric timestamp
      if (data && !data.is_fallback && data.emotion && typeof data.timestamp === 'number') {
        if (isInitiator && console && console.log) {
          console.log('[Therapist Log] Processing valid emotion data with numeric timestamp:', JSON.parse(JSON.stringify(data)));
        }
        setEmotions(prev => [...prev, {
          emotion: data.emotion,
          timestamp: data.timestamp, // Directly use the numeric timestamp from server
          transcriptId: data.transcriptId || null // Use transcriptId if available
        }]);
      } else if (data && !data.is_fallback && data.emotion) {
        // Log if a valid emotion event is received but timestamp is not numeric (for debugging)
        if (isInitiator && console && console.warn) {
          console.warn('[Therapist Log] Received emotion-prediction with non-numeric or missing timestamp:', JSON.parse(JSON.stringify(data)));
        }
      }
    });

    const transcriptHandler = (e) => {
      // Set originalTimestamp for local events if not already set
      if (e.detail?.isLocal && !e.detail.originalTimestamp) {
        e.detail.originalTimestamp = Date.now();
      }

      if (!isInitiator && e.detail?.isLocal) { // Patient's side, local speech
        if (socket.current && e.detail.audioData) {
          const transcriptId = Date.now().toString();
          const numericEventTimestamp = Date.now(); // Use numeric timestamp
          
          // Update event detail for patient's local handleTranscription call
          e.detail.transcriptId = transcriptId;
          e.detail.originalTimestamp = numericEventTimestamp; // Ensure this is the numeric one

          socket.current.emit('stream-data', {
            audioData: e.detail.audioData,
            transcriptId: transcriptId,
            timestamp: numericEventTimestamp, // Send numeric timestamp to server
            isLocal: true
          });
        }
      }
      
      // This part handles transcription display.
      // Therapist (isInitiator) processes all transcripts (local and remote).
      // Patient (!isInitiator) processes their own local transcripts for display.
      if (isInitiator) { // Therapist processing any transcript
        clearTimeout(transcriptHandler.timeout);
        transcriptHandler.timeout = setTimeout(() => handleTranscription(e), 300);
      } else if (e.detail?.isLocal) { // Patient processing their own local transcript
        clearTimeout(transcriptHandler.timeout);
        transcriptHandler.timeout = setTimeout(() => handleTranscription(e), 300); 
      }
    };
    
    const handleRemoteStreamUpdate = (e) => {
      if (e.detail) {
        setHasRemoteStream(true);
        setRemoteStream(e.detail);
      }
    };
    
    document.addEventListener('transcription', transcriptHandler);
    document.addEventListener('remote-stream-update', handleRemoteStreamUpdate);
    document.addEventListener('remote-media-change', handleRemoteMediaChange);
    webrtcRef.current?.setOnTranscript((text) => setTranscripts(prev => [...prev, text]));
    
    return () => {
      clearTimeout(transcriptHandler.timeout);
      document.removeEventListener('transcription', transcriptHandler);
      document.removeEventListener('remote-stream-update', handleRemoteStreamUpdate);
      document.removeEventListener('remote-media-change', handleRemoteMediaChange);
      if (socket.current) {
        socket.current.disconnect();
      }
    };
  }, [isInitiator]);

  useEffect(() => {
    const initializeCall = async () => {
      try {
        setError(null);
        if (webrtcRef.current) {
          await webrtcRef.current.cleanup();
        }
        webrtcRef.current = new WebRTCService();

        // Set up stream handlers before initialization
        webrtcRef.current.setOnRemoteStream((stream) => {
          if (stream) {
            setHasRemoteStream(true);
            setRemoteStream(stream);
            setRemoteAudioEnabled(true);
            setRemoteVideoEnabled(true);
            setRemoteAudioMuted(false);
          } else {
            setHasRemoteStream(false);
            setRemoteStream(null);
          }
        });

        webrtcRef.current.setOnDisconnected(() => {
          setHasRemoteStream(false);
          setRemoteStream(null);
          endCall();
        });

        webrtcRef.current.setOnMediaError((errorMessage) => {
          setError(errorMessage);
          endCall();
        });

        let retryCount = 0;
        const maxRetries = 3;
        
        const attemptInitialize = async () => {
          try {
            const localStream = await webrtcRef.current.initialize(roomId, isInitiator, (startTime) => {
              callTimerRef.current = setInterval(() => {
                const elapsed = Math.floor((Date.now() - startTime) / 1000);
                setCallDuration(elapsed);
              }, 1000);
            });

            if (localStream) {
              setLocalStream(localStream);
              if (localVideoRef.current) {
                localVideoRef.current.srcObject = localStream;
                await localVideoRef.current.play().catch(e => {
                  console.error('Error playing local video:', e);
                  // Try to recover by retrying play()
                  setTimeout(() => localVideoRef.current.play(), 1000);
                });
              }
            } else {
              throw new Error('Failed to get local media stream');
            }
          } catch (error) {
            if (error.message?.includes('Therapist hasn\'t started')) {
              setError(error.message);
              return;
            }
            if (retryCount < maxRetries) {
              retryCount++;
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
              return attemptInitialize();
            }
            throw error;
          }
        };

        await attemptInitialize();

        return () => {
          if (callTimerRef.current) {
            clearInterval(callTimerRef.current);
            callTimerRef.current = null;
          }
        };
      } catch (error) {
        console.error('Call initialization error:', error);
        setError(error.message || 'Failed to initialize call');
        endCall();
      }
    };

    initializeCall();

    return () => {
      if (webrtcRef.current) {
        webrtcRef.current.cleanup();
        webrtcRef.current = null;
      }
      if (localVideoRef.current) {
        const tracks = localVideoRef.current.srcObject?.getTracks() || [];
        tracks.forEach(track => track.stop());
        localVideoRef.current.srcObject = null;
      }
      if (remoteVideoRef.current) {
        const tracks = remoteVideoRef.current.srcObject?.getTracks() || [];
        tracks.forEach(track => track.stop());
        remoteVideoRef.current.srcObject = null;
      }
      setLocalStream(null);
      setRemoteStream(null);
      setHasRemoteStream(false);
    };
  }, [roomId, isInitiator]); 

  const toggleAudio = async () => {
    if (webrtcRef.current) {
      const enabled = await webrtcRef.current.toggleAudio();
      setIsMuted(!enabled);
      // Emit media change event for remote peer
      const event = new CustomEvent('remote-media-change', {
        detail: { type: 'audio', enabled: enabled }
      });
      document.dispatchEvent(event);
    }
  };

  const toggleVideo = async () => {
    if (webrtcRef.current) {
      const enabled = await webrtcRef.current.toggleVideo();
      setIsVideoOn(enabled);
      // Emit media change event for remote peer
      const event = new CustomEvent('remote-media-change', {
        detail: { type: 'video', enabled: enabled }
      });
      document.dispatchEvent(event);
    }
  };

  const endCall = async () => {
    // Save session data before ending the call
    if (sessionAnalyses.length > 0) {
      await saveSessionData();
    }

    if (isAnalyzing) {
      // If analysis is running, stop it and ensure data is saved
      console.log('Call ended during analysis. Stopping analysis and saving data.');
      setIsAnalyzing(false); // This will trigger the logic in toggleAnalysis to stop and save
      if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
        mediaRecorder.current.onstop = () => {
          console.log('MediaRecorder onstop from endCall. State:', mediaRecorder.current?.state);
          sendAudioForEmotionDetection(true); // Ensure final save
        };
        mediaRecorder.current.stop();
      } else if (recordedChunks.current.length > 0) {
        await sendAudioForEmotionDetection(true); // Ensure final save if chunks exist
      } else {
        // If no chunks and recorder inactive, but analysis was 'on',
        // and if there's data in lastAnalysis states, attempt a save.
        if (lastAnalysisTranscripts.length > 0 && lastAnalysisEmotions.length > 0) {
          await saveSessionData();
        }
      }
    }

    if (webrtcRef.current) {
      webrtcRef.current.cleanup();
      webrtcRef.current = null;
    }
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    setCallDuration(0);
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    if (onCallEnd) {
      onCallEnd();
    }
  };

  const saveSessionData = async () => {
    const token = localStorage.getItem('token');
    const patientId = localStorage.getItem('currentPatientId');
    const therapistId = localStorage.getItem('therapistId');
    const roomName = localStorage.getItem('currentRoomId');

    console.log('[DEBUG] [saveSessionData] Retrieved from localStorage:', { patientId, therapistId, roomName });

    if (!patientId || !therapistId || !roomName || !sessionAnalyses || !Array.isArray(sessionAnalyses) || sessionAnalyses.length === 0) {
      console.error('[DEBUG] Missing data for saving session:', { patientId, therapistId, roomName, sessionAnalyses });
      return;
    }

    const sessionPayload = {
      patientId,
      therapistId,
      roomName,
      analyses: sessionAnalyses,
      sessionDate: new Date().toISOString(),
      // overallAnalysis: {} // Populate if available
    };
    console.log('[DEBUG] Payload to backend:', sessionPayload);

    try {
      console.log('[DEBUG] Attempting to save session data:', sessionPayload);
      const response = await axios.post('/api/calls/save-session', sessionPayload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('[DEBUG] Session data saved successfully:', response.data);
    } catch (error) {
      console.error('[DEBUG] Failed to save session data:', error.response ? error.response.data : error.message);
      // Optionally, notify the user of the save failure
    }
  };

  return (
    <div className="video-call-interface">
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      {!error && <div className="video-container">
        <div className="remote-video">
          <video
            id="remoteVideo"
            ref={remoteVideoRef}
            autoPlay
            playsInline
            muted={remoteAudioMuted}
            className="video-stream"
          />
          <div className="video-controls-overlay">
            <div className="call-duration">
              {Math.floor(callDuration / 60)}:{String(callDuration % 60).padStart(2, '0')}
            </div>
            
            {!remoteAudioEnabled && (
              <div className="remote-muted-indicator">
                <FaMicrophoneSlash /> Remote audio muted
              </div>
            )}
            {!remoteVideoEnabled && (
              <div className="remote-video-off-indicator">
                <FaVideoSlash /> Remote video off
              </div>
            )}
          </div>
        </div>
        <div className="local-video">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="video-stream-small"
          />
          <div className="video-label">You</div>
        </div>
      </div>}

      <div className="call-controls">
        <button 
          className={`control-btn ${isMuted ? 'active' : ''}`}
          onClick={toggleAudio}
        >
          {isMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
          <span>{isMuted ? 'Unmute' : 'Mute'}</span>
        </button>
        <button 
          className={`control-btn ${!isVideoOn ? 'active' : ''}`}
          onClick={toggleVideo}
        >
          {isVideoOn ? <FaVideo /> : <FaVideoSlash />}
          <span>{isVideoOn ? 'Video Off' : 'Video On'}</span>
        </button>
        {/* Only show remote audio mute/unmute for patient (not initiator/therapist) */}
        {!isInitiator && (
          <button
            className={`control-btn ${remoteAudioMuted ? 'active' : ''}`}
            onClick={() => {
              const newRemoteAudioMuted = !remoteAudioMuted;
              setRemoteAudioMuted(newRemoteAudioMuted);
              if (remoteVideoRef.current) {
                remoteVideoRef.current.muted = newRemoteAudioMuted;
                if (!newRemoteAudioMuted) {
                  remoteVideoRef.current.play().catch(e => console.error('Error playing remote video after unmute:', e));
                }
              }
            }}
            title={remoteAudioMuted ? 'Unmute Remote Audio' : 'Mute Remote Audio'}
          >
            {remoteAudioMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
            <span>{remoteAudioMuted ? 'Unmute Remote Audio' : 'Mute Remote Audio'}</span>
          </button>
        )}
        <button className="control-btn end-call" onClick={endCall}>
          <FaPhoneSlash />
          <span>End Call</span>
        </button>
        {isInitiator && (
          <button 
            onClick={toggleAnalysis} 
            className={`control-btn ${isAnalyzing ? 'active' : ''}`}
            style={{
              backgroundColor: isAnalyzing ? '#ff4444' : '#4CAF50',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <BsFillChatDotsFill />
            <span>{isAnalyzing ? 'Stop Analysis' : 'Start Analysis'}</span>
          </button>
        )}
      </div>

      {showTranscription && (
        <div className="transcription-container" style={{ marginTop: '20px' }}>
          {console.log('Rendering TranscriptionChat with:', {
            sessionAnalyses
          })}
          <TranscriptionChat
            sessionAnalyses={sessionAnalyses}
          />
        </div>
      )}
    </div>
  );
};

export default VideoCallInterface;
