import React, { useState, useEffect } from 'react';
import axios from 'axios';
import TherapistMainNavbar from './TherapistMainNavbar';
import '../main_styles/TherapistMainHistoryPage.css'; // Create this CSS file

const TherapistMainHistoryPage = () => {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [sessionDetails, setSessionDetails] = useState(null);
  const [groupedAnalysisSegments, setGroupedAnalysisSegments] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState('');

  // Fetch assigned patients for the therapist
  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get('/api/therapists/assigned-patients', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setPatients(response.data);
        setLoadingPatients(false);
      } catch (err) {
        setError('Failed to fetch patients.');
        setLoadingPatients(false);
        console.error('Error fetching patients:', err);
      }
    };
    fetchPatients();
  }, []);

  // Fetch sessions for the selected patient
  useEffect(() => {
    if (selectedPatient) {
      const fetchSessions = async () => {
        setLoadingSessions(true);
        setError('');
        setSessions([]);
        setSelectedSession('');
        setSessionDetails(null);
        try {
          const token = localStorage.getItem('token');
          const response = await axios.get(`/api/calls/sessions/patient/${selectedPatient}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setSessions(response.data.map(session => ({...session, name: `Session from ${new Date(session.sessionDate).toLocaleDateString()}` })));
          setLoadingSessions(false);
        } catch (err) {
          setError(err.response?.data?.message || 'Failed to fetch sessions.');
          setLoadingSessions(false);
          console.error('Error fetching sessions:', err);
        }
      };
      fetchSessions();
    }
  }, [selectedPatient]);

  // Fetch details for the selected session
  useEffect(() => {
    if (selectedSession) {
      const fetchSessionDetails = async () => {
        setLoadingDetails(true);
        setError('');
        setSessionDetails(null);
        try {
          const token = localStorage.getItem('token');
          const response = await axios.get(`/api/calls/session/${selectedSession}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setSessionDetails(response.data);
          setLoadingDetails(false);
        } catch (err) {
          setError(err.response?.data?.message || 'Failed to fetch session details.');
          setLoadingDetails(false);
          console.error('Error fetching session details:', err);
        }
      };
      fetchSessionDetails();
    }
  }, [selectedSession]);

  // Process session details to group analysis segments
  useEffect(() => {
    if (sessionDetails && sessionDetails.transcripts && sessionDetails.emotions) {
      const segments = sessionDetails.transcripts.map(transcript => {
        const matchingEmotion = sessionDetails.emotions.find(
          e => e.timestamp === transcript.timestamp || e.id === transcript.id
        );
        return {
          transcript,
          emotion: matchingEmotion || null,
          timestamp: parseInt(transcript.timestamp)
        };
      }).sort((a, b) => a.timestamp - b.timestamp);
      
      // Group segments by emotion for better visualization
      const emotionGroups = segments.reduce((groups, segment) => {
        if (segment.emotion) {
          const emotion = segment.emotion.emotion;
          if (!groups[emotion]) {
            groups[emotion] = [];
          }
          groups[emotion].push(segment);
        }
        return groups;
      }, {});
      
      setGroupedAnalysisSegments(segments);
    } else {
      setGroupedAnalysisSegments([]);
    }
  }, [sessionDetails]);

  return (
    <div className="therapist-history-page">
      <TherapistMainNavbar />
      <main className="history-main-content">
        <h1>Session History</h1>
        {error && <p className="error-message">{error}</p>}

        <div className="filters-container">
          <div className="filter-group">
            <label htmlFor="patient-select">Select Patient:</label>
            <select 
              id="patient-select" 
              value={selectedPatient} 
              onChange={(e) => setSelectedPatient(e.target.value)}
              disabled={loadingPatients}
            >
              <option value="">{loadingPatients ? 'Loading...' : '-- Select a Patient --'}</option>
              {patients.map((patient) => (
                <option key={patient._id} value={patient._id}>
                  {patient.name} (ID: {patient._id.slice(-6)})
                </option>
              ))}
            </select>
          </div>

          {selectedPatient && (
            <div className="filter-group">
              <label htmlFor="session-select">Select Session:</label>
              <select 
                id="session-select" 
                value={selectedSession} 
                onChange={(e) => setSelectedSession(e.target.value)}
                disabled={loadingSessions || !selectedPatient}
              >
                <option value="">{loadingSessions ? 'Loading...' : '-- Select a Session --'}</option>
                {sessions.map((session) => (
                  <option key={session._id} value={session._id}>
                    {session.name} (Room: {session.roomName})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {loadingDetails && <p>Loading session details...</p>}
        
        {sessionDetails && !loadingDetails && (
          <div className="session-details-container">
            <h2>Details for Session on {new Date(sessionDetails.sessionDate).toLocaleString()}</h2>
            <div className="session-info">
              <p><strong>Patient:</strong> {sessionDetails.patientName || sessionDetails.patientId}</p>
              <p><strong>Therapist:</strong> {sessionDetails.therapistName || sessionDetails.therapistId}</p>
              <p><strong>Room Name:</strong> {sessionDetails.roomName}</p>
            </div>

            <div className="emotion-statistics">
              <h3>Emotion Analysis Summary</h3>
              <div className="emotion-distribution">
                {Object.entries(groupedAnalysisSegments.reduce((acc, segment) => {
                  if (segment.emotion) {
                    acc[segment.emotion.emotion] = (acc[segment.emotion.emotion] || 0) + 1;
                  }
                  return acc;
                }, {})).map(([emotion, count]) => (
                  <div key={emotion} className="emotion-stat" style={{ 
                    backgroundColor: sessionDetails.emotions.find(e => e.emotion === emotion)?.color || '#f0f0f0',
                    padding: '10px',
                    margin: '5px',
                    borderRadius: '5px'
                  }}>
                    <strong>{emotion}:</strong> {count} instances
                  </div>
                ))}
              </div>
            </div>
            
            <div className="analysis-content">
              <h3>Session Timeline</h3>
              {sessionDetails.analyses && sessionDetails.analyses.length > 0 ? (
                <div className="analysis-segments-container">
                  {sessionDetails.analyses.map((analysis, idx) => (
                    <div key={idx} className="analysis-block">
                      <div className="analysis-label">Analysis {idx + 1}</div>
                      {analysis.transcripts.map((t, i) => (
                        <div key={i} className="transcript-history-entry">
                          <strong>{t.speaker === 'Patient' ? (sessionDetails.patientName || 'Patient') : t.speaker === 'Therapist' ? (sessionDetails.therapistName || 'Therapist') : 'System'}</strong>
                          <p>{t.text}</p>
                          <span className="timestamp">{t.displayTimestamp || t.timestamp}</span>
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
                </div>
              ) : (
                <p>No analysis data available for this session.</p>
              )}

              {sessionDetails.overallAnalysis && Object.keys(sessionDetails.overallAnalysis).length > 0 && (
                <div className="overall-analysis-section">
                  <h3>Overall Session Analysis</h3>
                  {sessionDetails.overallAnalysis.sentimentTrend && <p><strong>Sentiment Trend:</strong> {sessionDetails.overallAnalysis.sentimentTrend}</p>}
                  {sessionDetails.overallAnalysis.keyTopics && sessionDetails.overallAnalysis.keyTopics.length > 0 && <p><strong>Key Topics:</strong> {sessionDetails.overallAnalysis.keyTopics.join(', ')}</p>}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default TherapistMainHistoryPage;