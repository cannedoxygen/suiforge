// development.js - Development environment configuration
const defaultConfig = require('./default');

// Development-specific overrides
const devConfig = {
  // Server configuration
  server: {
    ...defaultConfig.server,
    env: 'development',
  },

  // Sui configuration
  sui: {
    ...defaultConfig.sui,
    networkType: 'testnet',
  },

  // OpenAI API configuration - can use different settings for development
  openai: {
    ...defaultConfig.openai,
    maxTokens: 1000, // Higher for development to see more details
  },

  // Social media polling intervals (faster for development)
  twitter: {
    ...defaultConfig.twitter,
    pollingInterval: 30000, // 30 seconds in development
  },
  
  farcaster: {
    ...defaultConfig.farcaster,
    pollingInterval: 30000, // 30 seconds in development
  },

  // Anti-bot settings (less restrictive for development)
  antiBot: {
    cooldownPeriod: 60, // 1 minute in development
    maxBuyPercent: 1000, // 10% in development
    enableTimeDelay: 60, // 1 minute in development
  },

  // Liquidity settings (shorter for development)
  liquidity: {
    lockDuration: 300, // 5 minutes in development
  },

  // Debug and logging settings
  debug: {
    enabled: true,
    verbose: true,
    logRequests: true,
    logResponses: true,
    logErrors: true,
  },
};

// Export merged configuration
module.exports = {
  ...defaultConfig,
  ...devConfig,
};