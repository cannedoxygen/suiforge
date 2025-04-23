// farcaster.js - Listen to Farcaster mentions and process token requests
const { Farcaster } = require('@standard-crypto/farcaster-js');
const config = require('../../../config/default');
const { processTokenDeployment } = require('../deployer');

// Initialize Farcaster client
const farcasterClient = new Farcaster({
  mnemonic: process.env.FARCASTER_MNEMONIC || config.farcaster.mnemonic,
  apiKey: process.env.FARCASTER_API_KEY || config.farcaster.apiKey,
});

// Bot username to filter mentions
const BOT_USERNAME = '@suiforge';

// Processed casts to prevent duplicates
const processedCasts = new Set();

// Last cast ID to track pagination
let lastCastId = null;

/**
 * Process a cast (Farcaster post) and respond if it's a token request
 * @param {Object} cast - Cast object
 * @returns {Promise<Object>} - Processing result
 */
async function processCast(cast) {
    try {
        // Skip if we've already processed this cast
        if (processedCasts.has(cast.hash)) {
            return { skipped: true, reason: 'Already processed' };
        }
        
        // Add to processed set
        processedCasts.add(cast.hash);
        
        // Extract cast content
        const castText = cast.text;
        const userId = cast.author.username;
        const castHash = cast.hash;
        
        console.log(`Processing cast from ${userId}: ${castText}`);
        
        // Remove mentions from the cast text for cleaner parsing
        const cleanText = castText.replace(/@\w+/g, '').trim();
        
        // Skip if the text is too short after removing mentions
        if (cleanText.length < 5) {
            return { skipped: true, reason: 'Text too short after removing mentions' };
        }
        
        // Process the cast as a token request
        const deploymentResult = await processTokenDeployment(cleanText, 'farcaster', userId);
        
        // If successful, reply to the cast
        if (deploymentResult.success) {
            await replyWithSuccess(castHash, deploymentResult, userId);
        } else {
            // If it was a valid attempt but failed, reply with the reason
            if (deploymentResult.reason && deploymentResult.reason.includes('Deployment failed')) {
                await replyWithFailure(castHash, deploymentResult, userId);
            }
        }
        
        return deploymentResult;
    } catch (error) {
        console.error("Error processing cast:", error);
        return { error: error.message };
    }
}

/**
 * Reply to a cast with successful token creation
 * @param {string} castHash - Original cast hash
 * @param {Object} deploymentResult - Token deployment result
 * @param {string} username - Username to mention
 */
async function replyWithSuccess(castHash, deploymentResult, username) {
    try {
        const { tokenParams, tokenId } = deploymentResult;
        
        // Create the success message
        const replyText = `
@${username} 🚀 Token Created Successfully! 🚀

$${tokenParams.tokenSymbol} (${tokenParams.tokenName}) ${tokenParams.emoji}

${tokenParams.shortDescription}

🌊 Liquidity added and locked for 30 days.
🔗 Explorer: https://suiexplorer.com/object/${tokenId}
🦄 Trade: https://suiforge.io/trade/${tokenParams.tokenSymbol.toLowerCase()}
`;
        
        // Reply to the cast
        await farcasterClient.publishCast({
            text: replyText,
            replyTo: castHash,
        });
        
        console.log(`Replied to cast ${castHash} with success message`);
        return { success: true };
    } catch (error) {
        console.error("Error replying to cast with success:", error);
        return { error: error.message };
    }
}

/**
 * Reply to a cast with failure reason
 * @param {string} castHash - Original cast hash
 * @param {Object} deploymentResult - Failed deployment result
 * @param {string} username - Username to mention
 */
async function replyWithFailure(castHash, deploymentResult, username) {
    try {
        // Create the failure message
        const replyText = `
@${username} 😢 Token Creation Failed

Reason: ${deploymentResult.reason}

Please try again or check our docs for help: https://suiforge.io/docs
`;
        
        // Reply to the cast
        await farcasterClient.publishCast({
            text: replyText,
            replyTo: castHash,
        });
        
        console.log(`Replied to cast ${castHash} with failure message`);
        return { success: true };
    } catch (error) {
        console.error("Error replying to cast with failure:", error);
        return { error: error.message };
    }
}

/**
 * Get recent mentions from Farcaster
 * @returns {Promise<Array>} - Array of casts mentioning the bot
 */
async function getRecentMentions() {
    try {
        // Setup query parameters
        const queryParams = {
            mentionsUser: BOT_USERNAME,
        };
        
        // Add pagination if we have a last cast ID
        if (lastCastId) {
            queryParams.fromCastHash = lastCastId;
        }
        
        // Get recent mentions
        const mentions = await farcasterClient.fetchCasts(queryParams);
        
        if (!mentions || mentions.length === 0) {
            return [];
        }
        
        // Update last cast ID for pagination
        if (mentions.length > 0) {
            lastCastId = mentions[mentions.length - 1].hash;
        }
        
        return mentions;
    } catch (error) {
        console.error("Error getting recent Farcaster mentions:", error);
        return [];
    }
}

/**
 * Main function to poll for mentions and process them
 */
async function pollFarcasterMentions() {
    try {
        console.log("Polling for Farcaster mentions...");
        
        // Get recent mentions
        const mentions = await getRecentMentions();
        
        console.log(`Found ${mentions.length} new Farcaster mentions`);
        
        // Process each mention
        for (const cast of mentions) {
            await processCast(cast);
        }
    } catch (error) {
        console.error("Error polling Farcaster mentions:", error);
    }
}

/**
 * Start the Farcaster listener with polling interval
 * @param {number} interval - Polling interval in milliseconds
 */
function startFarcasterListener(interval = 60000) {
    console.log(`Starting Farcaster listener, polling every ${interval}ms`);
    
    // Poll immediately on start
    pollFarcasterMentions();
    
    // Set up polling interval
    setInterval(pollFarcasterMentions, interval);
}

module.exports = {
    startFarcasterListener,
    pollFarcasterMentions,
    processCast,
};