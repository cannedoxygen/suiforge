// liquidity.js - API routes for liquidity management
const express = require('express');
const router = express.Router();
const { JsonRpcProvider } = require('@mysten/sui.js');
const { provideLiquidity } = require('../../dex/deepbook');
const { lockLiquidity } = require('../../dex/cetus');
const config = require('../../../config/default');
const { isAuthenticated, createUserSigner } = require('../../auth/zklogin');

// Initialize Sui provider
const provider = new JsonRpcProvider({ fullnode: process.env.SUI_RPC_URL || config.sui.rpcUrl });

/**
 * @route POST /api/liquidity/provide
 * @description Provide liquidity for a token
 * @access Private
 */
router.post('/provide', async (req, res) => {
  try {
    // Check authentication
    if (!req.headers.authorization) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }
    
    const authParts = req.headers.authorization.split(' ');
    
    if (authParts.length !== 2 || authParts[0] !== 'Bearer') {
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication format',
      });
    }
    
    const userId = authParts[1];
    
    if (!isAuthenticated(userId)) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
    }
    
    // Get parameters from request body
    const { tokenId, tokenAmount, suiAmount } = req.body;
    
    if (!tokenId || !tokenAmount || !suiAmount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters',
      });
    }
    
    // Validate token ID format
    if (!tokenId.startsWith('0x')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid token ID format',
      });
    }
    
    // Convert amounts to BigInt
    const tokenAmountBigInt = BigInt(tokenAmount);
    const suiAmountBigInt = BigInt(suiAmount);
    
    // Provide liquidity
    const result = await provideLiquidity(tokenId, tokenAmountBigInt, suiAmountBigInt);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to provide liquidity',
        error: result.error,
      });
    }
    
    // Return result
    return res.status(200).json({
      success: true,
      poolId: result.poolId,
      basePrice: result.basePrice.toString(),
      orderCount: result.orderCount,
      transactionDigest: result.transactionDigest,
    });
  } catch (error) {
    console.error("Error providing liquidity:", error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
});

/**
 * @route POST /api/liquidity/lock
 * @description Lock liquidity for a token
 * @access Private
 */
router.post('/lock', async (req, res) => {
  try {
    // Check authentication
    if (!req.headers.authorization) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }
    
    const authParts = req.headers.authorization.split(' ');
    
    if (authParts.length !== 2 || authParts[0] !== 'Bearer') {
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication format',
      });
    }
    
    const userId = authParts[1];
    
    if (!isAuthenticated(userId)) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
    }
    
    // Get parameters from request body
    const { tokenId, lockDuration } = req.body;
    
    if (!tokenId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters',
      });
    }
    
    // Validate token ID format
    if (!tokenId.startsWith('0x')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid token ID format',
      });
    }
    
    // Use default lock duration if not provided
    const duration = lockDuration || config.liquidity.lockDuration;
    
    // Lock liquidity
    const result = await lockLiquidity(tokenId, duration);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to lock liquidity',
        error: result.error,
      });
    }
    
    // Return result
    return res.status(200).json({
      success: true,
      lockId: result.lockId,
      lockDuration: duration,
      unlockTime: result.unlockTime,
      transactionDigest: result.transactionDigest,
    });
  } catch (error) {
    console.error("Error locking liquidity:", error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
});

/**
 * @route GET /api/liquidity/info/:tokenId
 * @description Get liquidity information for a token
 * @access Public
 */
router.get('/info/:tokenId', async (req, res) => {
  try {
    const { tokenId } = req.params;
    
    // Validate token ID format
    if (!tokenId.startsWith('0x')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid token ID format',
      });
    }
    
    // Get pool information from DeepBook
    // This is a simplified example - in a real implementation,
    // you would query the actual DeepBook contract
    const poolInfo = {
      tokenId,
      poolId: '0x...',  // Would be the actual pool ID
      liquidity: {
        tokenAmount: '1000000000',
        suiAmount: '50000000000',
      },
      price: '0.00005',
      volume24h: Math.floor(Math.random() * 5000000),
      locked: true,
      lockDuration: config.liquidity.lockDuration,
      unlockTime: Math.floor(Date.now() / 1000) + config.liquidity.lockDuration,
    };
    
    // Return pool information
    return res.status(200).json({
      success: true,
      poolInfo,
    });
  } catch (error) {
    console.error("Error getting liquidity info:", error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
});

/**
 * @route GET /api/liquidity/locks/:address
 * @description Get liquidity locks for an address
 * @access Public
 */
router.get('/locks/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    // Validate address format
    if (!address.startsWith('0x')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid address format',
      });
    }
    
    // Get locks for the address
    // This is a simplified example - in a real implementation,
    // you would query the actual liquidity locker contract
    const locks = [
      {
        lockId: '0x...',
        tokenId: '0x...',
        tokenSymbol: 'TEST',
        amount: '1000000000',
        unlockTime: Math.floor(Date.now() / 1000) + 86400, // 1 day from now
      },
      // Add more locks as needed
    ];
    
    // Return locks
    return res.status(200).json({
      success: true,
      address,
      locks,
    });
  } catch (error) {
    console.error("Error getting liquidity locks:", error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
});

module.exports = router;