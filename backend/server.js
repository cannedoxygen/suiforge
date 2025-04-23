// server.js - Main entry point for the SuiForge backend
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const dotenv = require('dotenv');
const config = require('./config/default');

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require('./src/api/routes/auth');
const tokenRoutes = require('./src/api/routes/token');
const liquidityRoutes = require('./src/api/routes/liquidity');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Configure middleware
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set up rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again after 15 minutes'
});

// Apply rate limiting to all API routes
app.use('/api', apiLimiter);

// Serve static files
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/tokens', express.static(path.join(__dirname, 'public/tokens')));

// Set up routes
app.use('/api/auth', authRoutes);
app.use('/api/token', tokenRoutes);
app.use('/api/liquidity', liquidityRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root API endpoint
app.get('/api', (req, res) => {
  res.status(200).json({
    message: 'Welcome to SuiForge API',
    version: '1.0.0',
    documentation: `${config.app.baseUrl}/docs`
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 SuiForge server running on port ${PORT}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📚 API Documentation: ${config.app.baseUrl}/docs`);
});

// Start social media listeners if enabled
if (process.env.ENABLE_LISTENERS === 'true') {
  try {
    // Import listener modules
    const twitterListener = require('./src/ai/listeners/twitter');
    const farcasterListener = require('./src/ai/listeners/farcaster');
    const telegramListener = require('./src/ai/listeners/telegram');
    
    // Start listeners
    console.log('Starting social media listeners...');
    
    // Twitter listener
    if (process.env.ENABLE_TWITTER_LISTENER === 'true') {
      twitterListener.startTwitterListener();
      console.log('📱 Twitter listener started');
    }
    
    // Farcaster listener
    if (process.env.ENABLE_FARCASTER_LISTENER === 'true') {
      farcasterListener.startFarcasterListener();
      console.log('📱 Farcaster listener started');
    }
    
    // Telegram listener
    if (process.env.ENABLE_TELEGRAM_LISTENER === 'true') {
      telegramListener.startTelegramListener();
      console.log('📱 Telegram listener started');
    }
  } catch (error) {
    console.error('Error starting social media listeners:', error);
  }
}

module.exports = app; // Export for testing