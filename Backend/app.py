from flask import Flask, request, jsonify
from flask_cors import CORS
import parselmouth
import numpy as np
import os
import tempfile

app = Flask(__name__)
CORS(app)

@app.route('/analyze', methods=['POST'])
def analyze_audio():
    if 'audio' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    file = request.files['audio']

    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_audio:
        file.save(temp_audio.name)
        try:
            snd = parselmouth.Sound(temp_audio.name)
            pitch = snd.to_pitch()
            pitch_values = pitch.selected_array['frequency']
            pitch_timestamps = pitch.xs()

            # Keep only voiced frames
            voiced = pitch_values > 0
            pitch_data = [
                {'x': float(t), 'y': float(f)}
                for t, f in zip(pitch_timestamps, pitch_values)
                if f > 0
            ]

            # Formants
            formants = snd.to_formant_burg()
            duration = snd.get_total_duration()
            times = np.linspace(0, duration, int(max(1, duration*25)))
            f1 = [{'x': float(t), 'y': float(formants.get_value_at_time(1, t) or 0)} for t in times]
            f2 = [{'x': float(t), 'y': float(formants.get_value_at_time(2, t) or 0)} for t in times]
            f3 = [{'x': float(t), 'y': float(formants.get_value_at_time(3, t) or 0)} for t in times]

            result = {
                'pitch': pitch_data,
                'f1': f1,
                'f2': f2,
                'f3': f3
            }
        except Exception as e:
            result = {'error': str(e)}

    os.remove(temp_audio.name)
    return jsonify(result)

