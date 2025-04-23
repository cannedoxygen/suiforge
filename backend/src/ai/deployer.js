// deployer.js - Deploy tokens and manage liquidity
const { Ed25519Keypair, JsonRpcProvider, RawSigner, TransactionBlock } = require('@mysten/sui.js');
const config = require('../../config/default');
const { parseTokenRequest, validateTokenParams, generateTokenMetadata } = require('./processors/text_parser');
const { generateTokenImagery } = require('./processors/image_gen');
const { provideLiquidity } = require('../dex/deepbook');
const { lockLiquidity } = require('../dex/cetus');

// Initialize Sui provider
const provider = new JsonRpcProvider({ fullnode: process.env.SUI_RPC_URL || config.sui.rpcUrl });

/**
 * Create a signer with provided private key
 * @param {string} privateKey - Private key in hex format
 * @returns {RawSigner} - Sui signer
 */
function createSigner(privateKey) {
    try {
        // Create keypair from private key
        const keypair = Ed25519Keypair.fromSecretKey(
            Buffer.from(privateKey.replace('0x', ''), 'hex')
        );
        
        // Create signer
        return new RawSigner(keypair, provider);
    } catch (error) {
        console.error("Error creating signer:", error);
        throw error;
    }
}

/**
 * Deploy a new token based on parsed parameters
 * @param {Object} tokenParams - Validated token parameters
 * @returns {Promise<Object>} - Deployment result
 */
async function deployToken(tokenParams) {
    try {
        console.log("Deploying token with params:", tokenParams);
        
        // Create signer using deployment key
        const deployerKey = process.env.DEPLOYER_PRIVATE_KEY || config.sui.deployerKey;
        const signer = createSigner(deployerKey);
        
        // Get the factory object ID
        const factoryId = process.env.TOKEN_FACTORY_ID || config.contracts.tokenFactoryId;
        
        // Create transaction block
        const tx = new TransactionBlock();
        
        // Call the create_token function
        tx.moveCall({
            target: `${config.contracts.packageId}::token_factory::create_token`,
            arguments: [
                tx.object(factoryId),                                            // Factory object
                tx.pure(Buffer.from(tokenParams.tokenName, 'utf8')),            // name
                tx.pure(Buffer.from(tokenParams.tokenSymbol, 'utf8')),          // symbol
                tx.pure(Buffer.from(tokenParams.shortDescription, 'utf8')),     // description
                tx.pure(Buffer.from(tokenParams.imageUrl, 'utf8')),             // image_url
                tx.pure(9),                                                     // decimals
                tx.pure(1000000000000n),                                         // max_supply (1 trillion)
                tx.pure(500000000000n),                                          // initial_supply (500 billion)
            ]
        });
        
        // Execute transaction
        const result = await signer.signAndExecuteTransactionBlock({
            transactionBlock: tx,
            options: {
                showEffects: true,
                showEvents: true,
            },
        });
        
        console.log("Token deployment result:", result);
        
        // Extract token ID from events
        const tokenId = extractTokenIdFromEvents(result);
        
        if (!tokenId) {
            throw new Error("Failed to extract token ID from events");
        }
        
        // Set up anti-bot protection
        await setupAntiBot(tokenId, signer);
        
        // Create fee configuration
        await setupFeeDistribution(tokenId, signer);
        
        // Return deployment info
        return {
            success: true,
            tokenId,
            transactionDigest: result.digest,
            tokenParams,
        };
    } catch (error) {
        console.error("Error deploying token:", error);
        return {
            success: false,
            error: error.message,
            tokenParams,
        };
    }
}

/**
 * Set up anti-bot protection for a token
 * @param {string} tokenId - Token ID
 * @param {RawSigner} signer - Sui signer
 * @returns {Promise<Object>} - Setup result
 */
async function setupAntiBot(tokenId, signer) {
    try {
        // Create transaction block
        const tx = new TransactionBlock();
        
        // Get current timestamp
        const timestamp = Math.floor(Date.now() / 1000);
        
        // Call the create_protection function
        tx.moveCall({
            target: `${config.contracts.packageId}::anti_bot::create_protection`,
            arguments: [
                tx.pure(tokenId),                        // token_id
                tx.pure(300),                            // cooldown_period (5 minutes)
                tx.pure(500),                            // max_buy_percent (5%)
                tx.pure(300),                            // enable_time_delay (5 minutes)
                tx.object("0x6"),                        // Clock object
            ]
        });
        
        // Execute transaction
        const result = await signer.signAndExecuteTransactionBlock({
            transactionBlock: tx,
            options: {
                showEffects: true,
            },
        });
        
        console.log("Anti-bot setup result:", result);
        return {
            success: true,
            transactionDigest: result.digest,
        };
    } catch (error) {
        console.error("Error setting up anti-bot protection:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Setup fee distribution for a token
 * @param {string} tokenId - Token ID
 * @param {RawSigner} signer - Sui signer
 * @returns {Promise<Object>} - Setup result
 */
async function setupFeeDistribution(tokenId, signer) {
    try {
        // Get signer address
        const address = await signer.getAddress();
        
        // Create transaction block
        const tx = new TransactionBlock();
        
        // Call the create_token_fee_config function
        tx.moveCall({
            target: `${config.contracts.packageId}::fee_distributor::create_token_fee_config`,
            arguments: [
                tx.pure(tokenId),    // token_id
                tx.pure(address),    // creator
            ]
        });
        
        // Execute transaction
        const result = await signer.signAndExecuteTransactionBlock({
            transactionBlock: tx,
            options: {
                showEffects: true,
            },
        });
        
        console.log("Fee distribution setup result:", result);
        return {
            success: true,
            transactionDigest: result.digest,
        };
    } catch (error) {
        console.error("Error setting up fee distribution:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Extract token ID from transaction events
 * @param {Object} result - Transaction result
 * @returns {string|null} - Token ID
 */
function extractTokenIdFromEvents(result) {
    try {
        if (!result.events || result.events.length === 0) {
            return null;
        }
        
        // Find the TokenCreated event
        const tokenCreatedEvent = result.events.find(
            event => event.type.includes('::token_factory::TokenCreated')
        );
        
        if (!tokenCreatedEvent || !tokenCreatedEvent.parsedJson) {
            return null;
        }
        
        return tokenCreatedEvent.parsedJson.token_id;
    } catch (error) {
        console.error("Error extracting token ID:", error);
        return null;
    }
}

/**
 * Complete token deployment workflow from social media message
 * @param {string} message - Social media message
 * @param {string} source - Source of the message (twitter, farcaster, telegram)
 * @param {string} userId - User ID from the source
 * @returns {Promise<Object>} - Deployment result
 */
async function processTokenDeployment(message, source, userId) {
    try {
        // Parse token request
        console.log(`Processing token request from ${source}:`, message);
        const parsedRequest = await parseTokenRequest(message);
        
        // Check if this is a token request
        if (!parsedRequest.isTokenRequest || parsedRequest.confidence < 70) {
            console.log("Not a valid token request:", parsedRequest);
            return {
                success: false,
                reason: "Not a valid token request or low confidence",
                source,
                userId,
            };
        }
        
        // Validate token parameters
        const validatedParams = validateTokenParams(parsedRequest);
        
        if (!validatedParams.isValid) {
            console.log("Invalid token parameters:", validatedParams);
            return {
                success: false,
                reason: validatedParams.reason,
                source,
                userId,
            };
        }
        
        // Generate metadata
        const tokenMetadata = await generateTokenMetadata(validatedParams);
        
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
            return {
                success: false,
                reason: "Deployment failed: " + deploymentResult.error,
                source,
                userId,
            };
        }
        
        // Add liquidity to DeepBook
        const liquidityResult = await provideLiquidity(
            deploymentResult.tokenId,
            1000000000n,  // 1B tokens for liquidity
            50000000000n  // 50 SUI (assuming 9 decimals)
        );
        
        // Lock liquidity on Cetus
        const lockResult = await lockLiquidity(
            deploymentResult.tokenId,
            30 * 24 * 60 * 60  // 30 days in seconds
        );
        
        // Store deployment in database
        // ... (implementation depends on your database)
        
        return {
            success: true,
            tokenId: deploymentResult.tokenId,
            tokenParams: tokenMetadata,
            transactionDigest: deploymentResult.transactionDigest,
            liquidityAdded: liquidityResult.success,
            liquidityLocked: lockResult.success,
            source,
            userId,
        };
    } catch (error) {
        console.error("Error processing token deployment:", error);
        return {
            success: false,
            reason: "Processing error: " + error.message,
            source,
            userId,
        };
    }
}

module.exports = {
    deployToken,
    processTokenDeployment,
    setupAntiBot,
    setupFeeDistribution,
};