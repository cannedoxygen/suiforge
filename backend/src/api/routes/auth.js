// auth.js - API routes for authentication
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { 
  beginLoginFlow, 
  completeLoginFlow, 
  getUserSession,
  isAuthenticated,
  endSession 
} = require('../../auth/zklogin');

/**
 * @route POST /api/auth/login/begin
 * @description Begin zkLogin authentication flow
 * @access Public
 */
router.post('/login/begin', async (req, res) => {
  try {
    // Generate a unique user ID for this session
    const userId = uuidv4();
    
    // Begin the zkLogin flow
    const authData = beginLoginFlow(userId);
    
    // Return authentication challenge data
    return res.status(200).json({
      success: true,
      userId,
      ...authData,
    });
  } catch (error) {
    console.error("Error beginning login flow:", error);
    return res.status(500).json({
      success: false,
      message: 'Authentication initialization failed',
      error: error.message,
    });
  }
});

/**
 * @route POST /api/auth/login/complete
 * @description Complete zkLogin authentication flow
 * @access Public
 */
router.post('/login/complete', async (req, res) => {
  try {
    const { userId, jwtToken, zkProof } = req.body;
    
    if (!userId || !jwtToken || !zkProof) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters',
      });
    }
    
    // Complete the zkLogin flow
    const authResult = await completeLoginFlow(userId, jwtToken, zkProof);
    
    if (!authResult.success) {
      return res.status(401).json({
        success: false,
        message: 'Authentication failed',
        error: authResult.error,
      });
    }
    
    // Return session data
    return res.status(200).json({
      success: true,
      userId,
      address: authResult.address,
      userInfo: authResult.userInfo,
    });
  } catch (error) {
    console.error("Error completing login flow:", error);
    return res.status(500).json({
      success: false,
      message: 'Authentication failed',
      error: error.message,
    });
  }
});

/**
 * @route GET /api/auth/session
 * @description Get current session data
 * @access Private
 */
router.get('/session', (req, res) => {
  try {
    // Get user ID from authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }
    
    const userId = authHeader.split(' ')[1];
    
    // Check if user is authenticated
    if (!isAuthenticated(userId)) {
      return res.status(401).json({
        success: false,
        message: 'Session expired or invalid',
      });
    }
    
    // Get session data
    const sessionData = getUserSession(userId);
    
    if (!sessionData) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
      });
    }
    
    // Return session data
    return res.status(200).json({
      success: true,
      userId,
      ...sessionData,
    });
  } catch (error) {
    console.error("Error getting session:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get session',
      error: error.message,
    });
  }
});

/**
 * @route POST /api/auth/logout
 * @description End the current session
 * @access Private
 */
router.post('/logout', (req, res) => {
  try {
    // Get user ID from authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }
    
    const userId = authHeader.split(' ')[1];
    
    // End the session
    endSession(userId);
    
    // Return success
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error("Error logging out:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to log out',
      error: error.message,
    });
  }
});

/**
 * @route GET /api/auth/providers
 * @description Get available authentication providers
 * @access Public
 */
router.get('/providers', (req, res) => {
  // Return available OAuth providers
  return res.status(200).json({
    success: true,
    providers: [
      {
        id: 'google',
        name: 'Google',
        icon: '/images/providers/google.svg',
      },
      {
        id: 'twitter',
        name: 'Twitter',
        icon: '/images/providers/twitter.svg',
      },
      {
        id: 'facebook',
        name: 'Facebook',
        icon: '/images/providers/facebook.svg',
      },
    ],
  });
});

module.exports = router;