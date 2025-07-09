# ManoSwara: AI-Powered Remote Therapy Platform

**ManoSwara** is a full-stack web application designed for remote therapy sessions with advanced AI-powered speech and emotion analysis. It enables secure video/audio calls between therapists and patients, real-time and post-session emotion detection, and detailed session history for both parties.

---

## Features

- **Secure Video & Audio Calls:**  
  Real-time communication between therapists and patients using WebRTC.

- **Multi-Analysis Sessions:**  
  Each session can have multiple "analyses" (start/stop cycles). For each analysis, all transcripts and an overall emotion are grouped and saved.

- **Speech-to-Text & Emotion Detection:**  
  - Uses Deepgram for real-time speech-to-text transcription.
  - Uses a HuggingFace model (or your own API) for emotion detection from patient audio.
  - After each analysis, the entire patient audio is analyzed for emotion and displayed as a summary.

- **Session History:**  
  - Therapists and patients can view past sessions.
  - Each session displays all analyses, with transcripts and the detected emotion for each analysis.

- **Modern UI:**  
  - Built with React and Vite for a fast, responsive experience.
  - Customizable background video and branding.

---

## Project Structure

```
.
├── api/                    # Python Flask API for emotion detection
│   └── emotion_detection.py
├── server/                 # Node.js/Express backend (API, models, routes)
│   ├── models/
│   ├── routes/
│   └── server.js
├── src/                    # React frontend
│   ├── components/
│   ├── therapist/
│   ├── patient/
│   ├── services/
│   └── ...
├── public/                 # Static assets (background video, logo, etc.)
│   ├── background.mp4
│   └── ...
├── package.json
├── README.md
└── ...
```

---

## Setup & Installation

### 1. **Clone the Repository**
```bash
git clone https://github.com/yourusername/manoswara.git
cd manoswara
```

### 2. **Install Dependencies**
#### Backend (Node.js/Express)
```bash
cd server
npm install
```

#### Frontend (React)
```bash
cd ../
npm install
```

#### Python API (Emotion Detection)
```bash
cd api
pip install -r requirements.txt
```

### 3. **Environment Variables**
- Set up your Deepgram API key and any other required keys in `.env` files for both backend and frontend.
- Update API URLs as needed in the frontend and backend configs.

### 4. **Run the Application**

#### Start the Python Emotion Detection API
```bash
cd api
python emotion_detection.py
```

#### Expose the Python API using ngrok (for local/public access)
If you want to make your local Python API accessible to the frontend (especially for development or remote testing), use [ngrok](https://ngrok.com/):

```bash
ngrok http 5001
```
- This will give you a public HTTPS URL (e.g., `https://xxxxxx.ngrok-free.app`).
- Update your frontend and backend configs to use this URL for emotion analysis requests.

#### Start the Backend Server
```bash
cd ../server
npm start
```

#### Start the Frontend (React)
```bash
cd ../
npm run dev
```

---

## Usage

1. **Login as a therapist or patient.**
2. **Start a video/audio call.**
3. **Begin and end analyses as needed during the session.**
   - Each analysis will group transcripts and provide an overall emotion.
4. **View session history to review all analyses, transcripts, and emotions.**

---

## Customization

- **Background Video:**  
  Replace `public/background.mp4` with your own video for a custom landing page experience.

- **Branding:**  
  Update logos and colors in the `public/` and `src/assets/` directories.

---

## Technologies Used

- **Frontend:** React, Vite, WebRTC, Deepgram API
- **Backend:** Node.js, Express, MongoDB (Mongoose)
- **AI/ML:** Python (Flask), HuggingFace Transformers (for emotion detection)
- **Other:** Socket.io, Axios, JWT Auth, ngrok

---

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

---
