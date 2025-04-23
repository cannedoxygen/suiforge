module suiforge::liquidity_locker {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::clock::{Self, Clock};
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::table::{Self, Table};
    use std::string::{Self, String};
    use sui::event;
    
    // Errors
    const ELockStillActive: u64 = 0;
    const EInvalidLockDuration: u64 = 1;
    const EInvalidLock: u64 = 2;
    const ELockNotFound: u64 = 3;
    
    // Events
    struct LiquidityLocked has copy, drop {
        lock_id: address,
        token_id: address,
        locker: address,
        amount: u64,
        unlock_time: u64,
    }
    
    struct LiquidityUnlocked has copy, drop {
        lock_id: address,
        token_id: address,
        locker: address,
        amount: u64,
    }
    
    // Capability for managing the locker
    struct AdminCap has key { id: UID }
    
    // Shared locker object
    struct LiquidityLocker has key {
        id: UID,
        locks: Table<address, Lock>,
        min_lock_duration: u64, // In seconds
        lock_count: u64,
    }
    
    // Individual lock info
    struct Lock has store {
        token_balance: Balance<Coin<ExampleTOKEN>>, 
        token_type: address,
        locker: address,
        unlock_time: u64,
    }
    
    // Dummy type for example only
    struct ExampleTOKEN has drop {}
    
    // Initialize the module
    fun init(ctx: &mut TxContext) {
        // Create admin capability
        let admin_cap = AdminCap {
            id: object::new(ctx),
        };
        
        // Create locker with 30 days minimum lock
        let locker = LiquidityLocker {
            id: object::new(ctx),
            locks: table::new(ctx),
            min_lock_duration: 30 * 24 * 60 * 60, // 30 days in seconds
            lock_count: 0,
        };
        
        // Transfer capabilities to deployer
        transfer::transfer(admin_cap, tx_context::sender(ctx));
        transfer::share_object(locker);
    }
    
    // Lock liquidity tokens
    public entry fun lock_liquidity<CoinType>(
        locker: &mut LiquidityLocker,
        clock: &Clock,
        lp_tokens: Coin<CoinType>,
        lock_duration: u64,
        ctx: &mut TxContext
    ) {
        // Validate lock duration
        assert!(lock_duration >= locker.min_lock_duration, EInvalidLockDuration);
        
        // Calculate unlock time
        let current_time = clock::timestamp_ms(clock) / 1000; // Convert to seconds
        let unlock_time = current_time + lock_duration;
        
        // Create the lock
        let amount = coin::value(&lp_tokens);
        let token_type = coin::type_into_address<CoinType>();
        let token_balance = coin::into_balance(lp_tokens);
        
        let lock = Lock {
            token_balance,
            token_type,
            locker: tx_context::sender(ctx),
            unlock_time,
        };
        
        // Generate unique lock ID
        let lock_id = object::new(ctx);
        let lock_addr = object::uid_to_address(&lock_id);
        object::delete(lock_id);
        
        // Store lock
        table::add(&mut locker.locks, lock_addr, lock);
        locker.lock_count = locker.lock_count + 1;
        
        // Emit event
        event::emit(LiquidityLocked {
            lock_id: lock_addr,
            token_id: token_type,
            locker: tx_context::sender(ctx),
            amount,
            unlock_time,
        });
    }
    
    // Unlock liquidity once the lock period is over
    public entry fun unlock_liquidity<CoinType>(
        locker: &mut LiquidityLocker,
        clock: &Clock,
        lock_id: address,
        ctx: &mut TxContext
    ) {
        // Check if lock exists
        assert!(table::contains(&locker.locks, lock_id), ELockNotFound);
        
        // Get lock info
        let lock = table::remove(&mut locker.locks, lock_id);
        let Lock { token_balance, token_type, locker: lock_owner, unlock_time } = lock;
        
        // Verify lock ownership
        assert!(lock_owner == tx_context::sender(ctx), EInvalidLock);
        
        // Check if lock duration has passed
        let current_time = clock::timestamp_ms(clock) / 1000; // Convert to seconds
        assert!(current_time >= unlock_time, ELockStillActive);
        
        // Return tokens to locker
        let returned_tokens = coin::from_balance(token_balance, ctx);
        transfer::public_transfer(returned_tokens, lock_owner);
        
        // Emit event
        event::emit(LiquidityUnlocked {
            lock_id,
            token_id: token_type,
            locker: lock_owner,
            amount: coin::value(&returned_tokens),
        });
    }
    
    // Admin can update minimum lock duration
    public entry fun update_min_lock_duration(
        _: &AdminCap,
        locker: &mut LiquidityLocker,
        new_duration: u64,
    ) {
        locker.min_lock_duration = new_duration;
    }
    
    // Get lock info
    public fun get_lock_info(
        locker: &LiquidityLocker,
        lock_id: address
    ): (address, address, u64, u64) {
        assert!(table::contains(&locker.locks, lock_id), ELockNotFound);
        
        let lock = table::borrow(&locker.locks, lock_id);
        
        (
            lock.token_type,
            lock.locker,
            balance::value(&lock.token_balance),
            lock.unlock_time
        )
    }
}