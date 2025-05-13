import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import '../main_styles/TherapistMainNavbar.css';
import { FaUpload, FaHistory, FaBook, FaBell, FaUserCircle, FaSignOutAlt } from 'react-icons/fa';
import { useNotification } from '../context/NotificationContext';

const TherapistMainNavbar = () => {
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const { notifications, removeNotification, markNotificationAsRead } = useNotification();
  const [showNotifications, setShowNotifications] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    navigate('/therapist/TherapistAuthPage');
  };
  return (
    <nav className="navbar">
      <div className="nav-left">
        <img src="/logo_d.png" alt="Saptaras Logo" className="nav-logo" />
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
        <NavLink to="/therapist_main/TherapistMainManualPage" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <FaBook className="nav-icon" /> User Manual
        </NavLink>
        
        <div className="nav-icons">
          <div className="notification-container">
            <div className="notification-icon" onClick={() => setShowNotifications(!showNotifications)}>
              <FaBell className="nav-icon" />
              {notifications.length > 0 && <span className="notification-badge">{notifications.length}</span>}
            </div>
            {showNotifications && notifications.length > 0 && (
              <div className="notification-dropdown">
                {notifications.map((notification) => (
                  <div 
                    key={notification.id} 
                    className={`notification-item ${notification.isNew ? 'new' : ''}`}
                    onClick={() => {
                      markNotificationAsRead(notification.id);
                      removeNotification(notification.id);
                      setShowNotifications(false);
                    }}
                  >
                    {notification.message}
                  </div>
                ))}
              </div>
            )}
          </div>
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