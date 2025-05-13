import React, { useState, useRef, useEffect } from 'react';
import TherapistMainNavbar from './TherapistMainNavbar';
import { FaUpload, FaPlay, FaPause, FaWaveSquare, FaMicrophone } from 'react-icons/fa';
import { MdAudiotrack } from 'react-icons/md';
import { IoMdHeart } from 'react-icons/io';
import { io } from 'socket.io-client';
import '../main_styles/TherapistMainUploadPage.css';

const TherapistUploadPage = () => {
  const [audioFile, setAudioFile] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [emotion, setEmotion] = useState('neutral');
  const [emotionHistory, setEmotionHistory] = useState([]);
  const [mode, setMode] = useState('upload'); // 'upload' or 'record'
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorder = useRef(null);
  const socket = useRef(null);
  const audioRef = useRef(null);
  const progressRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);

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

  const emotions = [
    { name: 'Happy', color: '#4CAF50' },
    { name: 'Sad', color: '#2196F3' },
    { name: 'Angry', color: '#F44336' },
    { name: 'Neutral', color: '#9E9E9E' },
    { name: 'Surprised', color: '#FFC107' },
    { name: 'Fear', color: '#673AB7' },
    { name: 'Disgust', color: '#795548' },
    { name: 'Calm', color: '#009688' }
  ];

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.includes('audio')) {
      handleFileUpload(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.includes('audio')) {
      handleFileUpload(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      audioRef.current.pause();
      cancelAnimationFrame(animationRef.current);
    } else {
      audioRef.current.play();
      drawWaveform();
    }
    setIsPlaying(!isPlaying);
  };

  const handleProgressClick = (e) => {
    const rect = progressRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = pos * audioRef.current.duration;
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

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

  const drawWaveform = () => {
    if (!analyserRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyserRef.current.getByteTimeDomainData(dataArray);

      ctx.fillStyle = '#f9f9f9';
      ctx.fillRect(0, 0, width, height);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#7B68EE';
      ctx.beginPath();

      const sliceWidth = width / bufferLength;
      let x = 0;
      let lastY = height / 2;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          // Use quadratic curves for smoother lines
          const cpx = x - sliceWidth / 2;
          ctx.quadraticCurveTo(cpx, lastY, x, y);
        }

        lastY = y;
        x += sliceWidth;
      }

      // Add gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#9c7cf4');
      gradient.addColorStop(1, '#7B68EE');
      ctx.strokeStyle = gradient;
      ctx.stroke();
    };

    draw();
  };

  // Store recorded chunks for complete analysis
  const recordedChunks = useRef([]);
  
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Set up audio context and analyser for waveform
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      // Try to use the most compatible audio format with codecs
      let mimeType = 'audio/webm';
      let options = {
        audioBitsPerSecond: 128000 // Use a standard bitrate for better compatibility
      };
      
      // Check for specific codec support in order of preference
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4;codecs=mp4a.40.2',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/ogg'
      ];
      
      // Find the first supported mime type
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          options.mimeType = type;
          console.log(`Using audio format: ${mimeType}`);
          break;
        }
      }
      
      mediaRecorder.current = new MediaRecorder(stream, options);
      
      // Reset recorded chunks
      recordedChunks.current = [];
      
      setIsRecording(true);
      setEmotionHistory([]);
      
      mediaRecorder.current.ondataavailable = (event) => {
        try {
          if (event.data.size > 0) {
            // Store chunk for complete recording analysis
            recordedChunks.current.push(event.data);
            
            const reader = new FileReader();
            
            reader.onloadend = () => {
              try {
                if (socket.current) {
                  // Ensure we have a proper data URL format
                  const base64Data = reader.result.includes(',') 
                    ? reader.result // Send the full data URL if it's properly formatted
                    : `data:${mimeType};base64,${reader.result.split('base64,')[1] || reader.result}`;
                    
                  socket.current.emit('stream-data', base64Data);
                  
                  // We're now focusing on the final emotion analysis only
                  // No need to calculate dominant emotion in real-time
                }
              } catch (error) {
                console.error('Error processing audio chunk:', error);
                // Continue recording but log the error
              }
            };
            
            reader.onerror = (error) => {
              console.error('Error reading audio data:', error);
              alert('Error processing audio data. Please try again with a different browser.');
              stopRecording();
            };
            
            reader.readAsDataURL(event.data);
          } else {
            console.warn('Received empty audio chunk');
          }
        } catch (error) {
          console.error('Error in ondataavailable handler:', error);
          alert('Error handling audio data. Please try again.');
          stopRecording();
        }
      };
      
      // Add error handler for MediaRecorder
      mediaRecorder.current.onerror = (event) => {
        console.error('MediaRecorder error:', event.error);
        alert(`Recording error: ${event.error.message || 'Unknown error'}`);
        stopRecording();
      };

      mediaRecorder.current.start(1000); // Send data every second
      drawWaveform();
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  // Process the complete recording
  const processCompleteRecording = async () => {
    if (recordedChunks.current.length === 0) {
      console.warn('No recorded chunks available');
      return;
    }
    
    try {
      // Create a blob from all recorded chunks
      const blob = new Blob(recordedChunks.current);
      
      // Convert blob to base64
      const reader = new FileReader();
      
      reader.onloadend = () => {
        try {
          // Send the complete recording for analysis
          if (socket.current) {
            const base64Data = reader.result;
            socket.current.emit('complete-recording', base64Data);
          }
        } catch (error) {
          console.error('Error sending complete recording:', error);
        }
      };
      
      reader.onerror = (error) => {
        console.error('Error reading complete recording:', error);
      };
      
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Error processing complete recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);

      // Process the complete recording for analysis
      processCompleteRecording();

      // Clean up audio context and animation
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }
  };

  // Function to analyze the complete audio file
  const analyzeCompleteAudio = async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('http://localhost:5001/analyze-complete-audio', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const data = await response.json();
        setEmotion(data.emotion);
        setEmotionHistory([data.emotion]); // Set as single emotion for complete analysis
        return data;
      }
    } catch (error) {
      console.error('Error analyzing complete audio:', error);
    }
    return null;
  };

  useEffect(() => {
    // When audio starts playing, analyze the complete file once
    if (isPlaying && audioFile) {
      analyzeCompleteAudio(audioFile);
    }
    
    // Update progress bar smoothly
    let animationFrameId;
    if (isPlaying) {
      const updateProgress = () => {
        if (audioRef.current) {
          setCurrentTime(audioRef.current.currentTime);
          animationFrameId = requestAnimationFrame(updateProgress);
        }
      };
      updateProgress();
    }
    
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, audioFile]);
  
  // Handle audio file upload and analysis
  const handleFileUpload = async (file) => {
    if (file && file.type.includes('audio')) {
      setAudioFile(file);
      setEmotionHistory([]);
      
      // Analyze the complete audio file immediately
      await analyzeCompleteAudio(file);
      
      if (audioRef.current) {
        const audioURL = URL.createObjectURL(file);
        audioRef.current.src = audioURL;
        audioRef.current.onloadedmetadata = () => {
          setDuration(audioRef.current.duration);
          setupAudioContext();
        };
      }
    }
  };

  useEffect(() => {
    const audioElement = audioRef.current;
    
    const handleAudioEnd = async () => {
      setIsPlaying(false);
      // No need to calculate dominant emotion anymore
      // We're focusing on the single emotion result from complete analysis
    };
    
    if (audioElement) {
      audioElement.addEventListener('ended', handleAudioEnd);
    }
    
    return () => {
      if (audioElement) {
        audioElement.removeEventListener('ended', handleAudioEnd);
      }
    };
  }, [audioFile, emotionHistory]);
  
  useEffect(() => {
    socket.current = io('http://localhost:5001');

    // For streaming data, we'll still update the emotion state
    // but we'll focus on the final complete analysis
    socket.current.on('emotion-prediction', (data) => {
      setEmotion(data.emotion);
      setEmotionHistory(prev => [...prev, data.emotion]);
    });
    
    // Listen for complete recording analysis results
    socket.current.on('complete-emotion-analysis', (data) => {
      setEmotion(data.emotion);
      setEmotionHistory([data.emotion]); // Set as single emotion for complete analysis
    });

    socket.current.on('error', (error) => {
      console.error('Server error:', error);
      // Display error message to user
      if (isRecording) {
        // Stop recording if there's an error
        stopRecording();
        // Set a default emotion if error occurs
        setEmotion('01'); // Neutral
        
        // Provide a more user-friendly error message
        const errorMsg = error.message || 'Unknown error';
        let userMessage = 'Error processing audio.';
        
        if (errorMsg.includes('format') || errorMsg.includes('conversion') || errorMsg.includes('ffmpeg')) {
          userMessage = 'Your browser\'s audio format is not compatible. Please try using Chrome or Firefox, or try uploading an audio file instead.';
        } else if (errorMsg.includes('analyzing')) {
          userMessage = 'Error analyzing audio. Please try again with a different recording.';
        }
        
        alert(userMessage);
      }
    });
    
    // Add connection error handling
    socket.current.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      alert('Error connecting to the server. Please check your internet connection and try again.');
    });


    const audioElement = audioRef.current;
    
    // Update current time during playback
    const updateTime = () => {
      const audioElement = audioRef?.current;
      if (audioElement) {
        setCurrentTime(audioElement.currentTime);
      }
    };
    
    if (audioElement) {
      audioElement.addEventListener('timeupdate', updateTime);
    }
    
    return () => {
      if (audioElement) {
        audioElement.removeEventListener('timeupdate', updateTime);
      }
      if (socket.current) {
        socket.current.disconnect();
      }
    };
  }, []);

  return (
    <div className="therapist-upload-page">
      <TherapistMainNavbar />
      
      <main className="upload-main-content">
        <div className="mode-toggle">
          <button 
            className={`mode-btn ${mode === 'upload' ? 'active' : ''}`}
            onClick={() => setMode('upload')}
          >
            <FaUpload /> Upload Audio
          </button>
          <button 
            className={`mode-btn ${mode === 'record' ? 'active' : ''}`}
            onClick={() => setMode('record')}
          >
            <FaMicrophone /> Record Audio
          </button>
        </div>
        
        <h1>{mode === 'upload' ? 'Upload Patient Audio' : 'Record Patient Audio'}</h1>
        
        {mode === 'upload' ? (
          <div 
            className={`upload-container ${!audioFile ? 'empty' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
          {!audioFile ? (
            <div className="upload-prompt">
              <FaUpload className="upload-icon" />
              <p>Drag & drop audio file here or</p>
              <label className="file-input-label">
                <input 
                  type="file" 
                  accept="audio/*" 
                  onChange={handleFileChange}
                  className="file-input"
                />
                Browse Files
              </label>
              <p className="hint">Supports: MP3, WAV, AAC</p>
            </div>
          ) : (
            <div className="audio-player">
              <div className="audio-info">
                <MdAudiotrack className="audio-icon" />
                <div className="audio-details">
                  <h3>{audioFile.name}</h3>
                  <p>{formatTime(duration)} duration</p>
                </div>
              </div>
              
              <div className="player-controls">
                <button 
                  className="play-pause-btn"
                  onClick={togglePlayPause}
                >
                  {isPlaying ? <FaPause /> : <FaPlay />}
                </button>
                
                <div className="progress-container" ref={progressRef} onClick={handleProgressClick}>
                  <div 
                    className="progress-bar" 
                    style={{ width: `${(currentTime / duration) * 100}%` }}
                  ></div>
                </div>
                
                <div className="time-display">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
            </div>
          )}
          </div>
        ) : (
          <div className="audio-recorder">
            <canvas
              ref={canvasRef}
              width="600"
              height="200"
              style={{ border: '1px solid #e0e0e0', borderRadius: '8px', background: '#f9f9f9' }}
            />
            <div className="controls">
              {!isRecording ? (
                <button onClick={startRecording} className="record-btn">Start Recording</button>
              ) : (
                <button onClick={stopRecording} className="record-btn recording">Stop Recording</button>
              )}
            </div>
            {isRecording && (
              <div className="emotion-container recording-emotions">
                <h3>Emotion Analysis</h3>
                <div className="emotion-display">
                  <div className="emotion-circle-container">
                    <div 
                      className={`emotion-circle ${emotionMap[emotion] || emotion}`}
                      style={{ 
                        backgroundColor: emotions.find(e => e.name === (emotionMap[emotion] || emotion))?.color || '#9E9E9E'
                      }}
                    >
                      <IoMdHeart />
                      {emotionMap[emotion] || emotion}
                    </div>
                    <div className="emotion-circle-label">Detected Emotion</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
        {mode === 'upload' && audioFile && (
          <div className="analysis-section">
            <div className="waveform-container">
              <h3>
                <FaWaveSquare /> Audio Waveform
              </h3>
              <canvas 
                ref={canvasRef} 
                width={800} 
                height={200}
                className="waveform-canvas"
              ></canvas>
            </div>
            
            <div className="emotion-container">
              <h3>Emotion Analysis</h3>
              <div className="emotion-display">
                <div className="emotion-circle-container">
                  <div 
                    className={`emotion-circle ${emotion === emotions.find(e => e.name === (emotionMap[emotion] || emotion))?.name ? 'active' : ''}`}
                    style={{ 
                      backgroundColor: emotions.find(e => e.name === (emotionMap[emotion] || emotion))?.color || '#9E9E9E'
                    }}
                  >
                    <IoMdHeart />
                    {emotionMap[emotion] || emotion}
                  </div>
                  <div className="emotion-circle-label">Detected Emotion</div>
                </div>
              </div>
            </div>
          </div>
        )}
        

      </main>
      
      <audio ref={audioRef} />
    </div>
  );
};

export default TherapistUploadPage;