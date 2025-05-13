import React from 'react';
import './TranscriptionChat.css';

const TranscriptionChat = ({ transcripts }) => (
  <div className="transcription-chat">
    {transcripts.map((t, i) => (
      <div key={i} className={`transcript-message ${t.isLocal ? 'local' : 'remote'}`}>
        <div className="transcript-bubble">
          <span className="role">{t.isLocal ? 'You' : 'Therapist'}:</span>
          <p className="text">{t.text}</p>
          <span className="timestamp">{t.timestamp}</span>
        </div>
      </div>
    ))}
  </div>
);

export default TranscriptionChat;