// telegram.js - Listen to Telegram messages and process token requests
const { Telegraf } = require('telegraf');
const config = require('../../../config/default');
const { processTokenDeployment } = require('../deployer');

// Initialize Telegram bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || config.telegram.botToken);

// Processed messages to prevent duplicates
const processedMessages = new Set();

// Track recent users to prevent spam
const userActivityTracker = new Map();

// Rate limiting configuration
const RATE_LIMIT = {
  maxRequests: 3,    // Maximum 3 requests
  timeWindow: 3600,  // Within 1 hour (in seconds)
  cooldown: 86400,   // 24-hour cooldown if exceeded (in seconds)
};

/**
 * Check if a user is rate limited
 * @param {number} userId - Telegram user ID
 * @returns {boolean} - True if rate limited, false otherwise
 */
function isRateLimited(userId) {
  const now = Math.floor(Date.now() / 1000);
  
  if (!userActivityTracker.has(userId)) {
    // First request from this user
    userActivityTracker.set(userId, {
      count: 1,
      firstRequest: now,
      isCoolingDown: false,
      cooldownUntil: 0,
    });
    return false;
  }
  
  const userData = userActivityTracker.get(userId);
  
  // Check if user is in cooldown
  if (userData.isCoolingDown) {
    if (now < userData.cooldownUntil) {
      return true;
    } else {
      // Cooldown period has ended, reset tracking
      userData.count = 1;
      userData.firstRequest = now;
      userData.isCoolingDown = false;
      userActivityTracker.set(userId, userData);
      return false;
    }
  }
  
  // Check if we're still within the time window
  if (now - userData.firstRequest < RATE_LIMIT.timeWindow) {
    // Still within time window, check the count
    if (userData.count >= RATE_LIMIT.maxRequests) {
      // Rate limit exceeded, put user in cooldown
      userData.isCoolingDown = true;
      userData.cooldownUntil = now + RATE_LIMIT.cooldown;
      userActivityTracker.set(userId, userData);
      return true;
    } else {
      // Increment request count
      userData.count++;
      userActivityTracker.set(userId, userData);
      return false;
    }
  } else {
    // Time window has passed, reset tracking
    userData.count = 1;
    userData.firstRequest = now;
    userActivityTracker.set(userId, userData);
    return false;
  }
}

/**
 * Format the cooldown time remaining in a human-readable format
 * @param {number} userId - Telegram user ID
 * @returns {string} - Formatted time string
 */
function getCooldownTimeRemaining(userId) {
  const userData = userActivityTracker.get(userId);
  
  if (!userData || !userData.isCoolingDown) {
    return 'no cooldown';
  }
  
  const now = Math.floor(Date.now() / 1000);
  const remaining = userData.cooldownUntil - now;
  
  if (remaining <= 0) {
    return 'cooldown ended';
  }
  
  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  
  return `${hours} hour${hours !== 1 ? 's' : ''} and ${minutes} minute${minutes !== 1 ? 's' : ''}`;
}

/**
 * Process a Telegram message
 * @param {Object} ctx - Telegram context
 * @returns {Promise<Object>} - Processing result
 */
async function processMessage(ctx) {
  try {
    const messageId = ctx.message.message_id;
    const userId = ctx.from.id;
    const username = ctx.from.username || `user${userId}`;
    const messageText = ctx.message.text;
    
    // Skip if we've already processed this message
    if (processedMessages.has(messageId)) {
      return { skipped: true, reason: 'Already processed' };
    }
    
    // Add to processed set
    processedMessages.add(messageId);
    
    console.log(`Processing Telegram message from ${username}: ${messageText}`);
    
    // Check for rate limiting
    if (isRateLimited(userId)) {
      const cooldownTime = getCooldownTimeRemaining(userId);
      await ctx.reply(`⚠️ Rate limit exceeded. Please try again in ${cooldownTime}.`);
      return { skipped: true, reason: 'Rate limited' };
    }
    
    // Skip commands
    if (messageText.startsWith('/')) {
      return { skipped: true, reason: 'Command message' };
    }
    
    // Skip if message is too short
    if (messageText.length < 5) {
      return { skipped: true, reason: 'Message too short' };
    }
    
    // Send typing indicator
    await ctx.telegram.sendChatAction(ctx.chat.id, 'typing');
    
    // Process message as a token request
    const deploymentResult = await processTokenDeployment(messageText, 'telegram', userId.toString());
    
    // Handle the result
    if (deploymentResult.success) {
      await replyWithSuccess(ctx, deploymentResult);
    } else if (deploymentResult.reason && deploymentResult.reason.includes('Deployment failed')) {
      await replyWithFailure(ctx, deploymentResult);
    } else if (!deploymentResult.isTokenRequest || deploymentResult.confidence < 70) {
      // Message wasn't recognized as a token request
      await ctx.reply(
        "I didn't recognize that as a token creation request. Please describe the meme token you want to create, including a name and symbol.\n\nExample: \"Create a rocket cat token called CatMoon with symbol CMON\""
      );
    }
    
    return deploymentResult;
  } catch (error) {
    console.error("Error processing Telegram message:", error);
    return { error: error.message };
  }
}

/**
 * Reply with a successful token creation message
 * @param {Object} ctx - Telegram context
 * @param {Object} deploymentResult - Token deployment result
 */
async function replyWithSuccess(ctx, deploymentResult) {
  try {
    const { tokenParams, tokenId } = deploymentResult;
    
    // Create the success message
    const replyText = `
🚀 Token Created Successfully! 🚀

$${tokenParams.tokenSymbol} (${tokenParams.tokenName}) ${tokenParams.emoji}

${tokenParams.shortDescription}

🌊 Liquidity added and locked for 30 days.
🔗 Explorer: https://suiexplorer.com/object/${tokenId}
🦄 Trade: https://suiforge.io/trade/${tokenParams.tokenSymbol.toLowerCase()}
`;
    
    // Send the static image if available
    if (tokenParams.imageUrl) {
      try {
        await ctx.replyWithPhoto(
          { url: tokenParams.imageUrl },
          { caption: replyText }
        );
      } catch (imageError) {
        console.error("Error sending image:", imageError);
        // Fallback to text-only message
        await ctx.reply(replyText);
      }
    } else {
      await ctx.reply(replyText);
    }
    
    // If we have an animated image, send it as a follow-up
    if (tokenParams.animatedUrl) {
      try {
        await ctx.replyWithAnimation(
          { url: tokenParams.animatedUrl },
          { caption: `$${tokenParams.tokenSymbol} animated logo` }
        );
      } catch (animationError) {
        console.error("Error sending animation:", animationError);
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error("Error replying with success:", error);
    return { error: error.message };
  }
}

/**
 * Reply with a failure message
 * @param {Object} ctx - Telegram context
 * @param {Object} deploymentResult - Failed deployment result
 */
async function replyWithFailure(ctx, deploymentResult) {
  try {
    // Create the failure message
    const replyText = `
😢 Token Creation Failed

Reason: ${deploymentResult.reason}

Please try again or check our docs for help: https://suiforge.io/docs
`;
    
    await ctx.reply(replyText);
    
    return { success: true };
  } catch (error) {
    console.error("Error replying with failure:", error);
    return { error: error.message };
  }
}

/**
 * Set up the Telegram bot commands and handlers
 */
function setupBotHandlers() {
  // Set bot commands
  bot.telegram.setMyCommands([
    { command: 'start', description: 'Start using SuiForge' },
    { command: 'help', description: 'Get help with creating tokens' },
    { command: 'about', description: 'About SuiForge' },
  ]);
  
  // Handle /start command
  bot.command('start', (ctx) => {
    ctx.reply(`
👋 Welcome to SuiForge!

I'm an AI-powered bot that helps you create meme tokens on the Sui blockchain.

Just send me a message describing the token you want to create, including:
- Token name
- Token symbol (2-5 characters)
- Meme theme or concept
- Emoji (optional)

Example: "Create a rocket cat token called CatMoon with symbol CMON 🚀🐱"

I'll generate the token, create liquidity, and send you the details!
    `);
  });
  
  // Handle /help command
  bot.command('help', (ctx) => {
    ctx.reply(`
🆘 Need help? Here are some tips:

1️⃣ To create a token, just send me a message with your token idea.
   Example: "Make a token about dancing bananas called BananaDance with symbol BDAN 🍌"

2️⃣ Your token must have:
   - A creative name
   - A symbol (2-5 characters)
   - A theme or concept

3️⃣ After creation, you'll get:
   - Token details
   - A custom meme image
   - Links to explore and trade your token

4️⃣ There's a limit of 3 tokens per user every 24 hours.

5️⃣ For more help, visit: https://suiforge.io/docs
    `);
  });
  
  // Handle /about command
  bot.command('about', (ctx) => {
    ctx.reply(`
ℹ️ About SuiForge

SuiForge is an AI-powered token launchpad on the Sui blockchain.

🔹 Create meme tokens with zero technical knowledge
🔹 Automatic liquidity provision and locking
🔹 Anti-rug and anti-bot protections built-in
🔹 Custom AI-generated meme images

Website: https://suiforge.io
Twitter: @SuiForge_AI

Built by the community, for the community! 🚀
    `);
  });
  
  // Handle all other messages
  bot.on('text', async (ctx) => {
    await processMessage(ctx);
  });
  
  // Handle errors
  bot.catch((err, ctx) => {
    console.error(`Telegram error for ${ctx.updateType}:`, err);
  });
}

/**
 * Start the Telegram bot
 */
function startTelegramListener() {
  try {
    console.log('Starting Telegram listener...');
    
    // Set up bot handlers
    setupBotHandlers();
    
    // Launch the bot
    bot.launch();
    
    console.log('Telegram bot started successfully');
    
    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
    
    return true;
  } catch (error) {
    console.error('Error starting Telegram bot:', error);
    return false;
  }
}

module.exports = {
  startTelegramListener,
  processMessage,
};