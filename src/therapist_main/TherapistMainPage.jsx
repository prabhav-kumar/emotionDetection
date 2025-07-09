import React, { useState, useEffect, useContext } from 'react';
import '../main_styles/TherapistMainPage.css';
import TherapistMainNavbar from './TherapistMainNavbar';
import VideoCallInterface from '../components/VideoCallInterface';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

const TherapistMainPage = () => {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [isCallActive, setIsCallActive] = useState(false);

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
  }, []);

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
          </div>
        )}
      </main>
    </div>
  );
};

export default TherapistMainPage;