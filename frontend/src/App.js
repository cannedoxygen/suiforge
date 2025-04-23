import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { WalletKitProvider } from '@mysten/wallet-kit';

// Import pages
import Home from './pages/Home';
import CreateToken from './pages/CreateToken';
import TokenExplorer from './pages/TokenExplorer';
import TokenDetail from './pages/TokenDetail';
import Dashboard from './pages/Dashboard';

// Import components
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import AuthModal from './components/AuthModal';

// Import context
import { AuthProvider } from './context/AuthContext';
import { TokenProvider } from './context/TokenContext';

// Import styles
import './styles/App.css';

function App() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  // Toggle dark mode
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    localStorage.setItem('darkMode', !darkMode);
  };

  // Check for dark mode preference on initial load
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode !== null) {
      setDarkMode(savedDarkMode === 'true');
    } else {
      // Check user's system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setDarkMode(prefersDark);
      localStorage.setItem('darkMode', prefersDark);
    }
  }, []);

  return (
    <Router>
      <WalletKitProvider>
        <AuthProvider>
          <TokenProvider>
            <div className={`app ${darkMode ? 'dark' : 'light'}`}>
              <Navbar 
                openAuthModal={() => setIsAuthModalOpen(true)} 
                darkMode={darkMode}
                toggleDarkMode={toggleDarkMode}
              />
              
              <main className="main-content">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/create" element={<CreateToken />} />
                  <Route path="/tokens" element={<TokenExplorer />} />
                  <Route path="/token/:tokenId" element={<TokenDetail />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
              
              <Footer />
              
              {/* Auth Modal */}
              <AuthModal 
                isOpen={isAuthModalOpen} 
                onClose={() => setIsAuthModalOpen(false)} 
              />
            </div>
          </TokenProvider>
        </AuthProvider>
      </WalletKitProvider>
    </Router>
  );
}

export default App;