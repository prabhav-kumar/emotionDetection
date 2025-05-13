import React, { useState } from 'react';
import { FaEye, FaEyeSlash, FaEnvelope, FaPhone, FaUser, FaBriefcase, FaLock, FaBirthdayCake, FaVenusMars } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import '../styles/AuthPage.css';
import PatientNavbar from '../patient/PatientNavbar';

const PatientAuthPage = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    gender: '',
    age: '',
    occupation: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    if (!isLogin) {
      if (!formData.name.trim()) newErrors.name = 'Name is required';
      
      if (!formData.gender) newErrors.gender = 'Gender is required';
      if (!formData.age.trim()) newErrors.age = 'Age is required';
      if (!/^\d+$/.test(formData.age)) newErrors.age = 'Please enter a valid age';
      if (!formData.occupation.trim()) newErrors.occupation = 'Occupation is required';
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }

      if (!formData.email) {
        newErrors.email = 'Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = 'Please enter a valid email address';
      }

      if (!formData.phone) {
        newErrors.phone = 'Phone number is required';
      } else if (!/^\d{10}$/.test(formData.phone)) {
        newErrors.phone = 'Please enter a valid 10-digit phone number';
      }
    } else {
      // Login validation
      if (!formData.email) {
        newErrors.email = 'Email or Phone Number is required';
      } else if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) && // Email format
        !/^\d{10}$/.test(formData.email) // Phone number format
      ) {
        newErrors.email = 'Please enter a valid email address or 10-digit phone number';
      }
    }

    if (!formData.password) newErrors.password = 'Password is required';
    if (!isLogin && !formData.confirmPassword) newErrors.confirmPassword = 'Please confirm your password';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validateForm()) {
      setIsLoading(true);
      setApiError('');

      try {
        const endpoint = isLogin ? '/api/patients/login' : '/api/patients/signup';
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            gender: formData.gender,
            age: formData.age,
            occupation: formData.occupation,
            password: formData.password
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Authentication failed');
        }

        // Store token in localStorage
        localStorage.setItem('token', data.token);
        localStorage.setItem('userRole', 'patient');

        // Navigate to patient main page
        navigate('/patient_main/PatientMainPage');
      } catch (error) {
        setApiError(error.message);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const toggleForm = () => {
    setIsLogin(!isLogin);
    setFormData({
      name: '',
      email: '',
      phone: '',
      gender: '',
      age: '',
      occupation: '',
      password: '',
      confirmPassword: ''
    });
    setErrors({});
    setApiError('');
  };

  return (
    <div className="auth-page">
      <PatientNavbar />
      <div className="auth-container">
        <div className={`form-container ${isLogin ? 'login' : 'signup'}`}>
          <h2>{isLogin ? 'Welcome Back' : 'Create Account'}</h2>

          <form onSubmit={handleSubmit}>
            {!isLogin && (
              <div className="form-group">
                <div className="input-icon-wrapper">
                  <FaUser className="input-icon" />
                  <input
                    type="text"
                    name="name"
                    placeholder="Full Name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={errors.name ? 'error' : ''}
                  />
                </div>
                {errors.name && <span className="error-message">{errors.name}</span>}
              </div>
            )}

            <div className="form-group">
              <div className="input-icon-wrapper">
                <FaEnvelope className="input-icon" />
                <input
                  type={isLogin ? "text" : "email"}
                  name="email"
                  placeholder={isLogin ? "Email or Phone Number" : "Email Address"}
                  value={formData.email}
                  onChange={handleInputChange}
                  className={errors.email ? 'error' : ''}
                />
              </div>
              {errors.email && <span className="error-message">{errors.email}</span>}
            </div>

            {!isLogin && (
              <div className="form-group">
                <div className="input-icon-wrapper">
                  <FaPhone className="input-icon" />
                  <input
                    type="tel"
                    name="phone"
                    placeholder="Phone Number"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className={errors.phone ? 'error' : ''}
                  />
                </div>
                {errors.phone && <span className="error-message">{errors.phone}</span>}
              </div>
            )}

            {!isLogin && (
              <>

                    <div className="form-group">
                      <div className="input-icon-wrapper">
                        <FaVenusMars className="input-icon" />
                        <select
                          name="gender"
                          value={formData.gender}
                          onChange={handleInputChange}
                          className={errors.gender ? 'error' : ''}
                        >
                          <option value="">Select Gender</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      {errors.gender && <span className="error-message">{errors.gender}</span>}
                    </div>

                    <div className="form-group">
                      <div className="input-icon-wrapper">
                        <FaBirthdayCake className="input-icon" />
                        <input
                          type="number"
                          name="age"
                          placeholder="Age"
                          value={formData.age}
                          onChange={handleInputChange}
                          className={errors.age ? 'error' : ''}
                        />
                      </div>
                      {errors.age && <span className="error-message">{errors.age}</span>}
                    </div>

                    <div className="form-group">
                      <div className="input-icon-wrapper">
                        <FaBriefcase className="input-icon" />
                        <input
                          type="text"
                          name="occupation"
                          placeholder="Occupation"
                          value={formData.occupation}
                          onChange={handleInputChange}
                          className={errors.occupation ? 'error' : ''}
                        />
                      </div>
                      {errors.occupation && <span className="error-message">{errors.occupation}</span>}
                    </div>

              </>
            )}

            <div className="form-group">
              <div className="input-icon-wrapper">
                <FaLock className="input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className={errors.password ? 'error' : ''}
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
              {errors.password && <span className="error-message">{errors.password}</span>}
            </div>

            {!isLogin && (
              <div className="form-group">
                <div className="input-icon-wrapper">
                  <FaLock className="input-icon" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    placeholder="Confirm Password"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className={errors.confirmPassword ? 'error' : ''}
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <span className="error-message">{errors.confirmPassword}</span>
                )}
              </div>
            )}

            <button type="submit" className="submit-btn">
              {isLogin ? 'Login' : 'Sign Up'}
            </button>
          </form>

          <p className="toggle-form-text">
            {isLogin ? "Don't have an account?" : 'Already have an account?'}
            <button type="button" className="toggle-form-btn" onClick={toggleForm}>
              {isLogin ? 'Sign Up' : 'Login'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default PatientAuthPage;