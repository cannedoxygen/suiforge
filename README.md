# SuiForge: AI-Powered Token Launchpad on Sui

SuiForge is a zero-click token launchpad that enables anyone to create their own meme token on the Sui blockchain just by mentioning the bot on social media. The platform uses AI to parse requests, generate token descriptions and images, deploy smart contracts, and create liquidity pools automatically.

## Features

- **Zero-Click Token Creation**: Mention @SuiForge_AI on Twitter/X, Farcaster, or Telegram with your token idea
- **AI-Generated Content**: Automatically creates token descriptions, images, and memes
- **Smart Contract Deployment**: Secure Move contracts with anti-rug mechanisms
- **Automatic Liquidity**: Creates and locks liquidity pools on Sui DEXes
- **zkLogin Integration**: Non-crypto users can interact without needing a traditional wallet
- **Anti-Bot Protection**: Prevents instant sniping and common attack vectors

## Project Structure

```
├── backend/                  # Node.js backend
│   ├── config/               # Configuration files
│   ├── src/
│   │   ├── ai/               # AI processors and listeners
│   │   │   ├── deployer.js   # Deploy tokens from AI requests
│   │   │   ├── listeners/    # Social media listeners
│   │   │   └── processors/   # AI text and image processors
│   │   ├── api/              # API routes
│   │   ├── auth/             # Authentication with zkLogin
│   │   └── dex/              # DEX integrations (DeepBook, Cetus)
├── contracts/                # Sui Move smart contracts
│   └── sources/
│       ├── token_factory.move    # Token creation contract
│       ├── liquidity_locker.move # Locking liquidity for anti-rug
│       ├── anti_bot.move         # Anti-sniping mechanisms
│       └── fee_distributor.move  # Fee collection and distribution
├── frontend/                 # React.js frontend
│   └── src/
│       ├── components/       # React components
│       ├── pages/            # Page components
│       ├── hooks/            # Custom React hooks
│       └── utils/            # Utility functions
├── .github/                  # GitHub CI/CD workflows
│   └── workflows/
│       ├── deploy.yml        # Deployment workflow
│       └── test.yml          # Testing workflow
├── docker-compose.yml        # Docker configuration
├── package.json              # Project dependencies
└── README.md                 # This file
```

## Smart Contracts

SuiForge uses several Move smart contracts to ensure security and fair token distribution:

### Token Factory

Creates new tokens with customizable parameters and metadata. Features include:

- Fixed or unlimited supply options
- Metadata with name, symbol, description, and image URL
- Events for tracking token creation
- Connection to fee distribution system

### Liquidity Locker

Locks liquidity provider tokens for a specified time period to prevent rug pulls:

- Minimum 30-day lock by default
- Configurable lock duration
- Secure unlock mechanism that only works after the lock period
- Admin controls for adjusting parameters

### Anti-Bot Protection

Prevents common attacks from trading bots:

- Randomized launch delays
- Trading cooldowns
- Maximum buy limits
- Whitelist system for trusted addresses
- Blacklist system for malicious actors

### Fee Distributor

Handles fee collection and distribution:

- 1% total swap fee
- 80% to token creator
- 20% to protocol
- Secure withdrawal system

## Backend AI System

The backend system uses AI to process token creation requests from social media:

### Social Media Listeners

- `twitter.js`: Listens for mentions on Twitter/X
- `farcaster.js`: Listens for mentions on Farcaster
- `telegram.js`: Listens for messages in Telegram

### AI Processors

- `text_parser.js`: Extracts token parameters from messages
- `image_gen.js`: Generates token imagery using AI
- `description_gen.js`: Creates token descriptions and metadata

### Token Deployment

The `deployer.js` module handles the end-to-end process:

1. Parse social media message
2. Generate token metadata and images
3. Deploy smart contracts
4. Create liquidity pool
5. Lock liquidity
6. Send confirmation to the user

## Getting Started

### Prerequisites

- Node.js v16+
- Docker and Docker Compose
- Sui CLI and Sui Move
- OpenAI API key (for AI generation)
- Twitter/X, Farcaster, and Telegram API keys (for social listeners)

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/suiforge.git
   cd suiforge
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Set up environment variables
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and configuration
   ```

4. Compile and publish the smart contracts
   ```bash
   cd contracts
   sui move build
   sui client publish --gas-budget 100000000
   ```

5. Start the development environment
   ```bash
   docker-compose up -d
   ```

6. Run the backend server
   ```bash
   cd backend
   npm run dev
   ```

7. Run the frontend
   ```bash
   cd frontend
   npm run dev
   ```

## Development Roadmap

### Phase 1: Core Functionality
- [x] Smart contract development
- [x] Token creation API
- [x] Twitter bot integration
- [ ] Basic frontend interface

### Phase 2: Advanced Features
- [ ] Farcaster and Telegram integration
- [ ] Enhanced token meme generation
- [ ] zkLogin integration
- [ ] Advanced anti-bot measures

### Phase 3: Ecosystem Growth
- [ ] SuiForge governance token
- [ ] DAO for protocol management
- [ ] Multi-chain support
- [ ] Enhanced analytics and tracking

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Security

If you discover a security vulnerability, please send an email to security@suiforge.io instead of using the issue tracker.

## Contact

- Twitter: [@SuiForge_AI](https://twitter.com/SuiForge_AI)
- Email: info@suiforge.io
- <3 Canned Oxygen