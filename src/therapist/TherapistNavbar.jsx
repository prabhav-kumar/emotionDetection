import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import '../styles/TherapistNavbar.css';

const TherapistNavbar = () => {
  return (
    <nav className="navbar">
      <div className="nav-left">
        <a href="/"><img src="/logo_d.png" alt="ManoSwara Logo" className="nav-logo" /></a>
      </div>
      <div className="nav-right">
        <NavLink to="/therapist/TherapistPage" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Home</NavLink>
        <NavLink to="/therapist/TherapistAboutPage" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>About</NavLink>
        <NavLink to="/therapist/TherapistFAQsPage" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>FAQs</NavLink>
        <NavLink to="/therapist/TherapistContactPage" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Contact Us</NavLink>
        <NavLink to="/therapist/TherapistAuthPage" className="login-btn">Login</NavLink>
      </div>
    </nav>
  );
};

export default TherapistNavbar;