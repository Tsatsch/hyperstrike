# Trigger System Implementation

This document describes how the automated order triggering system works in the backend.

## Overview

The trigger system automatically executes orders when their specified conditions are met. It monitors real-time market data from Hyperliquid and processes orders in real-time when trigger conditions are satisfied.

## Architecture

### 1. **Candle Watcher Service** (`candle_watcher.py`)
- Connects to Hyperliquid WebSocket API
- Monitors real-time price data for subscribed symbols/timeframes
- Processes closed candles and triggers order evaluation

### 2. **Trigger Processor** (`trigger_processor.py`)
- Evaluates trigger conditions against candle data
- Executes orders when conditions are met
- Updates order states in the database
- **Handles order expiration** - marks orders as closed when timeframe runs out

### 3. **Startup Service** (`startup_service.py`)
- Automatically subscribes to required market data on startup
- Scans existing open orders to determine required subscriptions
- **Primary expiration mechanism** - runs every 30 seconds to close expired orders

### 4. **Orders Service** (`orders.py`)
- Automatically subscribes to market data when new orders are created
- Manages order lifecycle and state updates

## How It Works

### 1. **Order Creation**
When a user creates an order:
1. Order is saved to database with state "open"
2. System automatically subscribes to market data for the order's symbol/timeframe
3. If subscription doesn't exist, a new WebSocket connection is established

### 2. **Market Data Monitoring**
- WebSocket connections monitor real-time price data
- When a candle closes, the system processes it
- Each closed candle triggers order evaluation

### 3. **Trigger Evaluation**
For each open order matching the symbol/timeframe:
1. **Check if order has expired** (backend handles this, not frontend)
2. If expired, mark as "closed" with "time ran out" message
3. If valid, extract trigger conditions (source, trigger type, threshold)
4. Compare current market data against conditions
5. If conditions are met, execute the order

### 4. **Order Execution**
When a trigger condition is met:
1. Order state is updated to "done"
2. Execution details are logged
3. User is awarded XP (1% of input USD value)

### 5. **Order Expiration (Backend-Controlled)**
- **Backend runs expiration check every 30 seconds**
- Orders are automatically closed when their timeframe expires
- No dependency on frontend being open
- Immediate expiration within 30 seconds of timeout

## Trigger Types Supported

### OHLCV Triggers
- **Source**: `open`, `high`, `low`, `close`, `volume`, `trades`
- **Conditions**: `above`, `below`, `equals`
- **Timeframes**: `1m`, `3m`, `5m`, `15m`, `30m`, `1h`, `2h`, `4h`, `6h`, `12h`, `1d`

### Example Triggers
```json
{
  "type": "ohlcvTrigger",
  "ohlcvTrigger": {
    "pair": "BTC",
    "timeframe": "5m",
    "source": "close",
    "trigger": "above",
    "triggerValue": "50000",
    "lifetime": "24h"
  }
}
```

## Understanding Timeframe vs Lifetime

### **Timeframe** (Candle Interval)
- **Purpose**: How often to check for trigger conditions
- **Examples**: `1m`, `5m`, `15m`, `1h`, `1d`
- **Logic**: When a candle of this interval closes, evaluate all orders with this timeframe

### **Lifetime** (Order Duration)
- **Purpose**: How long the order should stay active
- **Examples**: `1h`, `24h`, `7d`, `30d`
- **Logic**: Order expires after this duration, regardless of trigger conditions

### **Example Scenarios**
1. **Order with 5m timeframe, 24h lifetime**:
   - Check for triggers every 5 minutes when 5m candle closes
   - Order expires after 24 hours if not triggered

2. **Order with 1h timeframe, 7d lifetime**:
   - Check for triggers every hour when 1h candle closes  
   - Order expires after 7 days if not triggered

3. **Order with 1m timeframe, 1h lifetime**:
   - Check for triggers every minute when 1m candle closes
   - Order expires after 1 hour if not triggered

## Performance Characteristics

### **Frequency**
- **Candle Processing**: As fast as candles close (1m, 5m, etc.)
- **Order Evaluation**: Every closed candle
- **Order Expiration**: Every 30 seconds (backend-controlled)
- **WebSocket Updates**: Real-time (multiple times per second)

### **Scalability**
- Each symbol/timeframe combination runs in its own async task
- Orders are processed in batches per candle
- Database queries are optimized for trigger evaluation
- Expiration checking is centralized and efficient

## Configuration

### Environment Variables
- `NEXT_PUBLIC_GLUEX_API_KEY`: For swap execution
- `NEXT_ETH_RPC_URL`: Blockchain RPC endpoint
- `PRIVATE_KEY`: For smart contract interactions

### Logging
- All trigger activities are logged with appropriate levels
- Failed executions are logged with error details
- Performance metrics are tracked
- Expiration events are logged with timing details

## Testing

Run the test script to verify the system:
```bash
cd backend
poetry run python test_triggers.py
```

## Monitoring

### Logs to Watch
- `Starting subscription for {symbol}/{timeframe}`
- `Processing candle for {symbol}/{interval}`
- `Order {id} trigger condition met, executing...`
- `Order {id} executed successfully`
- `Closed expired order {id} (created: X, expired: Y, current: Z)`

### Health Checks
- WebSocket connection status
- Order processing latency
- Failed execution rates
- Expiration processing status

## Frontend Integration

### **Important Note**: Frontend expiration logic is now redundant
- The backend handles all order expiration automatically
- Frontend can still show countdown timers for user experience
- But actual expiration is handled by backend every 30 seconds
- This ensures orders are expired even if frontend is closed

## Future Enhancements

1. **Smart Contract Integration**: Direct calls to `withdrawOnTrigger`
2. **Advanced Triggers**: SMA crosses, RSI, MACD
3. **Risk Management**: Position sizing, stop losses
4. **Performance Optimization**: Database indexing, caching
5. **Multi-Exchange Support**: Beyond Hyperliquid

## Troubleshooting

### Common Issues
1. **WebSocket Disconnections**: Automatic reconnection with exponential backoff
2. **Database Errors**: Logged with full context for debugging
3. **Order Execution Failures**: Orders marked as failed with reason
4. **Expiration Issues**: Check backend logs for cleanup task status

### Debug Mode
Enable detailed logging by setting log level to DEBUG in `main.py`

## Security Considerations

- Orders are validated against user ownership
- Smart contract calls require proper authorization
- All operations are logged for audit trails
- Rate limiting prevents abuse
- Expiration is handled securely by backend
