import React, { useState, useEffect, useRef } from 'react';
import { FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash, FaPhoneSlash } from 'react-icons/fa';
import { BsFillChatDotsFill } from 'react-icons/bs';
import WebRTCService from '../services/WebRTCService';
import '../main_styles/VideoCall.css';

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
  const [callDuration, setCallDuration] = useState(0);
  const webrtcRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const callTimerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [transcripts, setTranscripts] = useState([]);
  const [hasRemoteStream, setHasRemoteStream] = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [transcripts]);

  const [error, setError] = useState(null);

  const handleTranscription = (e) => {
    if (e.detail?.text?.trim()) {
      setTranscripts(prev => {
        // Prevent duplicate transcriptions
        if (prev.length > 0 && prev[prev.length-1].text === e.detail.text) {
          return prev;
        }
        return [
          ...prev,
          {
            text: e.detail.text,
            isLocal: e.detail.isLocal,
            speaker: e.detail.isLocal ? (isInitiator ? 'Therapist' : 'You') : (isInitiator ? 'Patient' : 'Therapist'),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ];
      });
    }
  };

  // Handle remote peer media state changes
  const handleRemoteMediaChange = (e) => {
    console.log('Remote media change event:', e.detail);
    if (e.detail.type === 'audio') {
      setRemoteAudioEnabled(e.detail.enabled);
    } else if (e.detail.type === 'video') {
      setRemoteVideoEnabled(e.detail.enabled);
    }
  };

  useEffect(() => {
    const transcriptHandler = (e) => {
      // Debounce transcription events
      clearTimeout(transcriptHandler.timeout);
      transcriptHandler.timeout = setTimeout(() => handleTranscription(e), 300);
    };
    
    document.addEventListener('transcription', transcriptHandler);
    webrtcRef.current?.setOnTranscript((text) => setTranscripts(prev => [...prev, text]));
    document.addEventListener('remote-media-change', handleRemoteMediaChange);
    
    return () => {
      clearTimeout(transcriptHandler.timeout);
      document.removeEventListener('transcription', transcriptHandler);
      document.removeEventListener('remote-media-change', handleRemoteMediaChange);
    };
  }, [isInitiator]);

  useEffect(() => {
    let isMounted = true;
    const initializeCall = async () => {
      try {
        setError(null);
        if (webrtcRef.current) {
          await webrtcRef.current.cleanup();
        }
        webrtcRef.current = new WebRTCService();
        webrtcRef.current.setOnRemoteStream((stream) => {
          console.log('Received remote stream:', stream);
          if (stream) {
            const videoTracks = stream.getVideoTracks();
            const audioTracks = stream.getAudioTracks();
            console.log(`Remote stream video tracks: ${videoTracks.length}, audio tracks: ${audioTracks.length}`);
            videoTracks.forEach(track => console.log(`Video track id: ${track.id}, enabled: ${track.enabled}, readyState: ${track.readyState}`));
            audioTracks.forEach(track => console.log(`Audio track id: ${track.id}, enabled: ${track.enabled}, readyState: ${track.readyState}`));
          }
          setHasRemoteStream(!!stream);
          setRemoteStream(stream);
          if (remoteVideoRef.current && stream) {
            try {
              // Check if stream is already set to avoid unnecessary updates
              if (remoteVideoRef.current.srcObject !== stream) {
                remoteVideoRef.current.srcObject = stream;
                remoteVideoRef.current.play().then(() => {
                  console.log('Remote video playing successfully');
                }).catch(error => {
                  console.error('Error playing remote video:', error);
                  setError('Failed to play remote video stream');
                });
              }
            } catch (error) {
              console.error('Error setting remote stream:', error);
              setError('Failed to set remote video stream');
            }
          }
        });
        webrtcRef.current.setOnDisconnected(() => {
          console.log('Connection disconnected');
          endCall();
        });
        webrtcRef.current.setOnMediaError((errorMessage) => {
          const message = `Media error: ${errorMessage}. Please check your camera and microphone permissions.`;
          console.error(message);
          setError(message);
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
            if (localVideoRef.current && localStream) {
              localVideoRef.current.srcObject = localStream;
              await localVideoRef.current.play();
            }
          } catch (error) {
            console.error('Failed to initialize call:', error);
            if (error.message?.includes('Therapist hasn\'t started')) {
              setError(error.message);
              return;
            }
            if (retryCount < maxRetries) {
              retryCount++;
              console.log(`Retrying initialization (${retryCount}/${maxRetries})...`);
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
              return attemptInitialize();
            }
            throw error;
          }
        };
        await attemptInitialize();
        return () => {
          document.removeEventListener('transcription', handleTranscription);
          if (callTimerRef.current) {
            clearInterval(callTimerRef.current);
            callTimerRef.current = null;
          }
        };
      } catch (error) {
        console.error('Failed to initialize call:', error);
        const errorMessage = error.message || 'Failed to initialize call';
        setError(`${errorMessage}. Please ensure your camera and microphone are connected and permissions are granted.`);
        endCall();
      }
    };
    initializeCall();
    return () => {
      if (webrtcRef.current) {
        webrtcRef.current.cleanup();
        webrtcRef.current = null;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = null;
        }
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }
      }
    };
  }, []); // Empty dependency array for mount/unmount only

  const toggleAudio = async () => {
    if (webrtcRef.current) {
      const enabled = await webrtcRef.current.toggleAudio();
      setIsMuted(!enabled);
    }
  };

  const toggleVideo = async () => {
    if (webrtcRef.current) {
      const enabled = await webrtcRef.current.toggleVideo();
      setIsVideoOn(enabled);
    }
  };

  const endCall = () => {
    if (webrtcRef.current) {
      webrtcRef.current.cleanup();
      webrtcRef.current = null;
    }
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    // Reset duration
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

  return (
    <div className="video-call-interface">
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      {/* Main Video Area */}
      {!error && <div className="video-container">
        <div className="remote-video">
          <video
            id="remoteVideo"
            ref={remoteVideoRef}
            autoPlay
            playsInline
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
        </div>
      </div>
      }

      {/* Call Controls */}
      <div className="call-controls">
        <button 
          className={`control-btn ${isMuted ? 'active' : ''}`}
          onClick={() => {
            const newMutedState = !isMuted;
            setIsMuted(newMutedState);
            if (webrtcRef.current) {
              webrtcRef.current.toggleAudio(!newMutedState);
            }
          }}
        >
          {isMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
          <span>{isMuted ? 'Unmute' : 'Mute'}</span>
        </button>
        
        <button 
          className={`control-btn ${!isVideoOn ? 'active' : ''}`}
          onClick={() => {
            const newVideoState = !isVideoOn;
            setIsVideoOn(newVideoState);
            if (webrtcRef.current) {
              webrtcRef.current.toggleVideo(newVideoState);
            }
          }}
        >
          {isVideoOn ? <FaVideo /> : <FaVideoSlash />}
          <span>{isVideoOn ? 'Video Off' : 'Video On'}</span>
        </button>
        
        <button className="control-btn end-call" onClick={endCall}>
          <FaPhoneSlash />
          <span>End Call</span>
        </button>
      </div>

      {/* Chat and Transcription */}
      <div className="analysis-container">
        <div className="chat-transcript">
          <div className="chat-header">
            <BsFillChatDotsFill />
            <h3>Session Transcript</h3>
          </div>
          <div className="messages-container">
            {transcripts.length === 0 ? (
              <div className="empty-transcript">
                <p>Waiting for conversation to start...</p>
              </div>
            ) : (
              <div className="messages">
                {transcripts.map((message, index) => (
                  <div
                    key={index}
                    className={`message ${message.isLocal ? 'local' : 'remote'}`}
                  >
                    <div className="message-header">
                      <span className="speaker">{message.speaker}</span>
                      <span className="timestamp">{message.timestamp}</span>
                    </div>
                    <div className="message-content">{message.text}</div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoCallInterface;