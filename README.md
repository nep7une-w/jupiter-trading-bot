# Jupiter Trading Bot

A flexible and robust trading bot for Solana, built on top of Jupiter Aggregator. This bot allows for automated token trading with features like buying, selling, and position management.

## Features

- **Automated Trading**: Buy and sell tokens on Solana automatically
- **Jupiter Integration**: Uses Jupiter Aggregator for best price execution
- **Configurable Parameters**: Adjust slippage, amount, priority fees, and more
- **Retry Mechanisms**: Built-in retry logic for transaction failures
- **Position Management**: Automatically manage token positions with buy/sell flows
- **New Token Mode**: Special handling for new token launches with adjusted parameters

## Project Structure

```
jupiter-trading-bot/
├── src/                        # Source code
│   ├── index.ts                # Entry point
│   ├── trader.ts               # Core trading logic
│   ├── utils/                  # Utility functions
│   │   ├── api.ts              # API wrapper for Jupiter
│   │   ├── config.ts           # Configuration management
│   │   ├── helpers.ts          # Helper functions
│   │   ├── slippage.ts         # Slippage calculation
│   │   ├── swap.ts             # Swap execution logic
│   │   ├── tokens.ts           # Token management utilities
│   │   ├── transactionSender.ts # Transaction execution
│   │   ├── getSignature.ts     # Transaction signature utilities
│   │   └── wait.ts             # Wait/delay utilities
├── .env.example                # Example environment variables
├── package.json                # Dependencies and scripts
├── tsconfig.json               # TypeScript configuration
└── README.md                   # Project documentation
```

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/jupiter-trading-bot.git
cd jupiter-trading-bot
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file based on `.env.example` and fill in your configuration:
```bash
cp .env.example .env
# Edit .env with your preferred text editor
```

## Configuration

The bot is configured through environment variables in the `.env` file:

| Variable | Description | Default |
|----------|-------------|---------|
| `PRIVATE_KEY` | Your wallet private key in base58 format | - |
| `RPC_ENDPOINT` | Solana RPC endpoint URL | https://api.mainnet-beta.solana.com |
| `BUY_AMOUNT_SOL` | Amount of SOL to use for buying tokens | - |
| `SLIPPAGE_BPS` | Base slippage in basis points (1 bps = 0.01%) | 100 |
| `PRIORITY_FEE_LAMPORTS` | Priority fee in lamports | 10000000 |
| `PRIORITY_LEVEL` | Priority level (low/medium/high/veryHigh) | veryHigh |
| `SELL_DELAY_SECONDS` | Delay in seconds before selling after buying | 60 |
| `NEW_TOKEN_MODE` | Enable special parameters for new tokens | false |
| `BASE_SLIPPAGE_BPS` | Base slippage in basis points | 200 |
| `NEW_TOKEN_SLIPPAGE_MULTIPLIER` | Multiplier for slippage when in new token mode | 5 |

## Usage

### Simple Trading Example

```typescript
import { buyAndSellFlow } from './src/trader';

// Buy and sell a specific token
buyAndSellFlow("TOKEN_MINT_ADDRESS")
  .then(() => console.log("Trading completed"))
  .catch(console.error);
```

### Manual Buy and Sell

```typescript
import { buy, sell } from './src/trader';

// Buy a token
buy("TOKEN_MINT_ADDRESS")
  .then(txId => console.log("Buy transaction:", txId))
  .catch(console.error);

// After some time, sell the token
sell("TOKEN_MINT_ADDRESS", tokenAmount)
  .then(txId => console.log("Sell transaction:", txId))
  .catch(console.error);
```

## Development

1. Build the project:
```bash
npm run build
```

2. Run with ts-node:
```bash
npx ts-node src/index.ts
```

## Security Considerations

- Never commit your `.env` file or expose your private key
- Consider using a dedicated wallet for bot operations
- Start with small amounts until you're comfortable with the system
- Monitor transactions regularly

## License

MIT

## Disclaimer

This software is for educational purposes only. Use at your own risk. Trading cryptocurrencies involves significant risk and can result in the loss of your invested capital. You should not use this software with funds you cannot afford to lose. 