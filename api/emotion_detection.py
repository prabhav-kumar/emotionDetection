import os
import numpy as np
import librosa
import soundfile as sf
import io
import base64
import wave
import struct
import tempfile
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
from flask_cors import CORS
from flask_socketio import SocketIO
from transformers import pipeline
from collections import Counter

# Initialize the emotion recognition pipeline
try:
    emotion_pipeline = pipeline("audio-classification", model="ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition")
except Exception as e:
    print(f"Error loading emotion recognition model: {str(e)}")
    print("Please install required packages: pip install transformers torch")
    emotion_pipeline = None

# Store emotion history
emotion_history = []



app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://localhost:5173"}})
socketio = SocketIO(app, cors_allowed_origins="http://localhost:5173")

@app.errorhandler(500)
def handle_500_error(_error):
    return jsonify({'error': 'Internal Server Error', 'message': 'An error occurred processing your request'}), 500

@app.errorhandler(400)
def handle_400_error(_error):
    return jsonify({'error': 'Bad Request', 'message': 'Invalid request parameters'}), 400

# Initialize fallback emotion detection if the pipeline fails
def get_fallback_emotion():
    """Returns a default emotion prediction when the main pipeline is unavailable."""
    return {
        'label': 'neutral',
        'score': 0.5
    }

# Function to ensure the emotion pipeline is available
def ensure_emotion_pipeline():
    global emotion_pipeline
    if emotion_pipeline is None:
        try:
            # Try to initialize the pipeline again
            emotion_pipeline = pipeline("audio-classification", model="ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition")
            return True
        except Exception as e:
            print(f"Failed to initialize emotion pipeline: {str(e)}")
            return False
    return True

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    # Try to ensure emotion pipeline is available
    if not emotion_pipeline and not ensure_emotion_pipeline():
        fallback = get_fallback_emotion()
        return jsonify({
            'emotion': fallback['label'],
            'confidence': fallback['score'],
            'most_common_emotion': fallback['label'],
            'is_fallback': True
        })
    
    filename = secure_filename(file.filename)
    temp_path = os.path.join('temp_audio', filename)
    os.makedirs('temp_audio', exist_ok=True)
    
    try:
        file.save(temp_path)
        
        try:
            # Predict emotion using the Hugging Face pipeline
            result = emotion_pipeline(temp_path)
            
            # Get the predicted emotion and confidence
            predicted_emotion = result[0]['label']
            confidence = result[0]['score']
            
            # Add to emotion history
            emotion_history.append(predicted_emotion)
            
            # Get the most frequent emotion
            if emotion_history:
                most_common_emotion = Counter(emotion_history).most_common(1)[0][0]
            else:
                most_common_emotion = predicted_emotion
            
            return jsonify({
                'emotion': predicted_emotion,
                'confidence': confidence,
                'most_common_emotion': most_common_emotion,
                'is_fallback': False
            })
            
        except Exception as e:
            print(f"Error processing audio: {str(e)}")
            fallback = get_fallback_emotion()
            return jsonify({
                'emotion': fallback['label'],
                'confidence': fallback['score'],
                'most_common_emotion': fallback['label'],
                'is_fallback': True
            })
            
    except Exception as e:
        print(f"Error saving or processing file: {str(e)}")
        return jsonify({'error': 'Error processing audio file'}), 500
        
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception as e:
                print(f"Error removing temporary file: {str(e)}")

# Process complete audio file and analyze emotions
def process_audio_file(file_path):
    """Process a complete audio file and return emotion analysis results"""
    # Try to ensure emotion pipeline is available
    if not emotion_pipeline and not ensure_emotion_pipeline():
        return get_fallback_emotion()
    
    try:
        # Use the Hugging Face pipeline for prediction on the complete file
        result = emotion_pipeline(file_path)
        
        # Get the predicted emotion and confidence
        predicted_emotion = result[0]['label']
        confidence = result[0]['score']
        
        # Return the emotion analysis results
        return {
            'emotion': predicted_emotion,
            'confidence': confidence,
            'is_fallback': False
        }
    except Exception as e:
        print(f"Error processing complete audio file: {str(e)}")
        return get_fallback_emotion()

@app.route('/analyze-complete-audio', methods=['POST'])
def analyze_complete_audio():
    """Endpoint to analyze a complete audio file"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    # Create a temporary file
    filename = secure_filename(file.filename)
    temp_path = os.path.join('temp_audio', filename)
    os.makedirs('temp_audio', exist_ok=True)
    
    try:
        file.save(temp_path)
        
        # Process the complete audio file
        result = process_audio_file(temp_path)
        
        return jsonify(result)
    except Exception as e:
        print(f"Error analyzing complete audio: {str(e)}")
        return jsonify({'error': 'Error processing audio file'}), 500
    finally:
        # Clean up the temporary file
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception as e:
                print(f"Error removing temporary file: {str(e)}")

# Store recorded audio chunks for complete processing
recorded_chunks = {}

@socketio.on('stream-data')
def handle_stream_data(data):
    # Try to ensure emotion pipeline is available
    if not emotion_pipeline:
        if not ensure_emotion_pipeline():
            fallback = get_fallback_emotion()
            socketio.emit('emotion-prediction', {
                'emotion': fallback['label'],
                'confidence': fallback['score'],
                'most_common_emotion': fallback['label'],
                'is_fallback': True
            })
            return
        
    # Create unique temporary file names
    temp_id = np.random.randint(10000)
    temp_dir = 'temp_audio'
    os.makedirs(temp_dir, exist_ok=True)
    
    # Define temporary WAV file
    temp_wav = f"{temp_dir}/stream_{temp_id}.wav"
    temp_files = [temp_wav]
    
    try:
        # Decode the base64 audio data - handle different formats safely
        try:
            # If data contains a comma (like 'data:audio/webm;base64,XXXX')
            if isinstance(data, str) and ',' in data:
                audio_bytes = base64.b64decode(data.split(',')[1])
            else:
                audio_bytes = base64.b64decode(data)
        except Exception as decode_error:
            print(f"Error decoding audio data: {str(decode_error)}")
            fallback = get_fallback_emotion()
            socketio.emit('emotion-prediction', {
                'emotion': fallback['label'],
                'confidence': fallback['score'],
                'most_common_emotion': fallback['label'],
                'is_fallback': True
            })
            return
        
        # Convert base64 audio data to WAV file with proper headers
        try:
            # Validate and preprocess audio bytes
            if len(audio_bytes) == 0:
                raise ValueError("Empty audio data")
                
            # Calculate padding needed for float32 alignment (4 bytes)
            padding_needed = len(audio_bytes) % 4
            if padding_needed != 0:
                padding = b'\x00' * (4 - padding_needed)
                audio_bytes = audio_bytes + padding
                
            try:
                # Convert to float32 array with proper alignment
                audio_array = np.frombuffer(audio_bytes, dtype=np.float32)
                if len(audio_array) == 0:
                    raise ValueError("Failed to convert audio data to float32 array")
            except ValueError as ve:
                raise ValueError(f"Buffer size error: {str(ve)}")
            except Exception as e:
                raise ValueError(f"Error processing audio data: {str(e)}")
            
            # Normalize and convert to 16-bit PCM with proper scaling
            max_val = np.max(np.abs(audio_array))
            if max_val > 0:
                audio_array = np.clip(audio_array / max_val, -1.0, 1.0)
                audio_array = (audio_array * 32767.0).astype(np.int16)
            else:
                audio_array = np.zeros_like(audio_array, dtype=np.int16)
            
            # Create WAV file with proper headers
            with wave.open(temp_wav, 'wb') as wav_file:
                wav_file.setnchannels(1)  # Mono
                wav_file.setsampwidth(2)  # 2 bytes per sample
                wav_file.setframerate(16000)  # 16kHz sample rate
                wav_file.writeframes(audio_array.tobytes())
            
            # Verify the file was created properly
            if not os.path.exists(temp_wav) or os.path.getsize(temp_wav) == 0:
                raise ValueError("Failed to create valid WAV file")
                
            # Load the audio for processing using soundfile
            audio_data, sample_rate = sf.read(temp_wav)
            
            # Ensure correct sample rate
            if sample_rate != 16000:
                audio_length = len(audio_data)
                audio_data = np.interp(
                    np.linspace(0, audio_length, int(audio_length * 16000 / sample_rate)),
                    np.linspace(0, audio_length, audio_length),
                    audio_data
                )
                # Save resampled audio with proper WAV headers
                with wave.open(temp_wav, 'wb') as wav_file:
                    wav_file.setnchannels(1)
                    wav_file.setsampwidth(2)
                    wav_file.setframerate(16000)
                    wav_file.writeframes(audio_data.astype(np.int16).tobytes())
            
        except Exception as convert_error:
            print(f"Error converting audio data: {str(convert_error)}")
            fallback = get_fallback_emotion()
            socketio.emit('emotion-prediction', {
                'emotion': fallback['label'],
                'confidence': fallback['score'],
                'most_common_emotion': fallback['label'],
                'is_fallback': True
            })
            return
        
        try:
            # Use the Hugging Face pipeline for prediction
            result = emotion_pipeline(temp_wav)
            
            # Get the predicted emotion and confidence
            predicted_emotion = result[0]['label']
            confidence = result[0]['score']
            
            # Add to emotion history
            emotion_history.append(predicted_emotion)
            
            # Get the most frequent emotion
            if emotion_history:
                most_common_emotion = Counter(emotion_history).most_common(1)[0][0]
            else:
                most_common_emotion = predicted_emotion
            
            # Emit the prediction back to the client
            socketio.emit('emotion-prediction', {
                'emotion': predicted_emotion,
                'confidence': confidence,
                'most_common_emotion': most_common_emotion,
                'is_fallback': False
            })
            
        except Exception as process_error:
            print(f"Error analyzing audio: {str(process_error)}")
            fallback = get_fallback_emotion()
            socketio.emit('emotion-prediction', {
                'emotion': fallback['label'],
                'confidence': fallback['score'],
                'most_common_emotion': fallback['label'],
                'is_fallback': True
            })
        
        finally:
            # Always clean up temporary files
            for f in temp_files:
                if os.path.exists(f):
                    try:
                        os.remove(f)
                    except Exception as cleanup_error:
                        print(f"Error removing temporary file {f}: {str(cleanup_error)}")
        
    except Exception as e:
        # Log the error for debugging
        print(f"Unhandled exception in handle_stream_data: {str(e)}")
        
        # Send a user-friendly error message
        socketio.emit('error', {'message': 'An error occurred while processing your audio. Please try again or use a different browser.'})
        
        # Make sure to clean up any temporary files
        try:
            for f in temp_files:
                if os.path.exists(f):
                    os.remove(f)
        except Exception as cleanup_error:
            print(f"Error during emergency cleanup: {str(cleanup_error)}")

@socketio.on('complete-recording')
def handle_complete_recording(data):
    """Process the complete recording after it's finished"""
    # Create unique temporary file name
    temp_id = np.random.randint(10000)
    temp_dir = 'temp_audio'
    os.makedirs(temp_dir, exist_ok=True)
    temp_wav = f"{temp_dir}/complete_recording_{temp_id}.wav"
    
    try:
        # Decode the base64 audio data
        if isinstance(data, str) and ',' in data:
            audio_bytes = base64.b64decode(data.split(',')[1])
        else:
            audio_bytes = base64.b64decode(data)
            
        # Save the complete audio to a WAV file
        try:
            # Process audio bytes to create a valid WAV file
            if len(audio_bytes) == 0:
                raise ValueError("Empty audio data")
                
            # Convert to proper format and save as WAV
            with open(temp_wav, 'wb') as f:
                f.write(audio_bytes)
                
            # Process the complete audio file
            result = process_audio_file(temp_wav)
            
            # Emit the complete analysis results
            socketio.emit('complete-emotion-analysis', result)
            
        except Exception as e:
            print(f"Error processing complete recording: {str(e)}")
            fallback = get_fallback_emotion()
            socketio.emit('complete-emotion-analysis', {
                'emotion': fallback['label'],
                'confidence': fallback['score'],
                'is_fallback': True
            })
    except Exception as e:
        print(f"Error handling complete recording: {str(e)}")
        socketio.emit('error', {'message': 'Error processing complete recording'})
    finally:
        # Clean up temporary file
        if os.path.exists(temp_wav):
            try:
                os.remove(temp_wav)
            except Exception as e:
                print(f"Error removing temporary file: {str(e)}")

if __name__ == '__main__':
    socketio.run(app, port=5001, debug=True)