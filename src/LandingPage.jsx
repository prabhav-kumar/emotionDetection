import React from 'react';
import './LandingPage.css';
import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="landing-wrapper">
      <video autoPlay loop muted playsInline className="video-background">
        <source src="/background.mp4" type="video/mp4" />
      </video>
      <div className="overlay"></div>

      

     {/* Hero Section */}
<div className="hero">
  <div className="hero-content">
  <img
  src="/logo_d.png"
  alt="ManoSwara Logo"
  style={{
    width: '300px',     // Increased size
    height: 'auto',
    borderRadius: '12px',
    marginBottom: '2rem',
    display: 'block',
    marginLeft: 'auto',
    marginRight: 'auto',
  }}
/>

    <h1>Transforming Mental Health Care</h1>
    <p>
      Connect with licensed therapists or find the right patients.
      Let's shape the future of mental healthcare together.
      {/* A safe space where connection meets compassion. */}
      {/* Whether you're seeking therapy or offering it, Saptaras bridges the gap between mental health professionals and those in need. */}
    </p>
    
    <div className="cta-buttons">
      <button onClick={() => navigate('/therapist/TherapistPage')}>I’m a Therapist</button>
      <button className="outline" onClick={() => navigate('/patient/PatientPage')}>I need a Therapist</button>
    </div>
  </div>
</div>
       
      {/* Features */}
      
      <div className="features">
        
  <div className="feature">
    <div className="icon">💜</div>
    <h3>Personalized Care</h3>
    <p>Connect with therapists who understand your unique needs and journey.</p>
    <div className="feature-extra">
      Our intelligent matching system takes into account your personal preferences, language, background, therapy style, and comfort level.
      <br /><br />
      Whether you're navigating anxiety, depression, trauma, or just need someone to talk to—our platform helps you find the right support that feels truly aligned with your story.
    </div>
  </div>

  <div className="feature">
    <div className="icon">🧠</div>
    <h3>Expert Guidance</h3>
    <p>Access a network of qualified mental health professionals.</p>
    <div className="feature-extra">
      Every therapist on Saptaras is licensed, vetted, and trained in various evidence-based approaches like CBT, DBT, mindfulness, and more.
      <br /><br />
      We make it easier for you to explore different specializations, view therapist profiles, and make informed choices with clarity and confidence.
    </div>
  </div>

  <div className="feature">
    <div className="icon">🔒</div>
    <h3>Secure Platform</h3>
    <p>Your privacy and security are our top priorities.</p>
    <div className="feature-extra">
      All conversations and records are end-to-end encrypted. We strictly follow HIPAA and GDPR compliance to ensure your sensitive data remains private.
      <br /><br />
      Your journey is safe with us—no tracking, no ads, just authentic care and confidentiality from start to finish.
    </div>
  </div>
</div>
{/* How It Works Section */}
<div className="how-it-works">
  <h2>How It Works</h2>
  <div className="steps">
    <div className="step">
      <h3>1. Sign Up</h3>
      <p>Create an account as a therapist or a patient in seconds.</p>
    </div>
    <div className="step">
      <h3>2. Get Matched</h3>
      <p>Our smart system connects you based on your roles and preferences.</p>
    </div>
    <div className="step">
      <h3>3. Begin Sessions</h3>
      <p>Start your healing journey with secure, online therapy sessions tailored for you.</p>
    </div>
  </div>
</div>

    </div>
  );
};

export default LandingPage;