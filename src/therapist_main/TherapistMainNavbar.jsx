import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import '../main_styles/TherapistMainNavbar.css';
import { FaUpload, FaHistory, FaBook, FaBell, FaUserCircle, FaSignOutAlt } from 'react-icons/fa';

const TherapistMainNavbar = () => {
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    navigate('/therapist/TherapistAuthPage');
  };
  return (
    <nav className="navbar">
      <div className="nav-left">
      <a href="/"> <img src="/logo_d.png" alt="ManoSwara Logo" className="nav-logo" /> </a>
      </div>
      <div className="nav-right">
        <NavLink to="/therapist_main/TherapistMainPage" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          Home
        </NavLink>
        <NavLink to="/therapist_main/TherapistMainUploadPage" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <FaUpload className="nav-icon" /> Upload
        </NavLink>
        <NavLink to="/therapist_main/TherapistMainHistoryPage" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <FaHistory className="nav-icon" /> History
        </NavLink>
        
        <div className="nav-icons">
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
      </div>
    </nav>
  );
};

export default TherapistMainNavbar;