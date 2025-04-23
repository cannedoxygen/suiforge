#!/usr/bin/env node

/**
 * Farcaster Listener Startup Script
 * This script starts the Farcaster listener service
 */

const { startFarcasterListener } = require('../farcaster');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

console.log('Starting Farcaster Listener Service...');
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

// Get polling interval from environment or use default
const pollingInterval = process.env.FARCASTER_POLLING_INTERVAL 
  ? parseInt(process.env.FARCASTER_POLLING_INTERVAL) 
  : 60000; // Default 1 minute

console.log(`Polling interval: ${pollingInterval}ms`);

// Start the Farcaster listener
startFarcasterListener(pollingInterval);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Received SIGINT. Farcaster Listener shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Farcaster Listener shutting down...');
  process.exit(0);
});

// Keep the process running
process.stdin.resume();