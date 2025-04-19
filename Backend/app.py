from flask import Flask, request, jsonify
from flask_cors import CORS
import parselmouth
import numpy as np
import os
import tempfile

app = Flask(__name__)
CORS(app)  # allow frontend access

@app.route('/analyze', methods=['POST'])
def analyze_audio():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    file = request.files['file']

    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_audio:
        file.save(temp_audio.name)
        try:
            snd = parselmouth.Sound(temp_audio.name)
            pitch = snd.to_pitch()
            pitch_values = pitch.selected_array['frequency']
            pitch_mean = np.mean(pitch_values[pitch_values > 0])

            formants = snd.to_formant_burg()
            duration = snd.get_total_duration()
            times = np.linspace(0, duration, 100)
            f1 = [formants.get_value_at_time(1, t) for t in times]
            f2 = [formants.get_value_at_time(2, t) for t in times]
            f3 = [formants.get_value_at_time(3, t) for t in times]

            result = {
                'pitch': round(pitch_mean, 2),
                'f1': round(np.nanmean(f1), 2),
                'f2': round(np.nanmean(f2), 2),
                'f3': round(np.nanmean(f3), 2)
            }
        except Exception as e:
            result = {'error': str(e)}

    os.remove(temp_audio.name)
    return jsonify(result)

