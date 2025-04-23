// cetus.js - Integrate with Cetus DEX for liquidity locking
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
 * Find LP tokens for a specific pool
 * @param {string} senderAddress - Address of the sender
 * @param {string} poolId - Pool ID
 * @returns {Promise<string|null>} - LP token object ID
 */
async function findLpTokens(senderAddress, poolId) {
    try {
        // Query LP tokens owned by the sender
        const objects = await provider.getOwnedObjects({
            owner: senderAddress,
            filter: {
                StructType: `${config.dex.cetusPackageId}::pool::LP<${poolId}>`,
            },
            options: {
                showContent: true,
            },
        });
        
        if (!objects.data || objects.data.length === 0) {
            console.log(`No LP tokens found for pool ${poolId}`);
            return null;
        }
        
        // Return the first LP token object ID
        return objects.data[0].data.objectId;
    } catch (error) {
        console.error("Error finding LP tokens:", error);
        return null;
    }
}

/**
 * Lock liquidity for a token
 * @param {string} tokenId - Token ID
 * @param {number} lockDuration - Lock duration in seconds
 * @returns {Promise<Object>} - Lock result
 */
async function lockLiquidity(tokenId, lockDuration) {
    try {
        console.log(`Locking liquidity for token ${tokenId} for ${lockDuration} seconds`);
        
        // Create signer using deployment key
        const deployerKey = process.env.DEPLOYER_PRIVATE_KEY || config.sui.deployerKey;
        const signer = createSigner(deployerKey);
        const senderAddress = await signer.getAddress();
        
        // Find the pool ID for this token (simplified, in real implementation you'd query the Cetus registry)
        // For now, let's assume the pool ID is derived from the token ID
        const poolId = `${tokenId}::POOL`;
        
        // Find LP tokens for this pool
        const lpTokenId = await findLpTokens(senderAddress, poolId);
        
        if (!lpTokenId) {
            throw new Error(`No LP tokens found for pool ${poolId}`);
        }
        
        // Get the liquidity locker ID
        const liquidityLockerId = process.env.LIQUIDITY_LOCKER_ID || config.contracts.liquidityLockerId;
        
        if (!liquidityLockerId) {
            throw new Error("Liquidity locker ID not configured");
        }
        
        // Create transaction block
        const tx = new TransactionBlock();
        
        // Call the lock_liquidity function
        tx.moveCall({
            target: `${config.contracts.packageId}::liquidity_locker::lock_liquidity`,
            arguments: [
                tx.object(liquidityLockerId),      // Locker object
                tx.object('0x6'),                  // Clock object
                tx.object(lpTokenId),              // LP token
                tx.pure(lockDuration),             // Lock duration in seconds
            ],
            typeArguments: [
                `${config.dex.cetusPackageId}::pool::LP<${poolId}>`, // LP token type
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
        
        console.log("Liquidity lock result:", result);
        
        // Extract lock ID from events
        const lockId = extractLockIdFromEvents(result);
        
        if (!lockId) {
            throw new Error("Failed to extract lock ID from events");
        }
        
        // Calculate unlock time
        const currentTime = Math.floor(Date.now() / 1000);
        const unlockTime = currentTime + lockDuration;
        
        return {
            success: true,
            lockId,
            tokenId,
            unlockTime,
            lockDuration,
            transactionDigest: result.digest,
        };
    } catch (error) {
        console.error("Error locking liquidity:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Extract lock ID from transaction events
 * @param {Object} result - Transaction result
 * @returns {string|null} - Lock ID
 */
function extractLockIdFromEvents(result) {
    try {
        if (!result.events || result.events.length === 0) {
            return null;
        }
        
        // Find the LiquidityLocked event
        const lockEvent = result.events.find(
            event => event.type.includes('::liquidity_locker::LiquidityLocked')
        );
        
        if (!lockEvent || !lockEvent.parsedJson) {
            return null;
        }
        
        return lockEvent.parsedJson.lock_id;
    } catch (error) {
        console.error("Error extracting lock ID:", error);
        return null;
    }
}

/**
 * Check if liquidity is locked for a token
 * @param {string} tokenId - Token ID
 * @returns {Promise<Object>} - Lock status
 */
async function checkLiquidityLock(tokenId) {
    try {
        // Get the liquidity locker ID
        const liquidityLockerId = process.env.LIQUIDITY_LOCKER_ID || config.contracts.liquidityLockerId;
        
        if (!liquidityLockerId) {
            throw new Error("Liquidity locker ID not configured");
        }
        
        // Query events from the locker to find locks for this token
        const events = await provider.queryEvents({
            query: {
                MoveEventType: `${config.contracts.packageId}::liquidity_locker::LiquidityLocked`,
            },
            limit: 100,
        });
        
        if (!events.data || events.data.length === 0) {
            return {
                success: true,
                isLocked: false,
                tokenId,
            };
        }
        
        // Find lock events for this token
        const tokenLockEvents = events.data.filter(
            event => event.parsedJson && event.parsedJson.token_id === tokenId
        );
        
        if (tokenLockEvents.length === 0) {
            return {
                success: true,
                isLocked: false,
                tokenId,
            };
        }
        
        // Check the most recent lock
        const latestLock = tokenLockEvents[0];
        const currentTime = Math.floor(Date.now() / 1000);
        const isLocked = currentTime < latestLock.parsedJson.unlock_time;
        
        return {
            success: true,
            isLocked,
            tokenId,
            lockId: latestLock.parsedJson.lock_id,
            locker: latestLock.parsedJson.locker,
            amount: latestLock.parsedJson.amount,
            unlockTime: latestLock.parsedJson.unlock_time,
            timeRemaining: isLocked ? latestLock.parsedJson.unlock_time - currentTime : 0,
        };
    } catch (error) {
        console.error("Error checking liquidity lock:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Unlock liquidity for a token if the lock period has passed
 * @param {string} lockId - Lock ID
 * @param {string} tokenId - Token ID for type argument
 * @returns {Promise<Object>} - Unlock result
 */
async function unlockLiquidity(lockId, tokenId) {
    try {
        console.log(`Unlocking liquidity for lock ${lockId}`);
        
        // Create signer using deployment key
        const deployerKey = process.env.DEPLOYER_PRIVATE_KEY || config.sui.deployerKey;
        const signer = createSigner(deployerKey);
        
        // Check if lock exists and is expired
        const lockCheck = await checkLiquidityLock(tokenId);
        
        if (!lockCheck.success) {
            throw new Error(`Failed to check lock status: ${lockCheck.error}`);
        }
        
        if (lockCheck.isLocked) {
            throw new Error(`Liquidity is still locked for ${lockCheck.timeRemaining} more seconds`);
        }
        
        // Get the liquidity locker ID
        const liquidityLockerId = process.env.LIQUIDITY_LOCKER_ID || config.contracts.liquidityLockerId;
        
        if (!liquidityLockerId) {
            throw new Error("Liquidity locker ID not configured");
        }
        
        // Find the pool ID for this token (simplified)
        const poolId = `${tokenId}::POOL`;
        
        // Create transaction block
        const tx = new TransactionBlock();
        
        // Call the unlock_liquidity function
        tx.moveCall({
            target: `${config.contracts.packageId}::liquidity_locker::unlock_liquidity`,
            arguments: [
                tx.object(liquidityLockerId),      // Locker object
                tx.object('0x6'),                  // Clock object
                tx.pure(lockId),                   // Lock ID
            ],
            typeArguments: [
                `${config.dex.cetusPackageId}::pool::LP<${poolId}>`, // LP token type
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
        
        console.log("Liquidity unlock result:", result);
        
        return {
            success: true,
            lockId,
            tokenId,
            transactionDigest: result.digest,
        };
    } catch (error) {
        console.error("Error unlocking liquidity:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Get all locks for a specific locker
 * @param {string} lockerAddress - Address of the locker
 * @returns {Promise<Object>} - Locks info
 */
async function getLockerLocks(lockerAddress) {
    try {
        // Get the liquidity locker ID
        const liquidityLockerId = process.env.LIQUIDITY_LOCKER_ID || config.contracts.liquidityLockerId;
        
        if (!liquidityLockerId) {
            throw new Error("Liquidity locker ID not configured");
        }
        
        // Query events from the locker to find locks for this locker
        const events = await provider.queryEvents({
            query: {
                MoveEventType: `${config.contracts.packageId}::liquidity_locker::LiquidityLocked`,
            },
            limit: 100,
        });
        
        if (!events.data || events.data.length === 0) {
            return {
                success: true,
                locks: [],
                lockerAddress,
            };
        }
        
        // Find lock events for this locker
        const lockerLockEvents = events.data.filter(
            event => event.parsedJson && event.parsedJson.locker === lockerAddress
        );
        
        if (lockerLockEvents.length === 0) {
            return {
                success: true,
                locks: [],
                lockerAddress,
            };
        }
        
        // Process locks
        const currentTime = Math.floor(Date.now() / 1000);
        const locks = lockerLockEvents.map(event => {
            const parsedJson = event.parsedJson;
            const isLocked = currentTime < parsedJson.unlock_time;
            
            return {
                lockId: parsedJson.lock_id,
                tokenId: parsedJson.token_id,
                amount: parsedJson.amount,
                unlockTime: parsedJson.unlock_time,
                isLocked,
                timeRemaining: isLocked ? parsedJson.unlock_time - currentTime : 0,
            };
        });
        
        return {
            success: true,
            locks,
            lockerAddress,
            totalLocks: locks.length,
            activeLocks: locks.filter(lock => lock.isLocked).length,
        };
    } catch (error) {
        console.error("Error getting locker locks:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}

module.exports = {
    lockLiquidity,
    unlockLiquidity,
    checkLiquidityLock,
    getLockerLocks,
};

            lockId,
            tokenId,
            unlockTime,
            lockDuration,
            transactionDigest: result.digest,
        };
    } catch (error) {
        console.error("Error locking liquidity:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Extract lock ID from transaction events
 * @param {Object} result - Transaction result
 * @returns {string|null} - Lock ID
 */
function extractLockIdFromEvents(result) {
    try {
        if (!result.events || result.events.length === 0) {
            return null;
        }
        
        // Find the LiquidityLocked event
        const lockEvent = result.events.find(
            event => event.type.includes('::liquidity_locker::LiquidityLocked')
        );
        
        if (!lockEvent || !lockEvent.parsedJson) {
            return null;
        }
        
        return lockEvent.parsedJson.lock_id;
    } catch (error) {
        console.error("Error extracting lock ID:", error);
        return null;
    }
}

/**
 * Check if liquidity is locked for a token
 * @param {string} tokenId - Token ID
 * @returns {Promise<Object>} - Lock status
 */
async function checkLiquidityLock(tokenId) {
    try {
        // Get the liquidity locker ID
        const liquidityLockerId = process.env.LIQUIDITY_LOCKER_ID || config.contracts.liquidityLockerId;
        
        if (!liquidityLockerId) {
            throw new Error("Liquidity locker ID not configured");
        }
        
        // Query events from the locker to find locks for this token
        const events = await provider.queryEvents({
            query: {
                MoveEventType: `${config.contracts.packageId}::liquidity_locker::LiquidityLocked`,
            },
            limit: 100,
        });
        
        if (!events.data || events.data.length === 0) {
            return {
                success: true,
                isLocked: false,
                tokenId,
            };
        }
        
        // Find lock events for this token
        const tokenLockEvents = events.data.filter(
            event => event.parsedJson && event.parsedJson.token_id === tokenId
        );
        
        if (tokenLockEvents.length === 0) {
            return {
                success: true,
                isLocked: false,
                tokenId,
            };
        }
        
        // Check the most recent lock
        const latestLock = tokenLockEvents[0];
        const currentTime = Math.floor(Date.now() / 1000);
        const isLocked = currentTime < latestLock.parsedJson.unlock_time;
        
        return {
            success: true,
            isLocked,
            tokenId,
            lockId: latestLock.parsedJson.lock_id,
            locker: latestLock.parsedJson.locker,
            amount: latestLock.parsedJson.amount,
            unlockTime: latestLock.parsedJson.unlock_time,
            timeRemaining: isLocked ? latestLock.parsedJson.unlock_time - currentTime : 0,
        };
    } catch (error) {
        console.error("Error checking liquidity lock:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Unlock liquidity for a token if the lock period has passed
 * @param {string} lockId - Lock ID
 * @param {string} tokenId - Token ID for type argument
 * @returns {Promise<Object>} - Unlock result
 */
async function unlockLiquidity(lockId, tokenId) {
    try {
        console.log(`Unlocking liquidity for lock ${lockId}`);
        
        // Create signer using deployment key
        const deployerKey = process.env.DEPLOYER_PRIVATE_KEY || config.sui.deployerKey;
        const signer = createSigner(deployerKey);
        
        // Check if lock exists and is expired
        const lockCheck = await checkLiquidityLock(tokenId);
        
        if (!lockCheck.success) {
            throw new Error(`Failed to check lock status: ${lockCheck.error}`);
        }
        
        if (lockCheck.isLocked) {
            throw new Error(`Liquidity is still locked for ${lockCheck.timeRemaining} more seconds`);
        }
        
        // Get the liquidity locker ID
        const liquidityLockerId = process.env.LIQUIDITY_LOCKER_ID || config.contracts.liquidityLockerId;
        
        if (!liquidityLockerId) {
            throw new Error("Liquidity locker ID not configured");
        }
        
        // Find the pool ID for this token (simplified)
        const poolId = `${tokenId}::POOL`;
        
        // Create transaction block
        const tx = new TransactionBlock();
        
        // Call the unlock_liquidity function
        tx.moveCall({
            target: `${config.contracts.packageId}::liquidity_locker::unlock_liquidity`,
            arguments: [
                tx.object(liquidityLockerId),      // Locker object
                tx.object('0x6'),                  // Clock object
                tx.pure(lockId),                   // Lock ID
            ],
            typeArguments: [
                `${config.dex.cetusPackageId}::pool::LP<${poolId}>`, // LP token type
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
        
        console.log("Liquidity unlock result:", result);
        
        return {
            success: true,