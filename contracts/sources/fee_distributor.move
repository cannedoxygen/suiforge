module suiforge::fee_distributor {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::sui::SUI;
    use sui::event;
    
    // Errors
    const EInvalidFeeShare: u64 = 0;
    const EInsufficientBalance: u64 = 1;
    
    // Events
    struct FeesCollected has copy, drop {
        amount: u64,
        token_id: address,
        timestamp: u64,
    }
    
    struct FeesDistributed has copy, drop {
        protocol_amount: u64,
        creator_amount: u64,
        token_id: address,
        creator: address,
        timestamp: u64,
    }
    
    // Fee Distributor Capability
    struct AdminCap has key { id: UID }
    
    // Fee Distributor object
    struct FeeDistributor has key {
        id: UID,
        protocol_fee_bps: u64,
        creator_fee_bps: u64,
        protocol_fee_recipient: address,
        protocol_balance: Balance<SUI>,
        total_fees_collected: u64,
    }
    
    // Token Fee Config
    struct TokenFeeConfig has key {
        id: UID,
        token_id: address,
        creator: address,
        creator_balance: Balance<SUI>,
        fees_collected: u64,
    }
    
    // Initialize the module
    fun init(ctx: &mut TxContext) {
        // Create admin capability
        let admin_cap = AdminCap {
            id: object::new(ctx),
        };
        
        // Create fee distributor with default 80/20 split
        let distributor = FeeDistributor {
            id: object::new(ctx),
            protocol_fee_bps: 200, // 20% of fees to protocol
            creator_fee_bps: 800,  // 80% of fees to creator
            protocol_fee_recipient: tx_context::sender(ctx),
            protocol_balance: balance::zero(),
            total_fees_collected: 0,
        };
        
        // Transfer capabilities to deployer
        transfer::transfer(admin_cap, tx_context::sender(ctx));
        transfer::share_object(distributor);
    }
    
    // Create a new token fee config
    public entry fun create_token_fee_config(
        token_id: address,
        creator: address,
        ctx: &mut TxContext
    ) {
        let config = TokenFeeConfig {
            id: object::new(ctx),
            token_id,
            creator,
            creator_balance: balance::zero(),
            fees_collected: 0,
        };
        
        transfer::share_object(config);
    }
    
    // Collect fees from trading
    public entry fun collect_fees(
        distributor: &mut FeeDistributor,
        config: &mut TokenFeeConfig,
        fee: Coin<SUI>,
        ctx: &mut TxContext
    ) {
        let fee_amount = coin::value(&fee);
        
        // Calculate fee splits
        let total_bps = distributor.protocol_fee_bps + distributor.creator_fee_bps;
        let protocol_amount = (fee_amount * distributor.protocol_fee_bps) / total_bps;
        let creator_amount = fee_amount - protocol_amount;
        
        // Split the fee
        let fee_balance = coin::into_balance(fee);
        
        // Add protocol portion to protocol balance
        let protocol_portion = balance::split(&mut fee_balance, protocol_amount);
        balance::join(&mut distributor.protocol_balance, protocol_portion);
        
        // Add creator portion to creator balance
        balance::join(&mut config.creator_balance, fee_balance);
        
        // Update counters
        distributor.total_fees_collected = distributor.total_fees_collected + fee_amount;
        config.fees_collected = config.fees_collected + fee_amount;
        
        // Emit event
        event::emit(FeesCollected {
            amount: fee_amount,
            token_id: config.token_id,
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });
    }
    
    // Withdraw protocol fees
    public entry fun withdraw_protocol_fees(
        _: &AdminCap,
        distributor: &mut FeeDistributor,
        ctx: &mut TxContext
    ) {
        let amount = balance::value(&distributor.protocol_balance);
        assert!(amount > 0, EInsufficientBalance);
        
        let fee_coin = coin::from_balance(
            balance::split(&mut distributor.protocol_balance, amount),
            ctx
        );
        
        transfer::public_transfer(fee_coin, distributor.protocol_fee_recipient);
    }
    
    // Withdraw creator fees
    public entry fun withdraw_creator_fees(
        config: &mut TokenFeeConfig,
        ctx: &mut TxContext
    ) {
        // Only creator can withdraw
        assert!(config.creator == tx_context::sender(ctx), 0);
        
        let amount = balance::value(&config.creator_balance);
        assert!(amount > 0, EInsufficientBalance);
        
        let fee_coin = coin::from_balance(
            balance::split(&mut config.creator_balance, amount),
            ctx
        );
        
        transfer::public_transfer(fee_coin, config.creator);
        
        // Emit event
        event::emit(FeesDistributed {
            protocol_amount: 0,
            creator_amount: amount,
            token_id: config.token_id,
            creator: config.creator,
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });
    }
    
    // Update fee distribution ratio
    public entry fun update_fee_distribution(
        _: &AdminCap,
        distributor: &mut FeeDistributor,
        protocol_fee_bps: u64,
        creator_fee_bps: u64,
    ) {
        // Validate fee share
        assert!(protocol_fee_bps + creator_fee_bps == 1000, EInvalidFeeShare);
        
        distributor.protocol_fee_bps = protocol_fee_bps;
        distributor.creator_fee_bps = creator_fee_bps;
    }
    
    // Update protocol fee recipient
    public entry fun update_protocol_fee_recipient(
        _: &AdminCap,
        distributor: &mut FeeDistributor,
        new_recipient: address,
    ) {
        distributor.protocol_fee_recipient = new_recipient;
    }
}