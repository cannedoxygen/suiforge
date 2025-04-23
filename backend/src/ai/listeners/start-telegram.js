#!/usr/bin/env node

/**
 * Telegram Listener Startup Script
 * This script starts the Telegram listener service
 */

const { startTelegramListener } = require('../telegram');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

console.log('Starting Telegram Listener Service...');
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

// Start the Telegram listener
const success = startTelegramListener();

if (success) {
  console.log('Telegram Listener started successfully');
} else {
  console.error('Failed to start Telegram Listener');
  process.exit(1);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Received SIGINT. Telegram Listener shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Telegram Listener shutting down...');
  process.exit(0);
});

// Keep the process running
process.stdin.resume();