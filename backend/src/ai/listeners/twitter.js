// twitter.js - Listen to Twitter mentions and process token requests
const { TwitterApi } = require('twitter-api-v2');
const config = require('../../../config/default');
const { processTokenDeployment } = require('../deployer');

// Initialize Twitter client
const twitterClient = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY || config.twitter.apiKey,
    appSecret: process.env.TWITTER_API_SECRET || config.twitter.apiSecret,
    accessToken: process.env.TWITTER_ACCESS_TOKEN || config.twitter.accessToken,
    accessSecret: process.env.TWITTER_ACCESS_SECRET || config.twitter.accessSecret,
});

// Bot username to filter mentions
const BOT_USERNAME = process.env.TWITTER_BOT_USERNAME || config.twitter.botUsername || 'SuiForge_AI';

// Processed tweets to prevent duplicates
const processedTweets = new Set();

// Last tweet ID to track pagination
let lastTweetId = null;

/**
 * Process a tweet and respond if it's a token request
 * @param {Object} tweet - Tweet object
 * @returns {Promise<Object>} - Processing result
 */
async function processTweet(tweet) {
    try {
        // Skip if we've already processed this tweet
        if (processedTweets.has(tweet.id)) {
            return { skipped: true, reason: 'Already processed' };
        }
        
        // Add to processed set
        processedTweets.add(tweet.id);
        
        // Extract tweet content
        const tweetText = tweet.text;
        const userId = tweet.author_id;
        const tweetId = tweet.id;
        
        console.log(`Processing tweet from ${userId}: ${tweetText}`);
        
        // Remove mentions from the tweet text for cleaner parsing
        const cleanText = tweetText.replace(/@\w+/g, '').trim();
        
        // Skip if the text is too short after removing mentions
        if (cleanText.length < 5) {
            return { skipped: true, reason: 'Text too short after removing mentions' };
        }
        
        // Process the tweet as a token request
        const deploymentResult = await processTokenDeployment(cleanText, 'twitter', userId);
        
        // If successful, reply to the tweet
        if (deploymentResult.success) {
            await replyWithSuccess(tweetId, deploymentResult);
        } else {
            // If it was a valid attempt but failed, reply with the reason
            if (deploymentResult.reason && deploymentResult.reason.includes('Deployment failed')) {
                await replyWithFailure(tweetId, deploymentResult);
            }
        }
        
        return deploymentResult;
    } catch (error) {
        console.error("Error processing tweet:", error);
        return { error: error.message };
    }
}

/**
 * Reply to a tweet with successful token creation
 * @param {string} tweetId - Original tweet ID
 * @param {Object} deploymentResult - Token deployment result
 */
async function replyWithSuccess(tweetId, deploymentResult) {
    try {
        const { tokenParams, tokenId } = deploymentResult;
        
        // Create the success message
        const replyText = `
🚀 Token Created Successfully! 🚀

${tokenParams.tokenSymbol} (${tokenParams.tokenName}) ${tokenParams.emoji}

${tokenParams.shortDescription}

🌊 Liquidity added and locked for 30 days.
🔗 Explorer: https://suiexplorer.com/object/${tokenId}
🦄 Trade: https://suiforge.io/trade/${tokenParams.tokenSymbol.toLowerCase()}

#SuiForge ${tokenParams.hashtags.join(' ')}
`;
        
        // Reply to the tweet
        await twitterClient.v2.reply(replyText, tweetId);
        
        console.log(`Replied to tweet ${tweetId} with success message`);
        return { success: true };
    } catch (error) {
        console.error("Error replying to tweet with success:", error);
        return { error: error.message };
    }
}

/**
 * Reply to a tweet with failure reason
 * @param {string} tweetId - Original tweet ID
 * @param {Object} deploymentResult - Failed deployment result
 */
async function replyWithFailure(tweetId, deploymentResult) {
    try {
        // Create the failure message
        const replyText = `
😢 Token Creation Failed

Reason: ${deploymentResult.reason}

Please try again or check our docs for help: https://suiforge.io/docs
`;
        
        // Reply to the tweet
        await twitterClient.v2.reply(replyText, tweetId);
        
        console.log(`Replied to tweet ${tweetId} with failure message`);
        return { success: true };
    } catch (error) {
        console.error("Error replying to tweet with failure:", error);
        return { error: error.message };
    }
}

/**
 * Get recent mentions of the bot account
 * @returns {Promise<Array>} - Array of tweets mentioning the bot
 */
async function getRecentMentions() {
    try {
        // Setup query parameters
        const queryParams = {
            'query': `@${BOT_USERNAME} -is:retweet`,
            'tweet.fields': 'author_id,created_at,text',
            'max_results': 10,
        };
        
        // Add pagination if we have a last tweet ID
        if (lastTweetId) {
            queryParams.since_id = lastTweetId;
        }
        
        // Get recent mentions
        const response = await twitterClient.v2.search(queryParams);
        
        if (!response.data || response.data.length === 0) {
            return [];
        }
        
        // Update last tweet ID for pagination
        if (response.data && response.data.length > 0) {
            const tweetIds = response.data.map(tweet => tweet.id);
            lastTweetId = Math.max(...tweetIds.map(id => BigInt(id))).toString();
        }
        
        return response.data;
    } catch (error) {
        console.error("Error getting recent mentions:", error);
        return [];
    }
}

/**
 * Main function to poll for mentions and process them
 */
async function pollTwitterMentions() {
    try {
        console.log("Polling for Twitter mentions...");
        
        // Get recent mentions
        const mentions = await getRecentMentions();
        
        console.log(`Found ${mentions.length} new mentions`);
        
        // Process each mention
        for (const tweet of mentions) {
            await processTweet(tweet);
        }
    } catch (error) {
        console.error("Error polling Twitter mentions:", error);
    }
}

/**
 * Start the Twitter listener with polling interval
 * @param {number} interval - Polling interval in milliseconds
 */
function startTwitterListener(interval = 60000) {
    console.log(`Starting Twitter listener, polling every ${interval}ms`);
    
    // Poll immediately on start
    pollTwitterMentions();
    
    // Set up polling interval
    setInterval(pollTwitterMentions, interval);
}

module.exports = {
    startTwitterListener,
    pollTwitterMentions,
    processTweet,
};