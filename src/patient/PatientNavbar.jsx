import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import '../styles/TherapistNavbar.css';

const PatientNavbar = () => {
  return (
    <nav className="navbar">
      <div className="nav-left">
        <a href="/"> <img src="/logo_d.png" alt="Saptaras Logo" className="nav-logo" /> </a>
      </div>
      <div className="nav-right">
        <NavLink to="/patient/PatientPage" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Home</NavLink>
        <NavLink to="/patient/PatientAboutPage" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>About</NavLink>
        <NavLink to="/patient/PatientFAQsPage" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>FAQs</NavLink>
        <NavLink to="/patient/PatientContactPage" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Contact</NavLink>
        <NavLink to="/patient/PatientAuthPage" className="login-btn">Login</NavLink>
      </div>
    </nav>
  );
};

export default PatientNavbar;