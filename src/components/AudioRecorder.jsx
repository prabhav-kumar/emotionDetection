import { useState, useRef, useEffect } from 'react';
import { io } from 'socket.io-client';

const AudioRecorder = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [emotions, setEmotions] = useState([]);
    const [dominantEmotion, setDominantEmotion] = useState(null);
    const mediaRecorder = useRef(null);
    const socket = useRef(null);
    const canvasRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const animationFrameRef = useRef(null);

    useEffect(() => {
        socket.current = io('http://localhost:5001');

        socket.current.on('emotion-prediction', (data) => {
            setEmotions(prev => [...prev, data.emotion]);
        });

        socket.current.on('error', (error) => {
            console.error('Server error:', error);
        });

        return () => {
            if (socket.current) {
                socket.current.disconnect();
            }
        };
    }, []);

    const drawWaveform = () => {
        if (!analyserRef.current || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const analyser = analyserRef.current;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            animationFrameRef.current = requestAnimationFrame(draw);
            analyser.getByteTimeDomainData(dataArray);

            ctx.fillStyle = 'rgb(200, 200, 200)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgb(0, 0, 0)';
            ctx.beginPath();

            const sliceWidth = canvas.width * 1.0 / bufferLength;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = v * canvas.height / 2;

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }

                x += sliceWidth;
            }

            ctx.lineTo(canvas.width, canvas.height / 2);
            ctx.stroke();
        };

        draw();
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Set up audio context and analyser for waveform
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            analyserRef.current = audioContextRef.current.createAnalyser();
            const source = audioContextRef.current.createMediaStreamSource(stream);
            source.connect(analyserRef.current);
            
            mediaRecorder.current = new MediaRecorder(stream);
            setIsRecording(true);
            setEmotions([]);
            
            mediaRecorder.current.ondataavailable = (event) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    if (socket.current) {
                        socket.current.emit('stream-data', reader.result);
                    }
                };
                reader.readAsDataURL(event.data);
            };

            mediaRecorder.current.start(1000); // Send data every second
            drawWaveform();
        } catch (error) {
            console.error('Error accessing microphone:', error);
        }
    };

    const stopRecording = () => {
        if (mediaRecorder.current && isRecording) {
            mediaRecorder.current.stop();
            mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
            setIsRecording(false);

            // Calculate dominant emotion
            const emotionCounts = emotions.reduce((acc, emotion) => {
                acc[emotion] = (acc[emotion] || 0) + 1;
                return acc;
            }, {});

            const dominant = Object.entries(emotionCounts)
                .sort(([,a], [,b]) => b - a)[0]?.[0];
            setDominantEmotion(dominant);

            // Clean up audio context and animation
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        }
    };

    return (
        <div className="audio-recorder">
            <canvas
                ref={canvasRef}
                width="600"
                height="200"
                style={{ border: '1px solid black' }}
            />
            <div className="controls">
                {!isRecording ? (
                    <button onClick={startRecording}>Start Recording</button>
                ) : (
                    <button onClick={stopRecording}>Stop Recording</button>
                )}
            </div>
            {dominantEmotion && !isRecording && (
                <div className="emotion-result">
                    <h3>Dominant Emotion: {dominantEmotion}</h3>
                </div>
            )}
        </div>
    );
};

export default AudioRecorder;