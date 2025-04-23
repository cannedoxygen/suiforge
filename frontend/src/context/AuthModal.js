import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import '../styles/AuthModal.css';

const AuthModal = ({ isOpen, onClose }) => {
  const { authLoading, error, beginLoginFlow, completeLoginFlow } = useAuth();
  const [step, setStep] = useState('initial'); // initial, waiting, success
  const [providers, setProviders] = useState([
    { id: 'google', name: 'Google', icon: '/images/providers/google.svg' },
    { id: 'twitter', name: 'Twitter', icon: '/images/providers/twitter.svg' },
    { id: 'facebook', name: 'Facebook', icon: '/images/providers/facebook.svg' }
  ]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [loginData, setLoginData] = useState(null);
  const [zkLoginWindow, setZkLoginWindow] = useState(null);

  // Close modal when escape key is pressed
  useEffect(() => {
    const handleEscapeKey = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [onClose]);

  // Reset state when modal is opened
  useEffect(() => {
    if (isOpen) {
      setStep('initial');
      setSelectedProvider(null);
      setLoginData(null);
    }
  }, [isOpen]);

  // Handle login window messages
  useEffect(() => {
    const handleLoginMessage = async (event) => {
      // In a real implementation, you'd verify the origin
      if (event.data && event.data.type === 'zkLoginComplete') {
        // Close the popup window
        if (zkLoginWindow) {
          zkLoginWindow.close();
          setZkLoginWindow(null);
        }

        const { jwtToken, zkProof } = event.data;
        
        if (jwtToken && zkProof && loginData) {
          // Complete the login flow
          const success = await completeLoginFlow({
            userId: loginData.userId,
            jwtToken,
            zkProof
          });

          if (success) {
            setStep('success');
            // Close modal after a short delay
            setTimeout(() => {
              onClose();
            }, 2000);
          }
        }
      }
    };

    window.addEventListener('message', handleLoginMessage);
    return () => {
      window.removeEventListener('message', handleLoginMessage);
    };
  }, [zkLoginWindow, loginData, completeLoginFlow, onClose]);

  // Start login with selected provider
  const startLogin = async (provider) => {
    setSelectedProvider(provider);
    setStep('waiting');

    // Begin the login flow
    const authData = await beginLoginFlow();
    
    if (!authData) {
      setStep('initial');
      return;
    }

    setLoginData(authData);

    // In a real implementation, you'd redirect to the OAuth provider
    // with the zkLogin parameters
    
    // For simplicity, we'll simulate opening a popup window
    const authUrl = `https://example.com/zklogin?provider=${provider.id}&userId=${authData.userId}&nonce=${authData.nonce}&ephemeralPublicKey=${encodeURIComponent(authData.ephemeralPublicKey)}`;
    
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const loginWindow = window.open(
      authUrl,
      'zkLogin',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
    );
    
    setZkLoginWindow(loginWindow);

    // For demo purposes, simulate successful login after 3 seconds
    setTimeout(() => {
      window.postMessage({
        type: 'zkLoginComplete',
        jwtToken: 'simulated.jwt.token',
        zkProof: { simulated: 'zkproof' }
      }, window.location.origin);
    }, 3000);
  };

  if (!isOpen) return null;

  return (
    <div className="auth-modal-overlay">
      <div className="auth-modal">
        <button className="close-button" onClick={onClose}>×</button>

        <div className="auth-modal-content">
          {step === 'initial' && (
            <>
              <h2>Login with zkLogin</h2>
              <p className="auth-subtitle">
                No crypto wallet needed! Sign in using your social accounts.
              </p>

              {error && <div className="auth-error">{error}</div>}

              <div className="provider-list">
                {providers.map(provider => (
                  <button
                    key={provider.id}
                    className="provider-button"
                    onClick={() => startLogin(provider)}
                    disabled={authLoading}
                  >
                    <img 
                      src={provider.icon}
                      alt={provider.name}
                      className="provider-icon"
                    />
                    <span>Continue with {provider.name}</span>
                  </button>
                ))}
              </div>

              <div className="auth-info">
                <p>By signing in, you'll create a Sui address linked to your social account.</p>
                <p className="privacy-note">We never store your passwords or private keys.</p>
              </div>
            </>
          )}

          {step === 'waiting' && (
            <div className="auth-waiting">
              <div className="auth-spinner"></div>
              <h3>Authenticating with {selectedProvider?.name}</h3>
              <p>Please complete the authentication in the popup window.</p>
              <p className="small-text">If no popup appeared, please check your popup blocker.</p>
            </div>
          )}

          {step === 'success' && (
            <div className="auth-success">
              <div className="success-icon">✓</div>
              <h3>Login Successful!</h3>
              <p>You're now signed in with zkLogin.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;