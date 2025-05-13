import React, { useState } from 'react';
import PatientNavbar from './PatientNavbar';
import Footer from '../Footer';
import '../styles/FAQsPage.css';

const PatientFAQs = () => {
  const faqs = [
    {
      question: 'How do I find the right therapist for me?',
      answer: 'Our platform helps match you with therapists based on your specific needs, preferences, and goals. You can browse therapist profiles, read their specializations, and book initial consultations to find the best fit.'
    },
    {
      question: 'What can I expect in my first therapy session?',
      answer: "Your first session is typically an introduction where you'll discuss your goals, concerns, and background. Your therapist will explain their approach and together you'll develop a plan for your therapy journey."
    },
    {
      question: 'How does online therapy work?',
      answer: "Online therapy sessions are conducted through our secure video platform. You'll need a private space, stable internet connection, and a device with a camera and microphone. Sessions are as effective as in-person therapy with the added convenience of accessing care from home."
    },
    {
      question: 'How does the emotion recognition feature help me?',
      answer: 'Our emotion recognition technology helps track emotional patterns during sessions, providing insights that can enhance self-awareness and therapy effectiveness. This information helps both you and your therapist better understand your emotional responses and progress.'
    },
    {
      question: 'What are the costs and payment options?',
      answer: 'Session fees vary by therapist and session type. We accept various payment methods and can provide documentation for insurance reimbursement. Some therapists offer sliding scale fees based on financial need.'
    },
    {
      question: 'How do I schedule or reschedule sessions?',
      answer: 'You can easily schedule sessions through our platform by selecting available time slots in your therapist\'s calendar. To reschedule, simply cancel and rebook with at least 24 hours notice to avoid any cancellation fees.'
    }
  ];

  const [activeIndex, setActiveIndex] = useState(null);

  const toggleFAQ = (index) => {
    setActiveIndex(activeIndex === index ? null : index);
  };

  return (
    <div className="faqs-page">
      <PatientNavbar />
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

export default PatientFAQs;