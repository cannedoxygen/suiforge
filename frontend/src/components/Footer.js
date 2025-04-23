import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Footer.css';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-main">
          <div className="footer-brand">
            <Link to="/" className="footer-logo">
              <img src="/logo-light.svg" alt="SuiForge Logo" />
              <span>SuiForge</span>
            </Link>
            <p className="footer-tagline">
              AI-Powered Token Launchpad on Sui
            </p>
            <div className="social-links">
              <a href="https://twitter.com/SuiForge_AI" target="_blank" rel="noopener noreferrer" aria-label="Twitter">
                <img src="/images/social/twitter.svg" alt="Twitter" />
              </a>
              <a href="https://t.me/SuiForge" target="_blank" rel="noopener noreferrer" aria-label="Telegram">
                <img src="/images/social/telegram.svg" alt="Telegram" />
              </a>
              <a href="https://discord.gg/suiforge" target="_blank" rel="noopener noreferrer" aria-label="Discord">
                <img src="/images/social/discord.svg" alt="Discord" />
              </a>
              <a href="https://github.com/suiforge" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
                <img src="/images/social/github.svg" alt="GitHub" />
              </a>
            </div>
          </div>

          <div className="footer-links">
            <div className="footer-links-column">
              <h3>Platform</h3>
              <ul>
                <li><Link to="/create">Create Token</Link></li>
                <li><Link to="/tokens">Explore</Link></li>
                <li><Link to="/dashboard">Dashboard</Link></li>
                <li><Link to="/docs">Documentation</Link></li>
              </ul>
            </div>

            <div className="footer-links-column">
              <h3>Resources</h3>
              <ul>
                <li><Link to="/docs/guides">Guides</Link></li>
                <li><Link to="/docs/api">API</Link></li>
                <li><Link to="/faq">FAQ</Link></li>
                <li><a href="https://github.com/suiforge" target="_blank" rel="noopener noreferrer">GitHub</a></li>
              </ul>
            </div>

            <div className="footer-links-column">
              <h3>Company</h3>
              <ul>
                <li><Link to="/about">About</Link></li>
                <li><Link to="/blog">Blog</Link></li>
                <li><Link to="/careers">Careers</Link></li>
                <li><Link to="/contact">Contact</Link></li>
              </ul>
            </div>

            <div className="footer-links-column">
              <h3>Legal</h3>
              <ul>
                <li><Link to="/terms">Terms of Service</Link></li>
                <li><Link to="/privacy">Privacy Policy</Link></li>
                <li><Link to="/disclaimer">Disclaimer</Link></li>
                <li><Link to="/cookies">Cookie Policy</Link></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="footer-newsletter">
          <h3>Stay Updated</h3>
          <p>Subscribe to our newsletter for the latest updates and features</p>
          <form className="newsletter-form">
            <input type="email" placeholder="Your email address" required />
            <button type="submit">Subscribe</button>
          </form>
        </div>

        <div className="footer-bottom">
          <div className="copyright">
            © {currentYear} SuiForge. All rights reserved.
          </div>
          <div className="built-on">
            Built on <a href="https://sui.io" target="_blank" rel="noopener noreferrer">Sui Blockchain</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;