import React from 'react';
import './Footer.css';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-left">
          <span className="footer-trademark">
            © {currentYear} ManoSwara™. All rights reserved.
          </span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;