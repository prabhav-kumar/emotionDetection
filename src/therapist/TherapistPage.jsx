import React from 'react';
import '../styles/TherapistPage.css';
import Footer from '../Footer';
import TherapistNavbar from './TherapistNavbar';

const TherapistPage = () => {
  return (
    <div className="therapist-page">
      <div className="page-content">
        <TherapistNavbar />
      
      <main className="main-content">
        <section className="hero-section">
          <h1>Welcome to ManoSwara</h1>
          <p className="hero-text">
            Revolutionizing mental healthcare through technology and human connection
          </p>
        </section>

        <section className="features-section">
          <div className="feature-card">
            <h2>Nationwide Connection</h2>
            <p>Connect with patients across the country through our secure online platform, breaking geographical barriers in mental healthcare delivery.</p>
          </div>

          <div className="feature-card">
            <h2>Emotion Recognition Technology</h2>
            <p>Leverage our advanced speech-based emotion recognition system to gain deeper insights into patient emotional states, enabling more effective therapy sessions.</p>
          </div>

          <div className="feature-card">
            <h2>Enhanced Patient Care</h2>
            <p>Utilize comprehensive tools and analytics to track patient progress, maintain detailed session notes, and provide personalized care plans.</p>
          </div>
        </section>
      </main>
      </div>
      <Footer />
    </div>
  );
};

export default TherapistPage;