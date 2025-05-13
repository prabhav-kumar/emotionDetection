import React, { useState, useEffect, useContext } from 'react';
import '../main_styles/TherapistMainPage.css';
import TherapistMainNavbar from './TherapistMainNavbar';
import { useNotification } from '../context/NotificationContext';
import VideoCallInterface from '../components/VideoCallInterface';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

const TherapistMainPage = () => {
  const { notifications, addNotification } = useNotification();
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState('neutral');
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`/api/therapists/assigned-patients`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        setPatients(response.data);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch patients. Please check your connection.');
        setLoading(false);
        console.error('Error fetching patients:', err);
      }
    };

    fetchPatients();

    // Set up polling for new patient notifications
    const checkNewPatients = setInterval(async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`/api/therapists/assigned-patients`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.data.length > patients.length) {
          const newPatients = response.data.filter(newPatient => 
            !patients.some(existingPatient => existingPatient._id === newPatient._id)
          );
          newPatients.forEach(patient => {
            addNotification(`New patient ${patient.name} has selected you as their therapist`);
          });
          setPatients(response.data);
        }
      } catch (error) {
        console.error('Failed to check for new patients:', error);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(checkNewPatients);
  }, [addNotification, patients]);

  const emotions = [
    { name: 'happy', color: '#4CAF50' },
    { name: 'sad', color: '#2196F3' },
    { name: 'angry', color: '#F44336' },
    { name: 'neutral', color: '#9E9E9E' },
    { name: 'surprised', color: '#FFC107' },
    { name: 'fearful', color: '#673AB7' }
  ];



  const handleCallEnd = () => {
    setIsCallActive(false);
    setSelectedPatient(null);
  };

  const startCall = (patient) => {
    setSelectedPatient(patient);
    setIsCallActive(true);
    
    // Get therapist ID from token
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('No authentication token found');
      return;
    }
    
    let decoded;
    try {
      decoded = jwtDecode(token);
      if (!decoded?.id) {
        throw new Error('Invalid token: missing id');
      }
    } catch (error) {
      console.error('Failed to decode token:', error);
      return;
    }
    
    const therapistId = decoded.id;
    if (!therapistId) {
      console.error('No therapist ID found in token');
      return;
    }
    
    // Create room ID using therapist ID for consistency
    const roomId = `th_${therapistId}`;
    
    // Store IDs
    localStorage.setItem('therapistId', therapistId);
    localStorage.setItem('currentRoomId', roomId);
    localStorage.setItem('currentPatientId', patient._id);
    sessionStorage.setItem('therapistId', therapistId);
    
    // Notify server that call has started
    axios.post('/api/calls/start', { 
      therapistId,
      roomId,
      patientId: patient._id 
    }).catch(error => {
      console.error('Failed to notify server about call start:', error);
    });
  };

  return (
    <div className="therapist-main-page">
      <TherapistMainNavbar />
      <main className="main-content">
        {!isCallActive ? (
          <div className="patient-selection">
            <h2>Your Patients</h2>
            {loading ? (
              <div className="loading-state">Loading patients...</div>
            ) : error ? (
              <div className="error-state">{error}</div>
            ) : patients.length === 0 ? (
              <div className="empty-state">
                <p>No patients have selected you as their therapist yet.</p>
                <p>When patients select you, they will appear here.</p>
              </div>
            ) : (
              <div className="patient-list">
                {patients.map(patient => (
                  <div key={patient._id} className="patient-card">
                    <div className="patient-avatar">
                      {patient.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="patient-info">
                      <h3>{patient.name}</h3>
                      <p className="patient-email">{patient.email}</p>
                      <p className="last-session">
                        {patient.lastSession 
                          ? `Last session: ${new Date(patient.lastSession).toLocaleDateString()}`
                          : 'No sessions yet'}
                      </p>
                    </div>
                    <button 
                      className="start-call-btn" 
                      onClick={() => startCall(patient)}
                    >
                      Start Session
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="video-call-interface">
            <VideoCallInterface
              isInitiator={true}
              roomId={`th_${localStorage.getItem('therapistId')}`}
              remoteUserType="patient"
              onCallEnd={handleCallEnd}
            />
            
            <div className="emotion-analysis">
              <h3>Real-time Emotion Analysis</h3>
              <div className="emotion-display">
                <div 
                  className="emotion-circle" 
                  style={{ 
                    backgroundColor: emotions.find(e => e.name === currentEmotion)?.color || '#9E9E9E'
                  }}
                >
                  {currentEmotion}
                </div>
              </div>
              <div className="emotion-history">
                {emotions.map(emotion => (
                  <div 
                    key={emotion.name} 
                    className={`emotion-tag ${currentEmotion === emotion.name ? 'active' : ''}`}
                    style={{ backgroundColor: emotion.color }}
                  >
                    {emotion.name}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default TherapistMainPage;