// production.js - Production environment configuration
const defaultConfig = require('./default');

// Production-specific overrides
const prodConfig = {
  // Server configuration
  server: {
    ...defaultConfig.server,
    env: 'production',
    corsOrigins: process.env.CORS_ORIGINS || 'https://suiforge.io',
  },

  // Sui configuration
  sui: {
    ...defaultConfig.sui,
    networkType: 'mainnet',
    rpcUrl: process.env.SUI_RPC_URL || 'https://fullnode.mainnet.sui.io:443',
  },

  // OpenAI API configuration
  openai: {
    ...defaultConfig.openai,
    model: 'gpt-4-turbo', // Always use the best model in production
  },

  // Social media polling intervals (slower for production to reduce API costs)
  twitter: {
    ...defaultConfig.twitter,
    pollingInterval: 60000, // 60 seconds in production
  },
  
  farcaster: {
    ...defaultConfig.farcaster,
    pollingInterval: 60000, // 60 seconds in production
  },

  // Anti-bot settings (strict for production)
  antiBot: {
    cooldownPeriod: 300, // 5 minutes in production
    maxBuyPercent: 500, // 5% in production
    enableTimeDelay: 300, // 5 minutes in production
  },

  // Liquidity settings (full duration for production)
  liquidity: {
    lockDuration: 2592000, // 30 days in production
  },

  // Debug and logging settings
  debug: {
    enabled: false,
    verbose: false,
    logRequests: false,
    logResponses: false,
    logErrors: true,
  },

  // Rate limiting (more strict in production)
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
  },

  // Cache settings
  cache: {
    enabled: true,
    ttl: 60 * 60, // 1 hour in seconds
  },
};

// Export merged configuration
module.exports = {
  ...defaultConfig,
  ...prodConfig,
};