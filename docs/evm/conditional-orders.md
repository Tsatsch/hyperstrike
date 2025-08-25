# Conditional Orders

Conditional orders are the core innovation of Hypertick, allowing you to automate trades based on specific market conditions.

## How Conditional Orders Work

### 1. Set Input & Outputs
Choose your input token and specify up to four output tokens with percentage allocations.

### 2. Set Condition
Define what event triggers your order execution.

### 3. Wait for Trigger
The system continuously monitors market conditions until your criteria are met.

### 4. Execute Trade
When conditions are satisfied, the trade executes automatically.

## Order Structure

```json
{
  "input_token": "HYPE",
  "input_amount": 100,
  "outputs": [
    {"token": "USDC", "percentage": 60},
    {"token": "BTC", "percentage": 40}
  ],
  "trigger": {
    "type": "ohlcv_trigger",
    "parameters": {...}
  }
}
```

## Order Lifetime

Set how long your conditional order should remain active:
- **1 hour**: Short-term strategies
- **1 day**: Daily trading patterns
- **1 week**: Weekly strategies
- **1 month**: Long-term positions

## Advanced Features

- **Cooldown Periods**: Prevent rapid re-triggering
- **Chained Confirmations**: Require multiple conditions
- **Invalidation Halt**: Stop orders when market conditions change

## Next Steps

- [OHLCV Triggers](ohlcv-triggers.md) - Price-based condition types
- [Wallet Activity Triggers](wallet-activity-triggers.md) - Wallet monitoring
