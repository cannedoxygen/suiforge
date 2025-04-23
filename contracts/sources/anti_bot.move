module suiforge::anti_bot {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::clock::{Self, Clock};
    use sui::table::{Self, Table};
    use sui::event;
    use std::vector;
    
    // Errors
    const ETradingNotEnabled: u64 = 0;
    const EAddressAlreadyWhitelisted: u64 = 1;
    const EAddressNotWhitelisted: u64 = 2;
    const EExceedsMaxBuyLimit: u64 = 3;
    const EInsufficientCooldown: u64 = 4;
    const EAddressBlacklisted: u64 = 5;
    
    // Events
    struct TradingEnabled has copy, drop {
        token_id: address,
        timestamp: u64,
    }
    
    struct AddressWhitelisted has copy, drop {
        token_id: address,
        address: address,
    }
    
    struct AddressBlacklisted has copy, drop {
        token_id: address,
        address: address,
    }
    
    // Anti-bot settings per token
    struct TokenProtection has key {
        id: UID,
        token_id: address,
        owner: address,
        trading_enabled: bool,
        enable_time: u64,
        cooldown_period: u64,
        max_buy_percent: u64, // in basis points (10000 = 100%)
        whitelist: vector<address>,
        blacklist: Table<address, bool>,
        buy_tracking: Table<address, BuyInfo>,
    }
    
    // Tracking buys for each address
    struct BuyInfo has store {
        total_bought: u64,
        last_buy_time: u64,
    }
    
    // Create a new token protection
    public entry fun create_protection(
        token_id: address,
        cooldown_period: u64,
        max_buy_percent: u64,
        enable_time_delay: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Calculate when trading will be enabled
        let current_time = clock::timestamp_ms(clock) / 1000; // Convert to seconds
        let enable_time = current_time + enable_time_delay;
        
        // Create protection object
        let protection = TokenProtection {
            id: object::new(ctx),
            token_id,
            owner: tx_context::sender(ctx),
            trading_enabled: false,
            enable_time,
            cooldown_period,
            max_buy_percent,
            whitelist: vector::empty<address>(),
            blacklist: table::new(ctx),
            buy_tracking: table::new(ctx),
        };
        
        // Whitelist owner by default
        vector::push_back(&mut protection.whitelist, tx_context::sender(ctx));
        
        // Share the object
        transfer::share_object(protection);
    }
    
    // Check if an address is allowed to buy
    public fun check_can_buy(
        protection: &mut TokenProtection,
        buyer: address,
        amount: u64,
        total_supply: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): bool {
        // Whitelist can always buy
        if (is_whitelisted(protection, buyer)) {
            return true
        };
        
        // Check if blacklisted
        if (table::contains(&protection.blacklist, buyer)) {
            return false
        };
        
        // Check if trading is enabled
        let current_time = clock::timestamp_ms(clock) / 1000;
        
        if (!protection.trading_enabled && current_time >= protection.enable_time) {
            protection.trading_enabled = true;
            
            event::emit(TradingEnabled {
                token_id: protection.token_id,
                timestamp: current_time,
            });
        };
        
        assert!(protection.trading_enabled, ETradingNotEnabled);
        
        // Check buy limit
        let max_buy_amount = (total_supply * protection.max_buy_percent) / 10000;
        assert!(amount <= max_buy_amount, EExceedsMaxBuyLimit);
        
        // Check cooldown
        if (table::contains(&protection.buy_tracking, buyer)) {
            let buy_info = table::borrow_mut(&mut protection.buy_tracking, buyer);
            
            // Ensure cooldown period has passed
            assert!(
                (current_time - buy_info.last_buy_time) >= protection.cooldown_period,
                EInsufficientCooldown
            );
            
            // Update tracking
            buy_info.total_bought = buy_info.total_bought + amount;
            buy_info.last_buy_time = current_time;
        } else {
            // First buy for this address
            table::add(&mut protection.buy_tracking, buyer, BuyInfo {
                total_bought: amount,
                last_buy_time: current_time,
            });
        };
        
        true
    }
    
    // Add address to whitelist
    public entry fun add_to_whitelist(
        protection: &mut TokenProtection,
        address: address,
        ctx: &mut TxContext
    ) {
        // Only owner can modify whitelist
        assert!(protection.owner == tx_context::sender(ctx), 0);
        
        // Check if already whitelisted
        assert!(!is_whitelisted(protection, address), EAddressAlreadyWhitelisted);
        
        // Add to whitelist
        vector::push_back(&mut protection.whitelist, address);
        
        // Emit event
        event::emit(AddressWhitelisted {
            token_id: protection.token_id,
            address,
        });
    }
    
    // Remove address from whitelist
    public entry fun remove_from_whitelist(
        protection: &mut TokenProtection,
        address: address,
        ctx: &mut TxContext
    ) {
        // Only owner can modify whitelist
        assert!(protection.owner == tx_context::sender(ctx), 0);
        
        // Find and remove address
        let (exists, index) = vector::index_of(&protection.whitelist, &address);
        assert!(exists, EAddressNotWhitelisted);
        
        vector::remove(&mut protection.whitelist, index);
    }
    
    // Add address to blacklist
    public entry fun add_to_blacklist(
        protection: &mut TokenProtection,
        address: address,
        ctx: &mut TxContext
    ) {
        // Only owner can modify blacklist
        assert!(protection.owner == tx_context::sender(ctx), 0);
        
        // Add to blacklist
        table::add(&mut protection.blacklist, address, true);
        
        // Emit event
        event::emit(AddressBlacklisted {
            token_id: protection.token_id,
            address,
        });
    }
    
    // Remove address from blacklist
    public entry fun remove_from_blacklist(
        protection: &mut TokenProtection,
        address: address,
        ctx: &mut TxContext
    ) {
        // Only owner can modify blacklist
        assert!(protection.owner == tx_context::sender(ctx), 0);
        
        // Remove from blacklist
        assert!(table::contains(&protection.blacklist, address), EAddressNotWhitelisted);
        table::remove(&mut protection.blacklist, address);
    }
    
    // Check if address is whitelisted
    public fun is_whitelisted(protection: &TokenProtection, address: address): bool {
        vector::contains(&protection.whitelist, &address)
    }
    
    // Enable trading immediately
    public entry fun enable_trading(
        protection: &mut TokenProtection,
        ctx: &mut TxContext
    ) {
        // Only owner can enable trading
        assert!(protection.owner == tx_context::sender(ctx), 0);
        
        protection.trading_enabled = true;
        
        event::emit(TradingEnabled {
            token_id: protection.token_id,
            timestamp: tx_context::epoch_timestamp_ms(ctx) / 1000,
        });
    }
    
    // Update max buy percent
    public entry fun update_max_buy_percent(
        protection: &mut TokenProtection,
        new_percent: u64,
        ctx: &mut TxContext
    ) {
        // Only owner can update
        assert!(protection.owner == tx_context::sender(ctx), 0);
        
        protection.max_buy_percent = new_percent;
    }
    
    // Update cooldown period
    public entry fun update_cooldown_period(
        protection: &mut TokenProtection,
        new_period: u64,
        ctx: &mut TxContext
    ) {
        // Only owner can update
        assert!(protection.owner == tx_context::sender(ctx), 0);
        
        protection.cooldown_period = new_period;
    }
}