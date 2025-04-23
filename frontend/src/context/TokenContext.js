import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

// Create the token context
const TokenContext = createContext();

// Custom hook to use the token context
export const useToken = () => useContext(TokenContext);

export const TokenProvider = ({ children }) => {
  const { isAuthenticated, userId } = useAuth();
  const [userTokens, setUserTokens] = useState([]);
  const [trendingTokens, setTrendingTokens] = useState([]);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Fetch user's tokens when authenticated
  useEffect(() => {
    if (isAuthenticated && userId) {
      fetchUserTokens();
    } else {
      setUserTokens([]);
    }
  }, [isAuthenticated, userId]);
  
  // Fetch trending tokens on initial load
  useEffect(() => {
    fetchTrendingTokens();
  }, []);
  
  // Fetch user's tokens
  const fetchUserTokens = async () => {
    try {
      setTokenLoading(true);
      setError(null);
      
      // In a real implementation, this would be a call to your API
      // For now, using mock data
      
      // Simulating API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock user tokens
      const mockUserTokens = [
        {
          id: '0xabc123',
          name: 'My First Token',
          symbol: 'MFT',
          createdAt: new Date().toISOString(),
          price: 0.000015,
          change24h: 5.3,
          marketCap: 15000,
          imageUrl: '/tokens/mft_static.png'
        },
        {
          id: '0xdef456',
          name: 'Rocket Moon',
          symbol: 'RMOON',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          price: 0.000042,
          change24h: 12.7,
          marketCap: 42000,
          imageUrl: '/tokens/rmoon_static.png'
        }
      ];
      
      setUserTokens(mockUserTokens);
    } catch (error) {
      console.error('Fetch user tokens error:', error);
      setError('Failed to fetch your tokens');
    } finally {
      setTokenLoading(false);
    }
  };
  
  // Fetch trending tokens
  const fetchTrendingTokens = async () => {
    try {
      setTokenLoading(true);
      
      // In a real implementation, this would be a call to your API
      // For now, using mock data or we could use the token API route
      
      const response = await axios.get('/api/token/trending');
      
      if (response.data.success) {
        setTrendingTokens(response.data.trending);
      } else {
        throw new Error(response.data.message || 'Failed to fetch trending tokens');
      }
    } catch (error) {
      console.error('Fetch trending tokens error:', error);
      
      // Fallback to mock data if API fails
      const mockTrendingTokens = [
        {
          id: '0x123456',
          name: 'Pepe Moon',
          symbol: 'PEMO',
          price: 0.0000324,
          change24h: 15.7,
          volume24h: 453213,
          imageUrl: '/tokens/pemo_static.png'
        },
        {
          id: '0x789012',
          name: 'Rocket Doge',
          symbol: 'RKDG',
          price: 0.0000127,
          change24h: 7.3,
          volume24h: 278932,
          imageUrl: '/tokens/rkdg_static.png'
        },
        {
          id: '0x345678',
          name: 'Banana Cat',
          symbol: 'BCAT',
          price: 0.0000934,
          change24h: -3.2,
          volume24h: 124573,
          imageUrl: '/tokens/bcat_static.png'
        }
      ];
      
      setTrendingTokens(mockTrendingTokens);
    } finally {
      setTokenLoading(false);
    }
  };
  
  // Get token details by ID
  const getTokenById = async (tokenId) => {
    try {
      setTokenLoading(true);
      setError(null);
      
      const response = await axios.get(`/api/token/${tokenId}/info`);
      
      if (response.data.success) {
        return response.data.tokenInfo;
      } else {
        throw new Error(response.data.message || 'Failed to fetch token info');
      }
    } catch (error) {
      console.error('Get token error:', error);
      setError('Failed to fetch token details');
      return null;
    } finally {
      setTokenLoading(false);
    }
  };
  
  // Generate token preview
  const generateTokenPreview = async (tokenParams) => {
    try {
      setTokenLoading(true);
      setError(null);
      
      const response = await axios.post('/api/token/preview', tokenParams);
      
      if (response.data.success) {
        return response.data.tokenPreview;
      } else {
        throw new Error(response.data.message || 'Failed to generate preview');
      }
    } catch (error) {
      console.error('Preview generation error:', error);
      setError(error.message || 'Failed to generate token preview');
      return null;
    } finally {
      setTokenLoading(false);
    }
  };
  
  // Create a new token
  const createToken = async (tokenParams) => {
    try {
      if (!isAuthenticated) {
        throw new Error('Authentication required');
      }
      
      setTokenLoading(true);
      setError(null);
      
      const response = await axios.post('/api/token/create', tokenParams, {
        headers: {
          Authorization: `Bearer ${userId}`
        }
      });
      
      if (response.data.success) {
        // Refresh user tokens
        fetchUserTokens();
        return response.data;
      } else {
        throw new Error(response.data.message || 'Failed to create token');
      }
    } catch (error) {
      console.error('Token creation error:', error);
      setError(error.message || 'Failed to create token');
      return { success: false, error: error.message };
    } finally {
      setTokenLoading(false);
    }
  };

  // Context value
  const value = {
    userTokens,
    trendingTokens,
    tokenLoading,
    error,
    fetchUserTokens,
    fetchTrendingTokens,
    getTokenById,
    generateTokenPreview,
    createToken
  };

  return <TokenContext.Provider value={value}>{children}</TokenContext.Provider>;
};

export default TokenContext;