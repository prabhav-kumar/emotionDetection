import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PatientMainNavbar from './PatientMainNavbar';
import axios from 'axios';
import '../main_styles/PatientMainSelectTherapistPage.css';

const PatientMainSelectTherapistPage = () => {
    const [therapists, setTherapists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchTherapists = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await axios.get('/api/therapists/all', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                // Ensure therapists data is an array
                const therapistsData = Array.isArray(response.data) ? response.data : 
                                      (response.data.therapists ? response.data.therapists : []);
                setTherapists(therapistsData);
                setLoading(false);
            } catch (err) {
                setError('Failed to fetch therapists. Please try again later.');
                setLoading(false);
            }
        };

        fetchTherapists();
    }, []);

    const handleSelectTherapist = async (therapist) => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(`/api/patients/select/${therapist._id}`, {
                therapistName: therapist.name,
                patientName: localStorage.getItem('patientName')
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (response.data.message === 'Therapist selected successfully') {
                localStorage.setItem('selectedTherapist', JSON.stringify(response.data.therapist));
                // Also store the therapist ID separately for video call room identification
                if (response.data.therapist && response.data.therapist._id) {
                    localStorage.setItem('selectedTherapistId', response.data.therapist._id);
                }
                navigate('/patient_main/PatientMainPage', { replace: true });
            } else {
                setError('Failed to select therapist. Please try again.');
            }
        } catch (err) {
            console.error('Error selecting therapist:', err);
            setError('Failed to select therapist. Please try again.');
        }
    };

    if (loading) {
        return (
            <div className="patient-main-page">
                <PatientMainNavbar />
                <div className="main-content">
                    <div className="therapist-view">
                        <h2>Loading therapists...</h2>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="patient-main-page">
                <PatientMainNavbar />
                <div className="main-content">
                    <div className="therapist-view">
                        <h2>{error}</h2>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="patient-main-page">
            <PatientMainNavbar />
            <div className="main-content">
                <div className="therapist-view">
                    <h2>Choose Your Mental Health Partner</h2>
                    <p className="subtitle">Select a qualified therapist to begin your wellness journey</p>
                    <div className="therapist-grid">
                        {Array.isArray(therapists) && therapists.length > 0 ? therapists.map((therapist) => (
                            <div key={therapist._id} className="therapist-card">
                                <div className="therapist-avatar">
                                    {therapist.name.split(' ').map(n => n[0]).join('')}
                                </div>
                                <div className="therapist-info">
                                    <h3>{therapist.name}</h3>
                                    <p className="specialization">{therapist.specialization}</p>
                                    <p className="experience">{therapist.experience} years of experience</p>
                                    <div className="expertise-tags">
                                        {therapist.expertise?.map((exp, index) => (
                                            <span key={index} className="expertise-tag">{exp}</span>
                                        ))}
                                    </div>
                                    <p className="availability">Available for new patients</p>
                                </div>
                                <button
                                    className="select-therapist-btn"
                                    onClick={() => handleSelectTherapist(therapist)}
                                >
                                    Choose as My Therapist
                                </button>
                            </div>
                        )) : (
                            <div className="no-therapists">
                                <div className="no-therapists-content">
                                    <h3>No Therapists Available</h3>
                                    <p>We're currently expanding our network of mental health professionals.</p>
                                    <p>Please check back soon or contact support for assistance.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PatientMainSelectTherapistPage;