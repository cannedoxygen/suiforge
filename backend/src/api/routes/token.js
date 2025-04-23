// token.js - API routes for token creation and management
const express = require('express');
const router = express.Router();
const { deployToken, processTokenDeployment } = require('../../ai/deployer');
const { validateTokenParams, generateTokenMetadata } = require('../../ai/processors/text_parser');
const { generateTokenImagery } = require('../../ai/processors/image_gen');
const { isAuthenticated, getUserSession, createUserSigner } = require('../../auth/zklogin');
const { provideLiquidity } = require('../../dex/deepbook');
const { lockLiquidity } = require('../../dex/cetus');

/**
 * @route POST /api/token/create
 * @description Create a new token manually
 * @access Private
 */
router.post('/create', async (req, res) => {
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
        
        // Get token parameters from request body
        const {
            tokenName,
            tokenSymbol,
            memeTheme,
            emoji,
        } = req.body;
        
        // Validate parameters
        const tokenParams = validateTokenParams({
            isTokenRequest: true,
            tokenName,
            tokenSymbol,
            memeTheme,
            emoji,
            confidence: 100,
        });
        
        if (!tokenParams.isValid) {
            return res.status(400).json({
                success: false,
                message: tokenParams.reason,
            });
        }
        
        // Generate metadata
        const tokenMetadata = await generateTokenMetadata(tokenParams);
        
        // Generate images
        const tokenImagery = await generateTokenImagery(tokenMetadata);
        
        // Add image URLs to metadata
        tokenMetadata.imageUrl = tokenImagery.staticImage 
            ? `https://suiforge.io/tokens/${tokenMetadata.tokenSymbol.toLowerCase()}_static.png`
            : `https://suiforge.io/default_token.png`;
            
        tokenMetadata.animatedUrl = tokenImagery.animatedGif
            ? `https://suiforge.io/tokens/${tokenMetadata.tokenSymbol.toLowerCase()}_animated.gif`
            : null;
        
        // Deploy token
        const deploymentResult = await deployToken(tokenMetadata);
        
        if (!deploymentResult.success) {
            return res.status(500).json({
                success: false,
                message: 'Token deployment failed',
                error: deploymentResult.error,
            });
        }
        
        // Add liquidity
        const liquidityResult = await provideLiquidity(
            deploymentResult.tokenId,
            1000000000n,  // 1B tokens for liquidity
            50000000000n  // 50 SUI (assuming 9 decimals)
        );
        
        // Lock liquidity
        const lockResult = await lockLiquidity(
            deploymentResult.tokenId,
            30 * 24 * 60 * 60  // 30 days in seconds
        );
        
        // Return result
        return res.status(200).json({
            success: true,
            tokenId: deploymentResult.tokenId,
            tokenParams: tokenMetadata,
            transactionDigest: deploymentResult.transactionDigest,
            liquidityAdded: liquidityResult.success,
            liquidityLocked: lockResult.success,
        });
    } catch (error) {
        console.error("Error creating token:", error);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
});

/**
 * @route POST /api/token/preview
 * @description Generate a token preview
 * @access Public
 */
router.post('/preview', async (req, res) => {
    try {
        // Get token parameters from request body
        const {
            tokenName,
            tokenSymbol,
            memeTheme,
            emoji,
        } = req.body;
        
        // Validate parameters
        const tokenParams = validateTokenParams({
            isTokenRequest: true,
            tokenName,
            tokenSymbol,
            memeTheme,
            emoji,
            confidence: 100,
        });
        
        if (!tokenParams.isValid) {
            return res.status(400).json({
                success: false,
                message: tokenParams.reason,
            });
        }
        
        // Generate metadata
        const tokenMetadata = await generateTokenMetadata(tokenParams);
        
        // Generate images
        const tokenImagery = await generateTokenImagery(tokenMetadata);
        
        // Add image URLs to metadata
        tokenMetadata.imageUrl = tokenImagery.staticImage 
            ? `https://suiforge.io/tokens/${tokenMetadata.tokenSymbol.toLowerCase()}_static.png`
            : `https://suiforge.io/default_token.png`;
            
        tokenMetadata.animatedUrl = tokenImagery.animatedGif
            ? `https://suiforge.io/tokens/${tokenMetadata.tokenSymbol.toLowerCase()}_animated.gif`
            : null;
        
        // Return result
        return res.status(200).json({
            success: true,
            tokenPreview: tokenMetadata,
        });
    } catch (error) {
        console.error("Error generating token preview:", error);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
});

/**
 * @route POST /api/token/process-message
 * @description Process a token creation from message
 * @access Private
 */
router.post('/process-message', async (req, res) => {
    try {
        // Check authentication
        if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }
        
        // Verify API key
        const apiKey = req.headers.authorization.split(' ')[1];
        
        if (apiKey !== process.env.API_KEY) {
            return res.status(401).json({
                success: false,
                message: 'Invalid API key',
            });
        }
        
        // Get message parameters
        const { message, source, userId } = req.body;
        
        if (!message || !source || !userId) {
            return res.status(400).json({
                success: false,
                message: 'Missing required parameters',
            });
        }
        
        // Process token deployment
        const deploymentResult = await processTokenDeployment(message, source, userId);
        
        // Return result
        return res.status(200).json(deploymentResult);
    } catch (error) {
        console.error("Error processing message:", error);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
});

/**
 * @route GET /api/token/:tokenId/info
 * @description Get token information
 * @access Public
 */
router.get('/:tokenId/info', async (req, res) => {
    try {
        const { tokenId } = req.params;
        
        // Query coin metadata from RPC
        const provider = new JsonRpcProvider({ fullnode: process.env.SUI_RPC_URL || config.sui.rpcUrl });
        
        const tokenInfo = await provider.getCoinMetadata({ coinType: tokenId });
        
        if (!tokenInfo) {
            return res.status(404).json({
                success: false,
                message: 'Token not found',
            });
        }
        
        // Return token info
        return res.status(200).json({
            success: true,
            tokenInfo,
        });
    } catch (error) {
        console.error("Error getting token info:", error);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
});

/**
 * @route GET /api/token/:tokenId/price
 * @description Get token price
 * @access Public
 */
router.get('/:tokenId/price', async (req, res) => {
    try {
        const { tokenId } = req.params;
        
        // Query current price from DeepBook
        // This would involve calling the DeepBook contract or API
        // For simplicity, we'll return a mock price
        
        return res.status(200).json({
            success: true,
            price: {
                tokenId,
                priceUsd: Math.random() * 0.001,
                priceSui: 0.00005,
                lastUpdated: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error("Error getting token price:", error);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
});

/**
 * @route GET /api/token/trending
 * @description Get trending tokens
 * @access Public
 */
router.get('/trending', (req, res) => {
    try {
        // This would typically query a database for trending tokens
        // For now, return mock data
        
        return res.status(200).json({
            success: true,
            trending: [
                {
                    tokenId: '0x1234',
                    name: 'Pepe On Sui',
                    symbol: 'PEPES',
                    price: 0.0003,
                    change24h: 15.2,
                    volume24h: 50000,
                },
                {
                    tokenId: '0x5678',
                    name: 'Sui Rocket',
                    symbol: 'SRKT',
                    price: 0.00015,
                    change24h: 8.7,
                    volume24h: 32000,
                },
                {
                    tokenId: '0x9abc',
                    name: 'Moon Doge',
                    symbol: 'MDOGE',
                    price: 0.00022,
                    change24h: -3.5,
                    volume24h: 45000,
                },
            ],
        });
    } catch (error) {
        console.error("Error getting trending tokens:", error);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
});

module.exports = router;