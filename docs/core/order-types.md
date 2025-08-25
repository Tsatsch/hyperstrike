# Order Types

Hypertick supports various order types for different trading strategies.

## Market Orders

Execute immediately at the current market price.

**Use when:**
- Speed is priority
- Price impact is acceptable
- Immediate execution needed

## Limit Orders

Execute only at specified price or better.

**Use when:**
- Specific price targets
- Cost control is important
- Patient execution strategy

## Stop Orders

Trigger when price reaches a specified threshold.

**Use when:**
- Risk management
- Breakout strategies
- Trend following

## Conditional Orders

Execute based on predefined market conditions.

**Use when:**
- Automated trading
- Complex strategies
- 24/7 monitoring needed

## Order Parameters

### Basic Settings
- **Token Pair**: Input and output tokens
- **Amount**: Trade size
- **Slippage**: Maximum acceptable price deviation

### Advanced Settings
- **Time in Force**: How long order remains active
- **Execution Type**: Market, limit, or conditional
- **Trigger Conditions**: For conditional orders

## Order States

- **Open**: Order is active and monitoring
- **Pending**: Conditions met, execution in progress
- **Completed**: Order successfully executed
- **Failed**: Order failed to execute
- **Cancelled**: Order manually cancelled

## Next Steps

- [Core Trading](core-trading.md) - Trading interface
- [Dashboard Overview](../dashboard/overview.md) - Order management
