#!/usr/bin/env node

/**
 * Twitter Listener Startup Script
 * This script starts the Twitter listener service
 */

const { startTwitterListener } = require('../twitter');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

console.log('Starting Twitter Listener Service...');
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Bot username: @${process.env.TWITTER_BOT_USERNAME || 'SuiForge_AI'}`);

// Get polling interval from environment or use default
const pollingInterval = process.env.TWITTER_POLLING_INTERVAL 
  ? parseInt(process.env.TWITTER_POLLING_INTERVAL) 
  : 60000; // Default 1 minute

console.log(`Polling interval: ${pollingInterval}ms`);

// Start the Twitter listener
startTwitterListener(pollingInterval);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Received SIGINT. Twitter Listener shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Twitter Listener shutting down...');
  process.exit(0);
});

// Keep the process running
process.stdin.resume();