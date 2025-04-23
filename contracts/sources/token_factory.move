module suiforge::token_factory {
    use sui::coin::{Self, Coin, CoinMetadata, TreasuryCap};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::object::{Self, UID};
    use sui::url::{Self, Url};
    use std::string::{Self, String};
    use sui::event;
    use sui::package;
    use sui::display;

    // Errors
    const EInvalidTokenName: u64 = 0;
    const EInvalidTokenSymbol: u64 = 1;
    const EInvalidSupply: u64 = 2;
    const EInvalidCreatorFee: u64 = 3;

    // Constants
    const PROTOCOL_FEE_BPS: u64 = 200; // 2% (20% of 10% total fee)
    const CREATOR_FEE_BPS: u64 = 800;  // 8% (80% of 10% total fee)
    const MAX_FEE_BPS: u64 = 1000;     // 10% maximum fee

    // Events
    struct TokenCreated has copy, drop {
        token_id: address,
        name: String,
        symbol: String,
        description: String,
        creator: address,
        max_supply: u64,
        initial_supply: u64,
    }

    // Platform administrator capability
    struct AdminCap has key { id: UID }

    // Factory capability for token creation
    struct Factory has key {
        id: UID,
        fee_recipient: address,
        tokens_created: u64,
    }

    // Initialize the module
    fun init(ctx: &mut TxContext) {
        // Create admin capability
        let admin_cap = AdminCap {
            id: object::new(ctx),
        };
        
        // Create factory
        let factory = Factory {
            id: object::new(ctx),
            fee_recipient: tx_context::sender(ctx),
            tokens_created: 0,
        };

        // Setup display for tokens
        let publisher = package::claim(ctx);
        
        let keys = vector[
            string::utf8(b"name"),
            string::utf8(b"symbol"),
            string::utf8(b"description"),
            string::utf8(b"image_url"),
        ];
        
        let values = vector[
            string::utf8(b"{name}"),
            string::utf8(b"{symbol}"),
            string::utf8(b"{description}"),
            string::utf8(b"{image_url}"),
        ];
        
        let display = display::new_with_fields<Factory>(
            &publisher, keys, values, ctx
        );
        
        display::update_version(&mut display);
        
        transfer::public_transfer(publisher, tx_context::sender(ctx));
        transfer::public_transfer(display, tx_context::sender(ctx));
        
        // Transfer capabilities to deployer
        transfer::transfer(admin_cap, tx_context::sender(ctx));
        transfer::share_object(factory);
    }

    // Create a new token with fixed supply
    public entry fun create_token(
        factory: &mut Factory,
        name: vector<u8>,
        symbol: vector<u8>,
        description: vector<u8>,
        image_url: vector<u8>,
        decimals: u8,
        max_supply: u64,
        initial_supply: u64,
        ctx: &mut TxContext
    ) {
        // Validate inputs
        let name_str = string::utf8(name);
        let symbol_str = string::utf8(symbol);
        let desc_str = string::utf8(description);
        
        assert!(string::length(&name_str) > 0, EInvalidTokenName);
        assert!(string::length(&symbol_str) > 0, EInvalidTokenSymbol);
        assert!(initial_supply <= max_supply, EInvalidSupply);
        
        // Create the coin
        let (treasury_cap, metadata) = coin::create_currency(
            name_str,
            symbol_str,
            decimals,
            some(url::new_unsafe_from_bytes(image_url)),
            some(desc_str),
            ctx
        );
        
        // Mint initial supply to creator
        if (initial_supply > 0) {
            let initial_coins = coin::mint(&mut treasury_cap, initial_supply, ctx);
            transfer::public_transfer(initial_coins, tx_context::sender(ctx));
        };
        
        // Set supply cap if specified
        if (max_supply > 0) {
            coin::set_supply(&mut treasury_cap, max_supply);
        };
        
        // Track tokens created
        factory.tokens_created = factory.tokens_created + 1;
        
        // Emit creation event
        event::emit(TokenCreated {
            token_id: object::id_address(&treasury_cap),
            name: name_str,
            symbol: symbol_str,
            description: desc_str,
            creator: tx_context::sender(ctx),
            max_supply,
            initial_supply,
        });
        
        // Transfer treasury cap to creator
        transfer::public_transfer(treasury_cap, tx_context::sender(ctx));
        transfer::public_transfer(metadata, tx_context::sender(ctx));
    }

    // Admin function to update fee recipient
    public entry fun update_fee_recipient(
        _: &AdminCap,
        factory: &mut Factory,
        new_recipient: address,
        ctx: &mut TxContext
    ) {
        factory.fee_recipient = new_recipient;
    }
}