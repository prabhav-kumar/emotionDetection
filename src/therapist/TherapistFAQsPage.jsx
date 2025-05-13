import React, { useState } from 'react';
import TherapistNavbar from './TherapistNavbar';
import Footer from '../Footer';
import '../styles/FAQsPage.css';

const TherapistFAQsPage = () => {
  const faqs = [
    {
      question: 'What is emotion recognition technology?',
      answer: 'Emotion recognition technology uses advanced AI algorithms to analyze facial expressions, voice patterns, and other behavioral cues to identify and understand human emotions in real-time.'
    },
    {
      question: 'How does online therapy work on this platform?',
      answer: 'Our platform connects you with licensed therapists through secure video sessions. You can schedule appointments, have therapy sessions from the comfort of your home, and access emotional insights powered by our technology.'
    },
    {
      question: 'Is my data secure and confidential?',
      answer: 'Yes, we take privacy very seriously. All sessions are encrypted end-to-end, and your data is stored securely following HIPAA compliance guidelines. Only you and your therapist have access to your session information.'
    },
    {
      question: 'What types of therapy are available?',
      answer: 'We offer various therapy types including Cognitive Behavioral Therapy (CBT), Mindfulness-Based Therapy, Psychodynamic Therapy, and more. Your therapist will work with you to determine the best approach for your needs.'
    },
    {
      question: 'How can I schedule a session?',
      answer: "You can easily schedule sessions through our platform. Simply log in to your account, view available time slots from your therapist, and book the one that works best for you. You'll receive confirmation and reminder notifications."
    },
    {
      question: 'What if I need to cancel or reschedule?',
      answer: 'We understand that plans can change. You can cancel or reschedule your session up to 24 hours before the appointment without any charge. Late cancellations may incur a fee as per our policy.'
    }
  ];

  const [activeIndex, setActiveIndex] = useState(null);

  const toggleFAQ = (index) => {
    setActiveIndex(activeIndex === index ? null : index);
  };

  return (
    <div className="faqs-page">
      <TherapistNavbar />
      <div className="faqs-container">
        <h1>Frequently Asked Questions</h1>
        <div className="faqs-list">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className={`faq-item ${activeIndex === index ? 'active' : ''}`}
              onClick={() => toggleFAQ(index)}
            >
              <div className="faq-question">
                <span>{faq.question}</span>
                <div className="plus-icon">
                  {activeIndex === index ? '−' : '+'}
                </div>
              </div>
              <div className={`faq-answer ${activeIndex === index ? 'show' : ''}`}>
                {faq.answer}
              </div>
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default TherapistFAQsPage;