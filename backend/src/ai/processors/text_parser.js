// text_parser.js - Extract token information from social media messages
const { Configuration, OpenAIApi } = require('openai');
const config = require('../../config/default');

// Initialize OpenAI
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY || config.openai.apiKey,
});
const openai = new OpenAIApi(configuration);

/**
 * Parse a social media message to extract token creation parameters
 * @param {string} message - The message from social media 
 * @returns {Promise<Object>} - Token parameters
 */
async function parseTokenRequest(message) {
    try {
        const prompt = `
        Extract token creation information from the following message. 
        If the message is requesting to create a token, extract the following information:
        1. Token Name (a creative name for the token)
        2. Token Symbol (2-5 characters)
        3. Meme Theme or Description (what concept/meme the token is about)
        4. Emoji (one emoji that represents the token)
        
        Format the response as valid JSON:
        {
            "isTokenRequest": true/false,
            "tokenName": "extracted name or null",
            "tokenSymbol": "extracted symbol or null",
            "memeTheme": "extracted theme or null",
            "emoji": "extracted emoji or null",
            "confidence": 0-100 (how confident are you this is a token creation request)
        }
        
        If the message isn't requesting a token creation, set isTokenRequest to false and confidence to 0.
        
        Message: "${message}"
        `;

        const response = await openai.createChatCompletion({
            model: "gpt-4-turbo",
            messages: [
                { role: "system", content: "You are an AI assistant that extracts token creation parameters from user messages." },
                { role: "user", content: prompt }
            ],
            temperature: 0.1,
            max_tokens: 500,
        });

        // Parse the response
        const content = response.data.choices[0].message.content;
        const parsedResponse = JSON.parse(content);
        
        console.log("Parsed token request:", parsedResponse);
        return parsedResponse;
    } catch (error) {
        console.error("Error parsing token request:", error);
        return {
            isTokenRequest: false,
            confidence: 0,
            error: error.message
        };
    }
}

/**
 * Validate and format token parameters
 * @param {Object} tokenParams - Raw token parameters 
 * @returns {Object} - Validated and formatted token parameters
 */
function validateTokenParams(tokenParams) {
    if (!tokenParams.isTokenRequest || tokenParams.confidence < 70) {
        return {
            isValid: false,
            reason: "Not a token request or low confidence"
        };
    }

    const validatedParams = {
        isValid: true,
        tokenName: null,
        tokenSymbol: null,
        memeTheme: null,
        emoji: null
    };

    // Validate and format token name
    if (tokenParams.tokenName) {
        validatedParams.tokenName = tokenParams.tokenName
            .trim()
            .replace(/[^\w\s]/g, ''); // Remove special characters
    } else {
        validatedParams.isValid = false;
        validatedParams.reason = "Missing token name";
        return validatedParams;
    }

    // Validate and format token symbol
    if (tokenParams.tokenSymbol) {
        // Convert to uppercase and remove special characters
        validatedParams.tokenSymbol = tokenParams.tokenSymbol
            .trim()
            .toUpperCase()
            .replace(/[^\w]/g, '');
        
        // Ensure it's 2-5 characters
        if (validatedParams.tokenSymbol.length < 2 || validatedParams.tokenSymbol.length > 5) {
            validatedParams.isValid = false;
            validatedParams.reason = "Token symbol must be 2-5 characters";
            return validatedParams;
        }
    } else {
        validatedParams.isValid = false;
        validatedParams.reason = "Missing token symbol";
        return validatedParams;
    }

    // Validate meme theme
    if (tokenParams.memeTheme) {
        validatedParams.memeTheme = tokenParams.memeTheme.trim();
    } else {
        validatedParams.memeTheme = "Generic meme token"; // Default value
    }

    // Validate emoji
    if (tokenParams.emoji && tokenParams.emoji.length === 2) { // Most emojis are 2 characters in JS
        validatedParams.emoji = tokenParams.emoji;
    } else if (tokenParams.emoji) {
        validatedParams.emoji = tokenParams.emoji;
    } else {
        // Default emoji based on theme
        const defaultEmojis = ["🚀", "🌕", "💎", "🔥", "🦍", "🐶", "🐱", "🤖"];
        validatedParams.emoji = defaultEmojis[Math.floor(Math.random() * defaultEmojis.length)];
    }

    return validatedParams;
}

/**
 * Generate additional token metadata based on the base parameters
 * @param {Object} baseParams - Validated base token parameters
 * @returns {Promise<Object>} - Extended token parameters with AI-generated content
 */
async function generateTokenMetadata(baseParams) {
    try {
        const prompt = `
        Create creative metadata for a meme token with these parameters:
        - Name: ${baseParams.tokenName}
        - Symbol: ${baseParams.tokenSymbol}
        - Theme: ${baseParams.memeTheme}
        - Emoji: ${baseParams.emoji}
        
        Generate the following details:
        1. A catchy short description (max 100 chars)
        2. A funny tokenomics summary (max 200 chars)
        3. Three potential hashtags for social media
        
        Format as JSON:
        {
            "shortDescription": "...",
            "tokenomics": "...",
            "hashtags": ["#...", "#...", "#..."]
        }
        `;

        const response = await openai.createChatCompletion({
            model: "gpt-4-turbo",
            messages: [
                { role: "system", content: "You are a creative AI for generating viral meme token content." },
                { role: "user", content: prompt }
            ],
            temperature: 0.8,
            max_tokens: 500,
        });

        // Parse the response
        const content = response.data.choices[0].message.content;
        const metadata = JSON.parse(content);
        
        return {
            ...baseParams,
            ...metadata
        };
    } catch (error) {
        console.error("Error generating token metadata:", error);
        return {
            ...baseParams,
            shortDescription: `The next big ${baseParams.memeTheme} meme token!`,
            tokenomics: "1% fee: 80% to creator, 20% to protocol. Initial LP locked for 30 days.",
            hashtags: [`#${baseParams.tokenSymbol}`, "#SuiMeme", "#SuiForge"]
        };
    }
}

module.exports = {
    parseTokenRequest,
    validateTokenParams,
    generateTokenMetadata
};