# Wallet Activity Triggers

Execute trades based on specific wallet transactions or activity patterns.

## Overview

Wallet activity triggers monitor specific addresses for transactions and execute trades when certain conditions are met.

## Use Cases

- **Whale Tracking**: Follow large traders' movements
- **Smart Money**: React to institutional trading activity
- **Social Trading**: Mirror successful traders' strategies
- **Arbitrage**: Execute trades when specific wallets make moves

## Trigger Types

### Transaction Volume
Monitor wallets for trades above specific thresholds.

### Token Swaps
Track when monitored wallets swap specific tokens.

### Time-based Activity
Execute trades based on wallet activity patterns.

## Configuration

```json
{
  "type": "wallet_activity",
  "wallet_address": "0x123...",
  "activity_type": "swap",
  "min_amount": 1000,
  "token": "HYPE"
}
```

## Example Strategy

**"When wallet 0x123... makes a trade above $1000, buy HYPE"**

This creates a conditional order that:
1. Monitors the specified wallet address
2. Detects when they make trades above the threshold
3. Automatically executes your HYPE purchase

## Privacy Considerations

- Only public blockchain data is monitored
- No private wallet information is accessed
- All monitoring is transparent and verifiable

## Next Steps

- [Conditional Orders](conditional-orders.md) - Complete order setup
- [Dashboard Overview](../dashboard/overview.md) - Monitor your orders
