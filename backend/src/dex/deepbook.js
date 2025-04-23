// deepbook.js - Integrate with DeepBook DEX for liquidity
const { Ed25519Keypair, JsonRpcProvider, RawSigner, TransactionBlock } = require('@mysten/sui.js');
const config = require('../../config/default');

// Initialize Sui provider
const provider = new JsonRpcProvider({ fullnode: process.env.SUI_RPC_URL || config.sui.rpcUrl });

/**
 * Create a signer with provided private key
 * @param {string} privateKey - Private key in hex format
 * @returns {RawSigner} - Sui signer
 */
function createSigner(privateKey) {
    try {
        // Create keypair from private key
        const keypair = Ed25519Keypair.fromSecretKey(
            Buffer.from(privateKey.replace('0x', ''), 'hex')
        );
        
        // Create signer
        return new RawSigner(keypair, provider);
    } catch (error) {
        console.error("Error creating signer:", error);
        throw error;
    }
}

/**
 * Create a pool for a token pair on DeepBook
 * @param {string} tokenId - Token ID
 * @returns {Promise<Object>} - Pool creation result
 */
async function createPool(tokenId) {
    try {
        console.log(`Creating DeepBook pool for token ${tokenId}`);
        
        // Create signer using deployment key
        const deployerKey = process.env.DEPLOYER_PRIVATE_KEY || config.sui.deployerKey;
        const signer = createSigner(deployerKey);
        
        // Get the DeepBook package ID
        const deepbookId = process.env.DEEPBOOK_PACKAGE_ID || config.dex.deepbookPackageId;
        
        // Create transaction block
        const tx = new TransactionBlock();
        
        // Call the create_pool function
        tx.moveCall({
            target: `${deepbookId}::clob::create_pool`,
            arguments: [
                tx.pure(tokenId),            // Base asset type (token)
                tx.pure('0x2::sui::SUI'),    // Quote asset type (SUI)
                tx.pure(1000000),            // Tick size (min price increment in base units)
                tx.pure(100000),             // Lot size (min quantity increment in base units)
            ],
            typeArguments: [
                // Use the token type path
                tokenId,                      // Base asset type
                '0x2::sui::SUI',             // Quote asset type
            ],
        });
        
        // Execute transaction
        const result = await signer.signAndExecuteTransactionBlock({
            transactionBlock: tx,
            options: {
                showEffects: true,
                showEvents: true,
            },
        });
        
        console.log("Pool creation result:", result);
        
        // Extract pool ID from events
        const poolId = extractPoolIdFromEvents(result);
        
        if (!poolId) {
            throw new Error("Failed to extract pool ID from events");
        }
        
        return {
            success: true,
            poolId,
            transactionDigest: result.digest,
        };
    } catch (error) {
        console.error("Error creating DeepBook pool:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Extract pool ID from transaction events
 * @param {Object} result - Transaction result
 * @returns {string|null} - Pool ID
 */
function extractPoolIdFromEvents(result) {
    try {
        if (!result.events || result.events.length === 0) {
            return null;
        }
        
        // Find the PoolCreated event
        const poolCreatedEvent = result.events.find(
            event => event.type.includes('::clob::PoolCreated')
        );
        
        if (!poolCreatedEvent || !poolCreatedEvent.parsedJson) {
            return null;
        }
        
        return poolCreatedEvent.parsedJson.pool_id;
    } catch (error) {
        console.error("Error extracting pool ID:", error);
        return null;
    }
}

/**
 * Deposit liquidity into a DeepBook pool
 * @param {string} poolId - Pool ID
 * @param {string} tokenId - Token ID
 * @param {bigint} tokenAmount - Amount of tokens to deposit
 * @param {bigint} suiAmount - Amount of SUI to deposit
 * @returns {Promise<Object>} - Deposit result
 */
async function depositLiquidity(poolId, tokenId, tokenAmount, suiAmount) {
    try {
        console.log(`Depositing liquidity into pool ${poolId}`);
        
        // Create signer using deployment key
        const deployerKey = process.env.DEPLOYER_PRIVATE_KEY || config.sui.deployerKey;
        const signer = createSigner(deployerKey);
        
        // Get the DeepBook package ID
        const deepbookId = process.env.DEEPBOOK_PACKAGE_ID || config.dex.deepbookPackageId;
        
        // Create transaction block
        const tx = new TransactionBlock();
        
        // Get all owned tokens of this type
        const tokenObjects = await provider.getOwnedObjects({
            owner: await signer.getAddress(),
            filter: {
                StructType: tokenId,
            },
            options: {
                showContent: true,
            },
        });
        
        if (!tokenObjects.data || tokenObjects.data.length === 0) {
            throw new Error(`No tokens of type ${tokenId} found`);
        }
        
        // Find a token object with sufficient balance
        let tokenObjectId = null;
        for (const obj of tokenObjects.data) {
            const content = obj.data.content;
            if (content.balance >= tokenAmount) {
                tokenObjectId = obj.data.objectId;
                break;
            }
        }
        
        if (!tokenObjectId) {
            throw new Error(`No token object with sufficient balance found`);
        }
        
        // Deposit base asset (token)
        tx.moveCall({
            target: `${deepbookId}::clob::deposit_base`,
            arguments: [
                tx.object(poolId),            // Pool ID
                tx.object(tokenObjectId),     // Token object
            ],
            typeArguments: [
                tokenId,                      // Base asset type
                '0x2::sui::SUI',             // Quote asset type
            ],
        });
        
        // Deposit quote asset (SUI)
        tx.moveCall({
            target: `${deepbookId}::clob::deposit_quote`,
            arguments: [
                tx.object(poolId),            // Pool ID
                tx.pure(suiAmount),           // SUI amount
            ],
            typeArguments: [
                tokenId,                      // Base asset type
                '0x2::sui::SUI',             // Quote asset type
            ],
        });
        
        // Execute transaction
        const result = await signer.signAndExecuteTransactionBlock({
            transactionBlock: tx,
            options: {
                showEffects: true,
            },
        });
        
        console.log("Liquidity deposit result:", result);
        
        return {
            success: true,
            transactionDigest: result.digest,
        };
    } catch (error) {
        console.error("Error depositing liquidity:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Place limit orders to provide liquidity
 * @param {string} poolId - Pool ID
 * @param {string} tokenId - Token ID
 * @param {Array} orders - Array of order objects with price, quantity, and side
 * @returns {Promise<Object>} - Order placement result
 */
async function placeLimitOrders(poolId, tokenId, orders) {
    try {
        console.log(`Placing ${orders.length} limit orders in pool ${poolId}`);
        
        // Create signer using deployment key
        const deployerKey = process.env.DEPLOYER_PRIVATE_KEY || config.sui.deployerKey;
        const signer = createSigner(deployerKey);
        
        // Get the DeepBook package ID
        const deepbookId = process.env.DEEPBOOK_PACKAGE_ID || config.dex.deepbookPackageId;
        
        // Create transaction block
        const tx = new TransactionBlock();
        
        // Place each order
        for (const order of orders) {
            tx.moveCall({
                target: `${deepbookId}::clob::place_limit_order`,
                arguments: [
                    tx.object(poolId),        // Pool ID
                    tx.pure(order.price),     // Price
                    tx.pure(order.quantity),  // Quantity
                    tx.pure(order.side),      // Side (true for buy, false for sell)
                    tx.pure(0),               // Time-in-force (0 for GTC)
                    tx.pure(0),               // Self-matching behavior (0 for reject)
                    tx.object('0x6'),         // Clock object
                ],
                typeArguments: [
                    tokenId,                  // Base asset type
                    '0x2::sui::SUI',         // Quote asset type
                ],
            });
        }
        
        // Execute transaction
        const result = await signer.signAndExecuteTransactionBlock({
            transactionBlock: tx,
            options: {
                showEffects: true,
            },
        });
        
        console.log("Limit orders result:", result);
        
        return {
            success: true,
            transactionDigest: result.digest,
        };
    } catch (error) {
        console.error("Error placing limit orders:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Generate order book with reasonable spread
 * @param {bigint} basePrice - Base price for the token in SUI
 * @param {number} levels - Number of price levels to create
 * @param {number} spreadPercent - Spread percentage between bid and ask
 * @returns {Array} - Array of orders
 */
function generateOrderBook(basePrice, levels = 5, spreadPercent = 10) {
    const orders = [];
    
    // Calculate spread
    const spread = (basePrice * BigInt(spreadPercent)) / BigInt(100);
    const bidBasePrice = basePrice - spread;
    const askBasePrice = basePrice + spread;
    
    // Generate bid orders (buys)
    for (let i = 0; i < levels; i++) {
        // Each level decreases in price by 5%
        const priceDrop = (bidBasePrice * BigInt(i * 5)) / BigInt(100);
        const price = bidBasePrice - priceDrop;
        
        // Quantity increases as price decreases
        const quantity = BigInt(10000000) * BigInt(i + 1);
        
        orders.push({
            price,
            quantity,
            side: true, // true for buy
        });
    }
    
    // Generate ask orders (sells)
    for (let i = 0; i < levels; i++) {
        // Each level increases in price by 5%
        const priceIncrease = (askBasePrice * BigInt(i * 5)) / BigInt(100);
        const price = askBasePrice + priceIncrease;
        
        // Quantity increases as price increases
        const quantity = BigInt(10000000) * BigInt(i + 1);
        
        orders.push({
            price,
            quantity,
            side: false, // false for sell
        });
    }
    
    return orders;
}

/**
 * Provide liquidity for a token
 * @param {string} tokenId - Token ID
 * @param {bigint} tokenAmount - Amount of tokens to provide as liquidity
 * @param {bigint} suiAmount - Amount of SUI to provide as liquidity
 * @returns {Promise<Object>} - Liquidity provision result
 */
async function provideLiquidity(tokenId, tokenAmount, suiAmount) {
    try {
        // First create a pool for the token
        const poolResult = await createPool(tokenId);
        
        if (!poolResult.success) {
            throw new Error(`Failed to create pool: ${poolResult.error}`);
        }
        
        const poolId = poolResult.poolId;
        
        // Deposit liquidity
        const depositResult = await depositLiquidity(poolId, tokenId, tokenAmount, suiAmount);
        
        if (!depositResult.success) {
            throw new Error(`Failed to deposit liquidity: ${depositResult.error}`);
        }
        
        // Calculate base price (1 token = 0.00005 SUI)
        const basePrice = BigInt(50000); // 0.00005 SUI with 9 decimals
        
        // Generate order book
        const orders = generateOrderBook(basePrice);
        
        // Place limit orders
        const orderResult = await placeLimitOrders(poolId, tokenId, orders);
        
        if (!orderResult.success) {
            throw new Error(`Failed to place limit orders: ${orderResult.error}`);
        }
        
        return {
            success: true,
            poolId,
            basePrice,
            orderCount: orders.length,
            transactionDigest: orderResult.transactionDigest,
        };
    } catch (error) {
        console.error("Error providing liquidity:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}

module.exports = {
    createPool,
    depositLiquidity,
    placeLimitOrders,
    provideLiquidity,
};