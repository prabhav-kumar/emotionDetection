import React, { useState } from 'react';
import PatientNavbar from './PatientNavbar';
import Footer from '../Footer';
import { FaEnvelope, FaPhone, FaMapMarkerAlt } from 'react-icons/fa';
import '../styles/ContactPage.css';

const PatientContactPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  const [formErrors, setFormErrors] = useState({});

  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = 'Name is required';
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email';
    }
    if (!formData.subject.trim()) errors.subject = 'Subject is required';
    if (!formData.message.trim()) errors.message = 'Message is required';
    return errors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errors = validateForm();
    if (Object.keys(errors).length === 0) {
      // Here you would typically send the form data to your backend
      console.log('Form submitted:', formData);
      // Reset form
      setFormData({ name: '', email: '', subject: '', message: '' });
      alert('Thank you for your message. We will get back to you soon!');
    } else {
      setFormErrors(errors);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  return (
    <div className="contact-page">
      <PatientNavbar />
      <div className="contact-content">
        <h1>Contact Us</h1>
        <div className="contact-container">
          <div className="contact-info">
            <div className="info-item">
              <FaEnvelope className="info-icon" />
              <div className='heading'>
                <pre className='subheading'>Email:</pre>
                <pre>support@manoswara.com</pre>
              </div>
            </div>
            <div className="info-item">
              <FaPhone className="info-icon" />
              <div className='heading'>
                <pre className='subheading'>Phone:</pre>
                <pre>+91 90597 17805</pre>
              </div>
            </div>
            <div className="info-item">
              <FaMapMarkerAlt className="info-icon" />
              <div className='heading'>
                <pre className='subheading'>Address:</pre>
                <pre>Hyderabad, Telangana</pre>
              </div>
            </div>
          </div>
          <div className="map-container" style={{ marginTop: '2rem', width: '100%' }}>
            <iframe
              title="Google Maps"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3806.406234833635!2d78.4866713148776!3d17.3850440880707!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bcb973e6b7e0c1b%3A0x7d1b1b1b1b1b1b1b!2sHyderabad%2C%20Telangana!5e0!3m2!1sen!2sin!4v1680000000000!5m2!1sen!2sin"
              width="100%"
              height="300"
              style={{ border: 0 }}
              allowFullScreen=""
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            ></iframe>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default PatientContactPage;
