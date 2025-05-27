# SpeakEasy: Browser-Based Vocal Analysis Tool

**SpeakEasy** is a privacy-focused web app for real-time vocal analysis. It allows users to record their voice and visualize features like pitch, formant frequencies, and clarity. This project was developed during HackDavis 2025 to support applications such as gender-affirming voice training and self-guided vocal exploration.

## Features

- In-browser audio recording and playback
- Real-time visualization of pitch and formants using Chart.js
- Backend voice analysis with Parselmouth (Praat in Python)
- No login or cloud storage required
- Clean, user-friendly interface built with accessibility in mind

## Project Status

The backend is no longer hosted online. To use the app, you must run it locally by setting up both the frontend and backend.

## Tech Stack

### Frontend

- React (TypeScript, Vite)
- Chart.js
- MediaRecorder API
- HTML5 / CSS

### Backend

- Flask (Python)
- Parselmouth (Praat wrapper)
- ffmpeg for audio format conversion

## Local Setup

1. Clone the repository:  
   git clone https://github.com/EnzoLucido/speak-easy.git

2. Set up the backend:  
   cd speak-easy/Backend  
   pip install -r requirements.txt  
   flask run

3. Set up the frontend:  
   cd ../src  
   npm install  
   npm run dev

The app will be available at http://localhost:5173

## Resources we used

[Parselmouth](https://parselmouth.readthedocs.io/)
[Dr. Feinberg's Parselmouth](https://github.com/drfeinberg/PraatScripts)
[VoiceLab](https://github.com/Voice-Lab/VoiceLab)

## Contributors

- Mario Lucido – Frontend development, charting, UI/UX
- Enzo Lucido – Backend development, research, Parselmouth integration

