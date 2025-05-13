import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

const ProtectedRoute = ({ element: Component, userRole }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      const token = localStorage.getItem('token');
      const storedUserRole = localStorage.getItem('userRole');

      if (!token || storedUserRole !== userRole) {
        const loginPath = userRole === 'therapist' 
          ? '/therapist/TherapistAuthPage'
          : '/patients/PatientAuthPage';
        navigate(loginPath, { replace: true });
        return;
      }

      // For patient routes, check if therapist is selected
      if (userRole === 'patient' && 
          location.pathname === '/patient_main/PatientMainPage') {
        try {
          const response = await axios.get('/api/patients/selected-therapist', {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (!response.data) {
            navigate('/patient_main/PatientMainSelectTherapistPage', { replace: true });
            return;
          }
        } catch (err) {
          if (err.response?.status === 404) {
            navigate('/patient_main/PatientMainSelectTherapistPage', { replace: true });
            return;
          }
        }
      }
      setIsLoading(false);
    };

    checkAuthAndRedirect();
  }, [navigate, userRole, location]);

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  return <Component />;
};

export default ProtectedRoute;