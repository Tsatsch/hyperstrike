# OHLCV Triggers

OHLCV triggers execute trades based on price movements, volume changes, and technical indicators.

## OHLCV Data Sources

### Basic Price Data
- **open**: Opening price of each period
- **high**: Highest price during period
- **low**: Lowest price during period
- **close**: Closing price of each period
- **volume**: Trading volume during period

### Calculated Values
- **hl2**: (High + Low) ÷ 2
- **hlc3**: (High + Low + Close) ÷ 3
- **ohlc4**: (Open + High + Low + Close) ÷ 4

## Technical Indicators

### Moving Averages
- **SMA**: Simple Moving Average - average price over X periods
- **EMA**: Exponential Moving Average - weighted average favoring recent data

### Momentum Indicators
- **RSI**: Relative Strength Index - momentum indicator (0-100)

### Volatility Indicators
- **BB.upper**: Bollinger Bands upper line (SMA + standard deviation)
- **BB.mid**: Bollinger Bands middle line (SMA)
- **BB.lower**: Bollinger Bands lower line (SMA - standard deviation)

## Trigger Examples

### Price Breakout
```json
{
  "type": "ohlcv_trigger",
  "first_source": {
    "type": "close",
    "indicator": "SMA",
    "parameters": {"length": 20}
  },
  "trigger_when": "above",
  "second_source": {
    "type": "close"
  }
}
```

### Volume Spike
```json
{
  "type": "ohlcv_trigger",
  "first_source": {
    "type": "volume",
    "indicator": "SMA",
    "parameters": {"length": 10}
  },
  "trigger_when": "above",
  "second_source": {
    "type": "volume",
    "value": 2.0
  }
}
```

## Timeframes

Available timeframes for data analysis:
- 1 minute (1m)
- 5 minutes (5m)
- 15 minutes (15m)
- 1 hour (1h)
- 4 hours (4h)
- 1 day (1d)

## Next Steps

- [Wallet Activity Triggers](wallet-activity-triggers.md) - Wallet monitoring
- [Conditional Orders](conditional-orders.md) - Complete order setup
