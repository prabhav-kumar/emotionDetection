import React from 'react';
import '../styles/AboutPage.css';
import Footer from '../Footer';
import PatientNavbar from './PatientNavbar';

const PatientAboutPage = () => {
  return (
    <div className="about-page">
      <div className="page-content">
        <PatientNavbar />

        <main className="main-content">
          <section className="about-section vision-section">
            <h1>About Our Platform</h1>
            <p>
              Empowering individuals to take control of their mental health journey through innovative technology and personalized care.
              We believe everyone deserves access to quality mental healthcare. Our platform combines cutting-edge technology with
              compassionate care to make therapy more accessible, effective, and personalized.
            </p>
          </section>

          <section className="about-section tech-section">
            <h2>Our Technology</h2>
            <div className="tech-grid">
              <div className="tech-item">Emotion Recognition AI</div>
              <div className="tech-item">Secure Video Platform</div>
              <div className="tech-item">Real-time Analytics</div>
              <div className="tech-item">HIPAA Compliance</div>
              <div className="tech-item">Smart Scheduling</div>
              <div className="tech-item">Progress Tracking</div>
            </div>
          </section>

          <section className="about-section features-section">
            <h2>Why Choose Us</h2>
            <div className="features-grid">
              <div className="feature-item">
                <h3>Qualified Therapists</h3>
                <p>Access to vetted and experienced mental health professionals.</p>
              </div>
              <div className="feature-item">
                <h3>Innovative Technology</h3>
                <p>Advanced emotion recognition for enhanced therapy sessions.</p>
              </div>
              <div className="feature-item">
                <h3>Flexible Scheduling</h3>
                <p>Book sessions at times that work best for you.</p>
              </div>
              <div className="feature-item">
                <h3>Secure Platform</h3>
                <p>Your privacy and confidentiality are our top priorities.</p>
              </div>
            </div>
          </section>
        </main>
      </div>
      <Footer />
    </div>
  );
};

export default PatientAboutPage;