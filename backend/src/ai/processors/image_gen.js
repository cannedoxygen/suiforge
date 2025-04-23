// image_gen.js - Generate meme images for tokens
const { Configuration, OpenAIApi } = require('openai');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('../../config/default');
const { createCanvas, loadImage, registerFont } = require('canvas');
const GIFEncoder = require('gifencoder');

// Initialize OpenAI
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY || config.openai.apiKey,
});
const openai = new OpenAIApi(configuration);

// Setup directories
const ASSETS_DIR = path.join(__dirname, '../../../assets');
const OUTPUT_DIR = path.join(__dirname, '../../../public/tokens');

// Ensure directories exist
if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
}
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Register fonts
try {
    registerFont(path.join(ASSETS_DIR, 'Impact.ttf'), { family: 'Impact' });
    registerFont(path.join(ASSETS_DIR, 'Arial.ttf'), { family: 'Arial' });
} catch (error) {
    console.warn("Could not register fonts:", error);
}

/**
 * Generate a static image for a token using DALL-E
 * @param {Object} tokenParams - Token parameters
 * @returns {Promise<string>} - Path to the generated image
 */
async function generateTokenImage(tokenParams) {
    try {
        const prompt = `
        Create a funny meme image for a cryptocurrency token with these details:
        - Name: ${tokenParams.tokenName}
        - Symbol: ${tokenParams.tokenSymbol}
        - Theme: ${tokenParams.memeTheme}
        - Emoji: ${tokenParams.emoji}
        
        Make it bright, colorful, and viral-worthy. Include the token symbol prominently.
        Style should be cartoonish, with high contrast and vibrant colors. No text needed.
        `;

        const response = await openai.createImage({
            prompt,
            n: 1,
            size: '1024x1024',
            response_format: 'url',
        });

        const imageUrl = response.data.data[0].url;
        
        // Download the image
        const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const outputPath = path.join(OUTPUT_DIR, `${tokenParams.tokenSymbol.toLowerCase()}_static.png`);
        
        fs.writeFileSync(outputPath, Buffer.from(imageResponse.data));
        console.log(`Static image generated at: ${outputPath}`);
        
        return outputPath;
    } catch (error) {
        console.error("Error generating token image:", error);
        
        // Generate a fallback image
        return generateFallbackImage(tokenParams);
    }
}

/**
 * Generate a fallback image if DALL-E fails
 * @param {Object} tokenParams - Token parameters
 * @returns {Promise<string>} - Path to the generated image
 */
async function generateFallbackImage(tokenParams) {
    try {
        // Create a canvas
        const width = 1024;
        const height = 1024;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Set background gradient
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, getRandomColor());
        gradient.addColorStop(1, getRandomColor());
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Add token symbol
        ctx.font = 'bold 150px Impact, Arial, sans-serif';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`$${tokenParams.tokenSymbol}`, width / 2, height / 2 - 50);
        
        // Add emoji
        ctx.font = '220px Arial';
        ctx.fillText(tokenParams.emoji, width / 2, height / 2 + 150);

        // Save the image
        const outputPath = path.join(OUTPUT_DIR, `${tokenParams.tokenSymbol.toLowerCase()}_fallback.png`);
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(outputPath, buffer);
        
        console.log(`Fallback image generated at: ${outputPath}`);
        return outputPath;
    } catch (error) {
        console.error("Error generating fallback image:", error);
        return null;
    }
}

/**
 * Generate an animated GIF for a token
 * @param {Object} tokenParams - Token parameters
 * @param {string} staticImagePath - Path to the static image
 * @returns {Promise<string>} - Path to the generated GIF
 */
async function generateTokenGif(tokenParams, staticImagePath) {
    try {
        if (!staticImagePath || !fs.existsSync(staticImagePath)) {
            throw new Error("Static image not found");
        }

        // Create a canvas for GIF frames
        const width = 500;
        const height = 500;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        
        // Load the static image
        const image = await loadImage(staticImagePath);
        
        // Setup GIF encoder
        const encoder = new GIFEncoder(width, height);
        const outputPath = path.join(OUTPUT_DIR, `${tokenParams.tokenSymbol.toLowerCase()}_animated.gif`);
        const stream = fs.createWriteStream(outputPath);
        
        // Initialize GIF
        encoder.createReadStream().pipe(stream);
        encoder.start();
        encoder.setRepeat(0);   // 0 = repeat forever
        encoder.setDelay(100);  // Frame delay in ms
        encoder.setQuality(10); // Image quality
        
        // Create frames
        for (let i = 0; i < 20; i++) {
            // Clear canvas
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            
            // Calculate scaling effect
            const scale = 0.8 + Math.sin(i * 0.3) * 0.1;
            const rotation = Math.sin(i * 0.2) * 0.1;
            
            // Draw the image with effects
            ctx.save();
            ctx.translate(width / 2, height / 2);
            ctx.rotate(rotation);
            ctx.scale(scale, scale);
            ctx.drawImage(image, -width / 2, -height / 2, width, height);
            ctx.restore();
            
            // Add frame to GIF
            encoder.addFrame(ctx);
        }
        
        // Finish encoding
        encoder.finish();
        console.log(`Animated GIF generated at: ${outputPath}`);
        
        return outputPath;
    } catch (error) {
        console.error("Error generating token GIF:", error);
        return null;
    }
}

/**
 * Generate random color for fallback images
 * @returns {string} - Random color in hex format
 */
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

/**
 * Main function to generate all token imagery
 * @param {Object} tokenParams - Token parameters
 * @returns {Promise<Object>} - Paths to generated images
 */
async function generateTokenImagery(tokenParams) {
    try {
        // Generate static image
        const staticImagePath = await generateTokenImage(tokenParams);
        
        // Generate animated GIF
        const animatedGifPath = await generateTokenGif(tokenParams, staticImagePath);
        
        return {
            staticImage: staticImagePath,
            animatedGif: animatedGifPath,
        };
    } catch (error) {
        console.error("Error generating token imagery:", error);
        return {
            staticImage: null,
            animatedGif: null,
            error: error.message
        };
    }
}

module.exports = {
    generateTokenImagery,
    generateTokenImage,
    generateTokenGif
};