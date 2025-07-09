import React, { useState, useEffect } from 'react';
import PatientMainNavbar from './PatientMainNavbar';
import '../main_styles/PatientMainPage.css';
import VideoCallInterface from '../components/VideoCallInterface';
import axios from 'axios';

const PatientMainPage = () => {
  const [isCallActive, setIsCallActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [therapist, setTherapist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTherapist = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get('/api/patients/selected-therapist', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setTherapist(response.data);
        setLoading(false);
      } catch (err) {
        if (err.response?.status === 404) {
          window.location.href = '/patient_main/PatientMainSelectTherapistPage';
        } else {
          setError('Failed to fetch therapist information');
          setLoading(false);
        }
      }
    };

    fetchTherapist();
  }, []);

  const joinCall = () => {
    setIsCallActive(true);
  };

  const endCall = () => {
    setIsCallActive(false);
  };

  return (
    <div className="patient-main-page">
      <PatientMainNavbar />
      <main className="main-content">
        {!isCallActive ? (
          <div className="therapist-view">
            <h2>Your Therapist</h2>
            {loading ? (
              <div className="loading">Loading therapist information...</div>
            ) : error ? (
              <div className="error">{error}</div>
            ) : therapist ? (
              <div className="therapist-card">
                <div className="therapist-avatar">{therapist?.name ? therapist.name.split(' ').map(n => n[0]).join('') : '?'}</div>
                <div className="therapist-info">
                  <h3>{therapist.name}</h3>
                  <p className="specialization">{therapist.specialization}</p>
                  <p className="last-session">Last session: {therapist.lastSession}</p>
                </div>
                <button className="join-call-btn" onClick={joinCall}>Join Call</button>
              </div>
            ) : (
              <div className="no-therapist">
                <p>No therapist selected. Please select a therapist to continue.</p>
                <button onClick={() => window.location.href = '/patient_main/PatientMainSelectTherapistPage'} className="select-therapist-btn">
                  Select Therapist
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="video-call-interface">
            <VideoCallInterface
              isInitiator={false}
              roomId={`th_${therapist._id}`}
              remoteUserType="therapist"
              onCallEnd={endCall}
            />
          </div>
        )}
      </main>
    </div>
  );
};

export default PatientMainPage;