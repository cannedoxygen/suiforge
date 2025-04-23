// default.js - Default configuration for SuiForge
const path = require('path');

// Load environment variables if needed
require('dotenv').config({
  path: path.resolve(__dirname, '../../.env')
});

module.exports = {
  // App configuration
  app: {
    name: 'SuiForge',
    description: 'AI-Powered Token Launchpad on Sui',
    version: '1.0.0',
    baseUrl: process.env.APP_BASE_URL || 'http://localhost:3000',
    apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
  },

  // Server configuration
  server: {
    port: process.env.PORT || 3001,
    env: process.env.NODE_ENV || 'development',
    corsOrigins: process.env.CORS_ORIGINS || '*',
  },

  // Sui blockchain configuration
  sui: {
    rpcUrl: process.env.SUI_RPC_URL || 'https://fullnode.testnet.sui.io:443',
    deployerKey: process.env.DEPLOYER_PRIVATE_KEY,
    networkType: process.env.SUI_NETWORK || 'testnet',
  },

  // OpenAI API configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4-turbo',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '500'),
  },

  // Twitter API configuration
  twitter: {
    apiKey: process.env.TWITTER_API_KEY,
    apiSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
    botUsername: process.env.TWITTER_BOT_USERNAME || 'SuiForge_AI',
    pollingInterval: parseInt(process.env.TWITTER_POLLING_INTERVAL || '60000'),
  },

  // Farcaster configuration
  farcaster: {
    mnemonic: process.env.FARCASTER_MNEMONIC,
    apiKey: process.env.FARCASTER_API_KEY,
    pollingInterval: parseInt(process.env.FARCASTER_POLLING_INTERVAL || '60000'),
  },

  // Telegram configuration
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
  },

  // Smart contract addresses
  contracts: {
    packageId: process.env.PACKAGE_ID,
    tokenFactoryId: process.env.TOKEN_FACTORY_ID,
    liquidityLockerId: process.env.LIQUIDITY_LOCKER_ID,
    antiBotId: process.env.ANTI_BOT_ID,
    feeDistributorId: process.env.FEE_DISTRIBUTOR_ID,
  },

  // DEX configuration
  dex: {
    deepbookPackageId: process.env.DEEPBOOK_PACKAGE_ID || '0x29e8cc190cd55f34232b3a74c88f0b3fa45dc8953da8538f71e505ba77723bf2',
    cetusPackageId: process.env.CETUS_PACKAGE_ID,
  },

  // Token creation settings
  tokenCreation: {
    maxTokensPerDay: parseInt(process.env.MAX_TOKENS_PER_DAY || '10'),
    maxTokensPerUser: parseInt(process.env.MAX_TOKENS_PER_USER || '5'),
    protocolFeeBps: parseInt(process.env.PROTOCOL_FEE_BPS || '200'),
    creatorFeeBps: parseInt(process.env.CREATOR_FEE_BPS || '800'),
    defaultDecimals: parseInt(process.env.DEFAULT_DECIMALS || '9'),
    defaultMaxSupply: process.env.DEFAULT_MAX_SUPPLY || '1000000000000',
    defaultInitialSupply: process.env.DEFAULT_INITIAL_SUPPLY || '500000000000',
  },

  // Anti-bot settings
  antiBot: {
    cooldownPeriod: parseInt(process.env.DEFAULT_COOLDOWN_PERIOD || '300'),
    maxBuyPercent: parseInt(process.env.DEFAULT_MAX_BUY_PERCENT || '500'),
    enableTimeDelay: parseInt(process.env.DEFAULT_ENABLE_TIME_DELAY || '300'),
  },

  // Liquidity settings
  liquidity: {
    lockDuration: parseInt(process.env.DEFAULT_LOCK_DURATION || '2592000'),
  },

  // URLs for external services
  urls: {
    explorer: process.env.EXPLORER_URL || 'https://suiexplorer.com/object/',
    trade: process.env.TRADE_URL || 'https://suiforge.io/trade/',
  },
};