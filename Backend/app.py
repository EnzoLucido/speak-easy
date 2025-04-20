from flask import Flask, request, jsonify
from flask_cors import CORS
import parselmouth
import numpy as np
import os
import tempfile
import ffmpeg
import math

app = Flask(__name__)
CORS(app)

def safe_float(value):
    try:
        f = float(value)
        return f if np.isfinite(f) else None  # Convert NaN or inf to None (JSON will convert this to null)
    except:
        return None

def clean_json(data):
    if isinstance(data, dict):
        return {k: clean_json(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [clean_json(i) for i in data]
    elif isinstance(data, float) and (math.isnan(data) or math.isinf(data)):
        return None
    return data

@app.route('/analyze', methods=['POST'])
def analyze_audio():
    print("call to backend!")

    if 'audio' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    file = request.files['audio']

    with tempfile.NamedTemporaryFile(delete=False, suffix=".input") as temp_input, \
         tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_wav:

        file.save(temp_input.name)

        try:
            # Convert to proper WAV format using ffmpeg
            ffmpeg.input(temp_input.name).output(
                temp_wav.name,
                format='wav',
                acodec='pcm_s16le',  # 16-bit PCM format
                ac=1,                 # mono
                ar='16000'            # 16kHz sample rate (Praat-friendly)
            ).run(overwrite_output=True, quiet=True)

            # Use the converted WAV file for analysis
            snd = parselmouth.Sound(temp_wav.name)
            pitch = snd.to_pitch()
            pitch_values = pitch.selected_array['frequency']
            pitch_timestamps = pitch.xs()

            # Keep only voiced frames
            voiced = pitch_values > 0
            pitch_data = [
                {'x': float(t), 'y': safe_float(f)}
                for t, f in zip(pitch_timestamps, pitch_values)
                if f > 0
            ]

            # Formants
            formants = snd.to_formant_burg()
            duration = snd.get_total_duration()
            times = np.linspace(0, duration, int(max(1, duration*25)))
            f1 = [{'x': float(t), 'y': safe_float(formants.get_value_at_time(1, t))} for t in times]
            f2 = [{'x': float(t), 'y': safe_float(formants.get_value_at_time(2, t))} for t in times]
            f3 = [{'x': float(t), 'y': safe_float(formants.get_value_at_time(3, t))} for t in times]
            
            result = {
                'pitch': pitch_data,
                'f1': f1,
                'f2': f2,
                'f3': f3
            }

        except ffmpeg.Error as e:
            result = {'error': 'FFmpeg error: ' + e.stderr.decode()}
        except Exception as e:
            result = {'error': str(e)}

    # Clean up temporary files
    os.remove(temp_input.name)
    os.remove(temp_wav.name)
    print("Returning JSON sample:", result['pitch'][:3])
    return jsonify((clean_json(result)))

