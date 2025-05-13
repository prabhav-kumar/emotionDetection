import React from 'react';
import PatientMainNavbar from './PatientMainNavbar';
import '../main_styles/PatientMainPage.css';

const PatientMainGuide = () => {
  return (
    <div className="patient-main-page">
      <PatientMainNavbar />
      <div className="main-content">
        <div className="guide-container">
          <h1>User Guide</h1>
          <section className="guide-section">
            <h2>Getting Started</h2>
            <p>Welcome to the Saptaras platform! This guide will help you navigate through the various features available to you.</p>
          </section>

          <section className="guide-section">
            <h2>Selecting a Therapist</h2>
            <ol>
              <li>Navigate to the "Select Therapist" page from the navigation bar</li>
              <li>Browse through the list of available therapists</li>
              <li>View their experience and contact information</li>
              <li>Click "Select Therapist" to choose your preferred therapist</li>
            </ol>
          </section>

          <section className="guide-section">
            <h2>Viewing Results</h2>
            <ol>
              <li>Click on the "Results" tab in the navigation bar</li>
              <li>View your therapy session results and progress</li>
              <li>Track your improvement over time</li>
            </ol>
          </section>

          <section className="guide-section">
            <h2>Need Help?</h2>
            <p>If you need assistance or have any questions, please don't hesitate to contact our support team.</p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PatientMainGuide;