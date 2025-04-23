import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

// Create the auth context
const AuthContext = createContext();

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Initialize auth state from local storage
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const storedUserId = localStorage.getItem('userId');
        
        if (!storedUserId) {
          setAuthLoading(false);
          return;
        }
        
        // Fetch session data from API
        const response = await axios.get('/api/auth/session', {
          headers: {
            Authorization: `Bearer ${storedUserId}`
          }
        });
        
        if (response.data.success) {
          setIsAuthenticated(true);
          setUserId(storedUserId);
          setUserInfo(response.data);
        } else {
          // Clear invalid session
          localStorage.removeItem('userId');
        }
      } catch (error) {
        console.error('Auth check error:', error);
        localStorage.removeItem('userId');
        setError('Session expired or invalid');
      } finally {
        setAuthLoading(false);
      }
    };
    
    checkAuth();
  }, []);
  
  // Begin zkLogin flow
  const beginLoginFlow = async () => {
    try {
      setAuthLoading(true);
      setError(null);
      
      const response = await axios.post('/api/auth/login/begin');
      
      if (response.data.success) {
        return response.data;
      } else {
        throw new Error(response.data.message || 'Failed to begin login flow');
      }
    } catch (error) {
      console.error('Begin login error:', error);
      setError(error.message || 'Failed to begin login');
      return null;
    } finally {
      setAuthLoading(false);
    }
  };
  
  // Complete zkLogin flow
  const completeLoginFlow = async (loginData) => {
    try {
      setAuthLoading(true);
      setError(null);
      
      const { userId, jwtToken, zkProof } = loginData;
      
      const response = await axios.post('/api/auth/login/complete', {
        userId,
        jwtToken,
        zkProof
      });
      
      if (response.data.success) {
        // Store user ID in local storage
        localStorage.setItem('userId', userId);
        
        // Update auth state
        setIsAuthenticated(true);
        setUserId(userId);
        setUserInfo(response.data);
        
        return true;
      } else {
        throw new Error(response.data.message || 'Login failed');
      }
    } catch (error) {
      console.error('Complete login error:', error);
      setError(error.message || 'Login failed');
      return false;
    } finally {
      setAuthLoading(false);
    }
  };
  
  // Logout
  const logout = async () => {
    try {
      setAuthLoading(true);
      
      if (userId) {
        // Call logout API
        await axios.post('/api/auth/logout', {}, {
          headers: {
            Authorization: `Bearer ${userId}`
          }
        });
      }
      
      // Clear local storage
      localStorage.removeItem('userId');
      
      // Update auth state
      setIsAuthenticated(false);
      setUserId(null);
      setUserInfo(null);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setAuthLoading(false);
    }
  };

  // Context value
  const value = {
    isAuthenticated,
    userId,
    userInfo,
    authLoading,
    error,
    beginLoginFlow,
    completeLoginFlow,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;