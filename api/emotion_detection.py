import os
import numpy as np
import librosa
import soundfile as sf
import io
import base64
import wave
import tempfile
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO
from transformers import pipeline, logging
from collections import Counter

# Suppress unnecessary warnings
logging.set_verbosity_error()

# Create temp directory if it doesn't exist
TEMP_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'temp_audio')
os.makedirs(TEMP_DIR, exist_ok=True)

# Initialize emotion recognition pipeline
try:
    emotion_pipeline = pipeline(
        "audio-classification",
        model="ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition",
        device="cpu"
    )
except Exception as e:
    print(f"Error loading emotion recognition model: {str(e)}")
    emotion_pipeline = None

# Initialize Flask app with CORS
app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:5173", "https://manoswara.loca.lt"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "bypass-tunnel-reminder", "tunnel-password", "ngrok-skip-browser-warning"]
    }
}, supports_credentials=True)

# Initialize SocketIO
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode='threading',
    ping_timeout=60
)

# Store emotion history
emotion_history = []

def get_fallback_emotion():
    return {
        'emotion': '01',  # neutral
        'confidence': 0.5,
        'is_fallback': True
    }

def ensure_emotion_pipeline():
    global emotion_pipeline
    if emotion_pipeline is None:
        try:
            emotion_pipeline = pipeline(
                "audio-classification",
                model="ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition",
                device="cpu"
            )
            return True
        except Exception as e:
            print(f"Failed to initialize emotion pipeline: {str(e)}")
            return False
    return True

def process_audio(audio_path):
    if not ensure_emotion_pipeline():
        return get_fallback_emotion()
    
    try:
        result = emotion_pipeline(audio_path)
        # Map model's emotion labels to our emotion codes
        emotion_mapping = {
            'angry': '05',
            'disgust': '07',
            'fear': '06',
            'happy': '03',
            'neutral': '01',
            'sad': '04',
            'surprise': '08',
            'calm': '02'
        }
        emotion_code = emotion_mapping.get(result[0]['label'].lower(), '01')
        return {
            'emotion': emotion_code,
            'confidence': result[0]['score'],
            'is_fallback': False
        }
    except Exception as e:
        print(f"Error processing audio: {str(e)}")
        return get_fallback_emotion()

@app.route('/analyze-complete-audio', methods=['POST', 'OPTIONS'])
def analyze_complete_audio():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    transcript = request.form.get('transcript', None)

    try:
        # Create a temporary file in our dedicated temp directory
        temp_filename = f"temp_{np.random.randint(10000)}.wav"
        temp_path = os.path.join(TEMP_DIR, temp_filename)
        
        # Save the file
        file.save(temp_path)
        
        # Process the audio
        result = process_audio(temp_path)
        
        # Add to emotion history if not fallback
        if not result['is_fallback']:
            emotion_history.append(result['emotion'])
        
        # Get most common emotion
        most_common = Counter(emotion_history).most_common(1)[0][0] if emotion_history else result['emotion']
        
        response = {
            'emotion': result['emotion'],
            'confidence': result['confidence'],
            'most_common_emotion': most_common,
            'is_fallback': result['is_fallback'],
            'transcript': transcript if transcript else ''
        }
        
        # Clean up
        if os.path.exists(temp_path):
            os.remove(temp_path)
            
        return jsonify(response)
        
    except Exception as e:
        # Clean up in case of error
        if 'temp_path' in locals() and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except:
                pass
        return jsonify({'error': str(e)}), 500

@socketio.on('stream-data')
def handle_stream_data(data):
    try:
        # Handle both string and dict data formats
        audio_data = data.get('audioData', data) if isinstance(data, dict) else data
        transcript_id = data.get('transcriptId') if isinstance(data, dict) else None
        timestamp = data.get('timestamp') if isinstance(data, dict) else None

        # Create temporary file in our dedicated temp directory
        temp_filename = f"stream_{np.random.randint(10000)}.wav"
        temp_path = os.path.join(TEMP_DIR, temp_filename)

        try:
            # Decode base64 audio data
            if isinstance(audio_data, str) and ',' in audio_data:
                audio_bytes = base64.b64decode(audio_data.split(',')[1])
            else:
                audio_bytes = base64.b64decode(audio_data)

            # Save decoded audio to temporary file
            with open(temp_path, 'wb') as f:
                f.write(audio_bytes)

            # Process audio
            result = process_audio(temp_path)

            # Emit result
            socketio.emit('emotion-prediction', {
                'emotion': result['emotion'],
                'confidence': result['confidence'],
                'is_fallback': result['is_fallback'],
                'transcriptId': transcript_id,
                'timestamp': timestamp
            })

        finally:
            # Clean up
            if os.path.exists(temp_path):
                os.remove(temp_path)

    except Exception as e:
        print(f"Error processing stream data: {str(e)}")
        socketio.emit('error', {'message': 'Error processing audio stream'})

@socketio.on('complete-recording')
def handle_complete_recording(data):
    try:
        # Create temporary file in our dedicated temp directory
        temp_filename = f"complete_{np.random.randint(10000)}.wav"
        temp_path = os.path.join(TEMP_DIR, temp_filename)

        try:
            # Decode base64 audio data
            if isinstance(data, str) and ',' in data:
                audio_bytes = base64.b64decode(data.split(',')[1])
            else:
                audio_bytes = base64.b64decode(data)

            # Save decoded audio to temporary file
            with open(temp_path, 'wb') as f:
                f.write(audio_bytes)

            # Process audio
            result = process_audio(temp_path)

            # Emit result
            socketio.emit('complete-emotion-analysis', result)

        finally:
            # Clean up
            if os.path.exists(temp_path):
                os.remove(temp_path)

    except Exception as e:
        print(f"Error processing complete recording: {str(e)}")
        socketio.emit('error', {'message': 'Error processing complete recording'})

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5001, debug=True)