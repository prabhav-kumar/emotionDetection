import React from 'react';
import '../styles/AboutPage.css';
import Footer from '../Footer';
import TherapistNavbar from './TherapistNavbar';

const TherapistAboutPage = () => {
  const teamMembers = [
    {
      name: 'Prabhav',
      image: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23E2E8F0"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="16" fill="%234A5568">Prabhav</text></svg>',
      role: 'Co-founder'
    },
    {
      name: 'Vivek',
      image: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23E2E8F0"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="16" fill="%234A5568">Vivek</text></svg>',
      role: 'Co-founder'
    },
    {
      name: 'Praneeth',
      image: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23E2E8F0"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="16" fill="%234A5568">Praneeth</text></svg>',
      role: 'Co-founder'
    }
  ];

  const technologies = [
    'React.js',
    'Vite',
    'CSS3',
    'Node.js',
    'Express.js',
    'MongoDB',
    'WebRTC',
    'Socket.io'
  ];

  return (
    <div className="about-page">
      <div className="page-content">
        <TherapistNavbar />

        <main className="main-content">
      <section className="about-section vision-section">
        <h1>About ManoSwara</h1>
        <p>
          ManoSwara was born from a vision to revolutionize mental health support through technology.
          We recognized the growing need for accessible, personalized therapy solutions in today's
          fast-paced world. Our platform combines cutting-edge technology with human empathy to
          create a space where individuals can connect with qualified therapists seamlessly.
        </p>
      </section>

      <section className="about-section tech-section">
        <h2>Our Technology Stack</h2>
        <div className="tech-grid">
          {technologies.map((tech, index) => (
            <div key={index} className="tech-item">
              {tech}
            </div>
          ))}
        </div>
      </section>

      <section className="about-section team-section">
        <h2>Meet Our Team</h2>
        <div className="team-grid">
          {teamMembers.map((member, index) => (
            <div key={index} className="team-member">
              <div className="member-image">
                <img src={member.image} alt={member.name} />
              </div>
              <h3>{member.name}</h3>
              <p>{member.role}</p>
            </div>
          ))}
        </div>
      </section>
        </main>
      </div>
      <Footer />
    </div>
  );
};

export default TherapistAboutPage;