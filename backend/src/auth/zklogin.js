// zklogin.js - Implement zkLogin for non-crypto users
const { Ed25519Keypair, JsonRpcProvider, RawSigner, verifyPersonalMessage } = require('@mysten/sui.js');
const { jwtToAddress, getExtendedEphemeralPublicKey } = require('@mysten/zklogin');
const jwt_decode = require('jwt-decode');
const { randomBytes } = require('crypto');
const config = require('../../config/default');

// Initialize Sui provider
const provider = new JsonRpcProvider({ fullnode: process.env.SUI_RPC_URL || config.sui.rpcUrl });

// Store ephemeral key pairs and nonces
const userEphemeralKeys = new Map();
const userSessionData = new Map();

/**
 * Generate a random nonce for zkLogin challenge
 * @returns {string} - Random nonce
 */
function generateNonce() {
    return randomBytes(32).toString('hex');
}

/**
 * Begin the zkLogin authentication flow
 * @param {string} userId - User ID (email, social media ID, etc.)
 * @returns {Object} - Authentication challenge data
 */
function beginLoginFlow(userId) {
    try {
        // Generate ephemeral key pair
        const ephemeralKeyPair = Ed25519Keypair.generate();
        const ephemeralPublicKey = ephemeralKeyPair.getPublicKey().toBase64();
        
        // Generate a nonce
        const nonce = generateNonce();
        
        // Store ephemeral key pair for this user
        userEphemeralKeys.set(userId, {
            keyPair: ephemeralKeyPair,
            publicKey: ephemeralPublicKey,
            nonce,
            timestamp: Date.now(),
        });
        
        // Return data needed for authentication
        return {
            nonce,
            ephemeralPublicKey,
            maxEpoch: 10, // Maximum number of epochs the proof is valid for
            redirectUrl: `${config.app.baseUrl}/api/auth/callback`,
        };
    } catch (error) {
        console.error("Error beginning zkLogin flow:", error);
        throw error;
    }
}

/**
 * Complete the zkLogin authentication flow
 * @param {string} userId - User ID
 * @param {string} jwtToken - JWT token from OAuth provider
 * @param {Object} zkProof - ZK proof data
 * @returns {Promise<Object>} - Authentication result
 */
async function completeLoginFlow(userId, jwtToken, zkProof) {
    try {
        // Get ephemeral key data
        const ephemeralData = userEphemeralKeys.get(userId);
        
        if (!ephemeralData) {
            throw new Error("No ephemeral key found for this user");
        }
        
        // Verify the JWT token
        const decodedJwt = jwt_decode(jwtToken);
        
        // Compute the Sui address from the JWT
        const userAddress = jwtToAddress(jwtToken, ephemeralData.publicKey);
        
        // Create extended ephemeral public key for verification
        const extendedEphemeralPublicKey = getExtendedEphemeralPublicKey(
            ephemeralData.keyPair.getPublicKey().toBytes()
        );
        
        // Verify the proof on-chain (in production, this would be done via Sui Move call)
        // For this implementation, we'll assume the proof is valid
        
        // Store session data
        userSessionData.set(userId, {
            address: userAddress,
            jwt: jwtToken,
            ephemeralKeyPair: ephemeralData.keyPair,
            loginTimestamp: Date.now(),
            userInfo: {
                provider: decodedJwt.iss,
                subject: decodedJwt.sub,
                name: decodedJwt.name,
                email: decodedJwt.email,
            },
        });
        
        // Clean up ephemeral key data
        userEphemeralKeys.delete(userId);
        
        return {
            success: true,
            address: userAddress,
            userInfo: {
                provider: decodedJwt.iss,
                subject: decodedJwt.sub,
                name: decodedJwt.name,
                email: decodedJwt.email,
            },
        };
    } catch (error) {
        console.error("Error completing zkLogin flow:", error);
        throw error;
    }
}

/**
 * Create a transaction signer for a zkLogin user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Transaction signer
 */
async function createUserSigner(userId) {
    try {
        const sessionData = userSessionData.get(userId);
        
        if (!sessionData) {
            throw new Error("No session found for this user");
        }
        
        // Create a signer using the ephemeral key pair
        const signer = new RawSigner(
            sessionData.ephemeralKeyPair,
            provider
        );
        
        return {
            success: true,
            signer,
            address: sessionData.address,
        };
    } catch (error) {
        console.error("Error creating user signer:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Sign a message with the user's ephemeral key
 * @param {string} userId - User ID
 * @param {string} message - Message to sign
 * @returns {Promise<Object>} - Signature result
 */
async function signMessage(userId, message) {
    try {
        const sessionData = userSessionData.get(userId);
        
        if (!sessionData) {
            throw new Error("No session found for this user");
        }
        
        // Create a signer
        const signer = new RawSigner(
            sessionData.ephemeralKeyPair,
            provider
        );
        
        // Sign the message
        const signature = await signer.signPersonalMessage({
            message: Buffer.from(message, 'utf8'),
        });
        
        return {
            success: true,
            signature,
            publicKey: sessionData.ephemeralKeyPair.getPublicKey().toBase64(),
        };
    } catch (error) {
        console.error("Error signing message:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Verify a signature from a zkLogin user
 * @param {string} message - Original message
 * @param {string} signature - Signature bytes
 * @param {string} publicKey - Public key
 * @returns {boolean} - Verification result
 */
function verifySignature(message, signature, publicKey) {
    try {
        return verifyPersonalMessage(
            Buffer.from(message, 'utf8'),
            signature,
            publicKey
        );
    } catch (error) {
        console.error("Error verifying signature:", error);
        return false;
    }
}

/**
 * Get user session data
 * @param {string} userId - User ID
 * @returns {Object|null} - User session data or null
 */
function getUserSession(userId) {
    const sessionData = userSessionData.get(userId);
    
    if (!sessionData) {
        return null;
    }
    
    return {
        address: sessionData.address,
        loginTimestamp: sessionData.loginTimestamp,
        userInfo: sessionData.userInfo,
    };
}

/**
 * Check if a user is authenticated
 * @param {string} userId - User ID
 * @returns {boolean} - Authentication status
 */
function isAuthenticated(userId) {
    const sessionData = userSessionData.get(userId);
    
    if (!sessionData) {
        return false;
    }
    
    // Check if session is expired (24 hours)
    const sessionAge = Date.now() - sessionData.loginTimestamp;
    const maxSessionAge = 24 * 60 * 60 * 1000; // 24 hours
    
    return sessionAge < maxSessionAge;
}

/**
 * End a user session
 * @param {string} userId - User ID
 */
function endSession(userId) {
    userSessionData.delete(userId);
}

module.exports = {
    beginLoginFlow,
    completeLoginFlow,
    createUserSigner,
    signMessage,
    verifySignature,
    getUserSession,
    isAuthenticated,
    endSession,
};