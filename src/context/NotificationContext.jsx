import React, { createContext, useState, useContext } from 'react';

const NotificationContext = createContext();

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const addNotification = (message) => {
    setNotifications((prev) => [...prev, {
      id: Date.now(),
      message,
      isNew: true,
      timestamp: new Date().toISOString()
    }]);
  };

  const removeNotification = (id) => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== id));
  };

  const markNotificationAsRead = (id) => {
    setNotifications((prev) => prev.map((notification) => 
      notification.id === id ? { ...notification, isNew: false } : notification
    ));
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        removeNotification,
        markNotificationAsRead
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};