# <img src="frontend/public/logo.svg" alt="Hypertick Logo" width="32" height="32" style="vertical-align: middle; margin-right: 12px;"> Hypertick

**Conditional Trading Platform for Hyperliquid**

Hypertick is a trading platform that enables conditional token swapping based on external signals, wallet activities, and market events. Built on Hyperliquid's infrastructure, it provides automated trading capabilities while maintaining full on-chain transparency.

## Overview & Vision

Hypertick extends beyond simple token swaps by offering sophisticated conditional trading features. Users can create orders that execute automatically when specific market conditions are met, enabling more strategic trading approaches on both HyperCore and HyperEVM.

### One Ecosystem, More Technical Trading

We recognized a gap in the level of control traders have while executing their strategies. Hyperliquid traders are highly experienced and deserve a platform that provides absolute control over their positions while leveraging macroeconomic indicators or individual token pair dynamics.

### Permissionless Security

We operate everything in a permissionless manner to maximize security and minimize exploitation risks. Unlike traditional platforms, we never ask users to deposit their funds into smart contracts. Users maintain complete freedom to use their funds until the moment their order is triggered, ensuring maximum capital efficiency and security.


## Features & Triggers

### Conditional Trading
- **OHLCV Triggers**: Execute trades based on price movements, volume, and technical indicators
- **Wallet Activity Monitoring**: Trigger trades when specific wallets make transactions
- **Time-Based Execution**: Schedule trades for specific times or intervals
- **Multi-Confirmation System**: Chain multiple conditions for enhanced accuracy

### Multi-Platform Support
- **HyperEVM**: Spot trading with GlueX integration
- **HyperCore**: Perpetual futures trading with leverage options
- **Unified Dashboard**: Manage positions across both platforms

### Trading Features
- **Multi-Token Outputs**: Split trades across up to 4 different tokens
- **Take Profit/Stop Loss**: Advanced risk management capabilities
- **Real-Time Monitoring**: Live order tracking and balance updates
- **Hyperliquid Names**: Track wallets with human-readable identifiers

### User Experience
- **XP System**: Earn experience points for platform engagement
- **Order Management**: Comprehensive tools for managing active orders
- **Performance Tracking**: Monitor trading history and execution details

## Tech Stack

### Frontend
- Next.js 14 with TS
- Tailwind CSS
- Shadcn/ui component library

### Backend
- FastAPI (Python)
- Supabase for database
- WebSocket integration for live market data

### Integrations
- **GlueX**: Token swapping on HyperEVM
- **Alchemy**: Blockchain data and RPC services
- **Privy**: Web3 wallet authentication
- **Hyperliquid**: Market data and trading execution

## Development

Start the development environment:

```bash
./start.sh
```

**Frontend**: http://localhost:3000  
**Backend**: http://localhost:8000

## Production

Start the production environment:

```bash
./start-prod.sh
```

**Frontend**: http://localhost:3000  
**Backend**: http://localhost:8000

---

*Built on Hyperliquid infrastructure with GlueX, Alchemy, and Privy integrations*
