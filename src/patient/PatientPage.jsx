import React from 'react';
import '../styles/TherapistPage.css';
import Footer from '../Footer';
import PatientNavbar from './PatientNavbar';

const PatientPage = () => {
  return (
    <div className="therapist-page">
      <div className="page-content">
        <PatientNavbar />
      
        <main className="main-content">
          <section className="hero-section">
            <h1>Welcome to Your Mental Health Journey</h1>
            <p className="hero-text">
              Find the right therapist and start your path to better mental well-being
            </p>
          </section>

          <section className="features-section">
            <div className="feature-card">
              <h2>Find Your Therapist</h2>
              <p>Connect with qualified therapists who understand your needs. Our matching system helps you find the perfect therapeutic relationship.</p>
            </div>

            <div className="feature-card">
              <h2>Emotion Recognition Support</h2>
              <p>Experience therapy sessions enhanced by our innovative emotion recognition technology, helping you better understand and express your feelings.</p>
            </div>

            <div className="feature-card">
              <h2>Flexible Sessions</h2>
              <p>Schedule therapy sessions at your convenience. Choose between video calls or chat-based sessions from the comfort of your home.</p>
            </div>
          </section>
        </main>
      </div>
      <Footer />
    </div>
  );
};

export default PatientPage;