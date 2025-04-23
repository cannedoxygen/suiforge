import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ConnectButton } from '@mysten/wallet-kit';
import { useAuth } from '../context/AuthContext';
import '../styles/Navbar.css';

const Navbar = ({ openAuthModal, darkMode, toggleDarkMode }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const { isAuthenticated, userInfo, logout } = useAuth();

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Close mobile menu when location changes
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location]);

  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="navbar-container">
        <div className="navbar-logo">
          <Link to="/">
            <img 
              src={darkMode ? '/logo-light.svg' : '/logo-dark.svg'} 
              alt="SuiForge Logo" 
              className="logo" 
            />
            <span className="logo-text">SuiForge</span>
          </Link>
        </div>

        <div className="navbar-right">
          {/* Desktop Navigation */}
          <ul className="navbar-links desktop-nav">
            <li className={location.pathname === '/' ? 'active' : ''}>
              <Link to="/">Home</Link>
            </li>
            <li className={location.pathname === '/create' ? 'active' : ''}>
              <Link to="/create">Create Token</Link>
            </li>
            <li className={location.pathname === '/tokens' ? 'active' : ''}>
              <Link to="/tokens">Explore</Link>
            </li>
            <li className={location.pathname === '/docs' ? 'active' : ''}>
              <Link to="/docs">Docs</Link>
            </li>
            {isAuthenticated && (
              <li className={location.pathname === '/dashboard' ? 'active' : ''}>
                <Link to="/dashboard">Dashboard</Link>
              </li>
            )}
          </ul>

          <div className="navbar-actions">
            <button 
              onClick={toggleDarkMode} 
              className="theme-toggle"
              aria-label="Toggle theme"
            >
              {darkMode ? '☀️' : '🌙'}
            </button>

            <div className="auth-buttons">
              {isAuthenticated ? (
                <div className="user-menu">
                  <button className="user-button">
                    {userInfo?.name?.charAt(0) || '👤'}
                  </button>
                  <div className="user-dropdown">
                    <div className="user-info">
                      <span className="user-name">{userInfo?.name}</span>
                      <span className="user-address">{userInfo?.address?.substring(0, 6)}...{userInfo?.address?.substring(62)}</span>
                    </div>
                    <Link to="/dashboard" className="dropdown-item">Dashboard</Link>
                    <Link to="/tokens" className="dropdown-item">My Tokens</Link>
                    <button onClick={logout} className="dropdown-item logout">Logout</button>
                  </div>
                </div>
              ) : (
                <>
                  <button 
                    onClick={openAuthModal}
                    className="zklogin-button"
                  >
                    zkLogin
                  </button>
                  <div id="wallet-btn" className="wallet-button">
                    <ConnectButton />
                  </div>
                </>
              )}
            </div>

            {/* Mobile menu toggle */}
            <button
              className="menu-toggle"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMenuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="mobile-nav">
          <ul className="navbar-links">
            <li className={location.pathname === '/' ? 'active' : ''}>
              <Link to="/">Home</Link>
            </li>
            <li className={location.pathname === '/create' ? 'active' : ''}>
              <Link to="/create">Create Token</Link>
            </li>
            <li className={location.pathname === '/tokens' ? 'active' : ''}>
              <Link to="/tokens">Explore</Link>
            </li>
            <li className={location.pathname === '/docs' ? 'active' : ''}>
              <Link to="/docs">Docs</Link>
            </li>
            {isAuthenticated && (
              <li className={location.pathname === '/dashboard' ? 'active' : ''}>
                <Link to="/dashboard">Dashboard</Link>
              </li>
            )}
          </ul>
          
          <div className="mobile-actions">
            {!isAuthenticated && (
              <button onClick={openAuthModal} className="zklogin-button mobile-full">
                Login with zkLogin
              </button>
            )}
            
            {isAuthenticated && (
              <button onClick={logout} className="logout-button mobile-full">
                Logout
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;