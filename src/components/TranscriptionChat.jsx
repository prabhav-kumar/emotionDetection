import React, { useRef, useEffect } from 'react';
import './TranscriptionChat.css';

const TranscriptionChat = ({ sessionAnalyses }) => {
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessionAnalyses]);

  return (
    <div className="transcription-chat">
      <div className="messages">
        {sessionAnalyses.map((analysis, idx) => (
          <div key={idx} className="analysis-block">
            <div className="analysis-label">Analysis {idx + 1}</div>
            {analysis.transcripts.map((t, i) => (
              <div key={i} className={`transcript-message ${t.isLocal ? 'local' : 'remote'}`}>
                <div className="transcript-bubble">
                  <span className="role">{t.speaker}</span>
                  <p className="text">{t.text}</p>
                  <span className="timestamp">{t.displayTimestamp || t.timestamp}</span>
                </div>
              </div>
            ))}
            {analysis.emotion && (
              <div className="session-emotion-summary" style={{
                marginTop: '8px',
                padding: '6px 12px',
                backgroundColor: analysis.emotion.color || '#7B68EE',
                color: 'white',
                borderRadius: '12px',
                fontWeight: 'bold',
                textAlign: 'center',
                fontSize: '1em'
              }}>
                Overall Analysis Emotion: {analysis.emotion.emotion} {analysis.emotion.displayTimestamp && (
                  <span style={{ fontWeight: 'normal', fontSize: '0.9em', marginLeft: 8 }}>{analysis.emotion.displayTimestamp}</span>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default TranscriptionChat;
