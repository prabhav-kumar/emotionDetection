import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import '../main_styles/PatientMainNavbar.css';
import { FaHome, FaFileAlt, FaBook, FaUserMd, FaUserCircle, FaSignOutAlt } from 'react-icons/fa';

const PatientMainNavbar = () => {
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    navigate('/patient/PatientAuthPage');
  };
  return (
    <nav className="navbar">
      <div className="nav-left">
      <a href="/"> <img src="/logo_d.png" alt="ManoSwara Logo" className="nav-logo" /> </a>
      </div>
      <div className="nav-right">
        <NavLink 
          to="/patient_main/PatientMainPage" 
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <FaHome className="nav-icon" /> Home
        </NavLink>
        
        <NavLink 
          to="/patient_main/PatientMainSelectTherapistPage" 
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <FaUserMd className="nav-icon" /> Select Therapist
        </NavLink>
        
        <div className="profile-container" 
          onMouseEnter={() => setShowProfileMenu(true)}
          onMouseLeave={() => setShowProfileMenu(false)}
        >
          <FaUserCircle className="nav-icon" />
          {showProfileMenu && (
            <div className="profile-dropdown">
              <button onClick={handleLogout} className="logout-button">
                <FaSignOutAlt /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default PatientMainNavbar;