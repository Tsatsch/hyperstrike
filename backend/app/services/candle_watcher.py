import asyncio
import json
import random
import time
from collections import deque
from typing import Deque, Dict, List, Optional, Tuple
import logging
import sys
import aiohttp
import websockets
import math


# from app.services.trigger_processor import TriggerProcessor

HYPER_WS = "wss://api.hyperliquid.xyz/ws"
HYPER_REST = "https://api.hyperliquid.xyz/info"
CANDLES_TO_FETCH_AT_START = 1000

Symbol = str
Interval = str


logging.basicConfig(
    level=logging.INFO,  # show INFO and above
    format="%(asctime)s %(levelname)s %(name)s:%(lineno)d - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],  # -> stdout; omit to keep stderr
    force=True,  # overwrite any prior config (handy in notebooks/frameworks)
)
logger = logging.getLogger(__name__)

# Global trigger processor instance
# trigger_processor = TriggerProcessor()


active_subscriptions: Dict[Tuple[Symbol, Interval], bool] = {}

def canonicalize_symbol(symbol: str) -> str:
    """Map internal symbols to Hyperliquid coin names.
    Examples:
    - UBTC -> BTC
    - UETH -> ETH
    Currently strips a single leading 'U' if present.
    """
    if not symbol:
        return symbol
    if symbol.upper().startswith("U") and len(symbol) > 1:
        return symbol.upper()[1:]
    return symbol.upper()

class RollingSMA:
    """O(1) rolling SMA using a deque and running sum."""
    def __init__(self, window: int):
        if window <= 0:
            raise ValueError("SMA window must be > 0")
        self.window = window
        self.values: Deque[float] = deque(maxlen=window)
        self._sum: float = 0.0

    def push(self, x: float) -> Optional[float]:
        if len(self.values) == self.window:
            self._sum -= self.values[0]
        self.values.append(x)
        self._sum += x
        if len(self.values) < self.window:
            return None
        return self._sum / len(self.values)
class RollingVWAP:
    """O(1) rolling VWAP over N candles using deques for pv and vol."""
    def __init__(self, window: int):
        if window <= 0:
            raise ValueError("VWAP window must be > 0")
        self.window = window
        self._pv = deque(maxlen=window)   # stores TP*V
        self._vol = deque(maxlen=window)  # stores V
        self._sum_pv = 0.0
        self._sum_vol = 0.0

    def push(self, tp: float, vol: float) -> float:
        # remove oldest contributions if at capacity
        if len(self._pv) == self.window:
            self._sum_pv -= self._pv[0]
            self._sum_vol -= self._vol[0]
        pv = tp * vol
        self._pv.append(pv)
        self._vol.append(vol)
        self._sum_pv += pv
        self._sum_vol += vol
        return (self._sum_pv / self._sum_vol) if self._sum_vol > 0 else float("nan")
class RollingRSI:
    def __init__(self, window: int = 14):
        self.window = window
        self.prev_close: Optional[float] = None
        self.gains: List[float] = []  # Collect first window of gains
        self.losses: List[float] = []  # Collect first window of losses
        self.avg_gain: Optional[float] = None
        self.avg_loss: Optional[float] = None

    def push(self, close: float) -> Optional[float]:
        if self.prev_close is None:
            self.prev_close = close
            return None

        change = close - self.prev_close
        gain = max(change, 0.0)
        loss = -min(change, 0.0)

        if len(self.gains) < self.window:

            self.gains.append(gain)
            self.losses.append(loss)
            self.prev_close = close
            
            if len(self.gains) == self.window:

                self.avg_gain = sum(self.gains) / self.window
                self.avg_loss = sum(self.losses) / self.window
                
            return None
        else:
            # Use Wilder's smoothing
            self.avg_gain = (self.avg_gain * (self.window - 1) + gain) / self.window
            self.avg_loss = (self.avg_loss * (self.window - 1) + loss) / self.window

        self.prev_close = close

        if self.avg_loss == 0:
            return 100.0
        rs = self.avg_gain / self.avg_loss
        return 100.0 - (100.0 / (1.0 + rs))

class RollingBollinger:
    """
    O(1) rolling Bollinger Bands over N closes using running sum and sumsq.
    Returns (mid, upper, lower) where:
      mid   = SMA(N)
      upper = SMA + k * std
      lower = SMA - k * std
    """
    def __init__(self, window: int, k: float = 2.0):
        if window <= 1:
            raise ValueError("Bollinger window must be > 1")
        self.window = window
        self.k = k
        self.values: Deque[float] = deque(maxlen=window)
        self._sum = 0.0
        self._sumsq = 0.0

    def push(self, x: float) -> Optional[Tuple[float, float, float]]:
        # remove oldest if at capacity
        if len(self.values) == self.window:
            oldest = self.values[0]
            self._sum -= oldest
            self._sumsq -= oldest * oldest

        self.values.append(x)
        self._sum += x
        self._sumsq += x * x

        n = len(self.values)
        if n < self.window:
            return None

        mean = self._sum / n
        # Numerical guard
        variance = max((self._sumsq / n) - (mean * mean), 0.0)
        std = math.sqrt(variance)
        upper = mean + self.k * std
        lower = mean - self.k * std
        return (mean, upper, lower)
from typing import Optional

class RollingEMA:
    """
    O(1) rolling Exponential Moving Average (EMA).
    Keeps only last EMA value, no full window.
    Formula: EMA_t = α * price_t + (1 - α) * EMA_{t-1}
    where α = 2 / (window + 1)
    """
    def __init__(self, window: int):
        if window <= 0:
            raise ValueError("EMA window must be > 0")
        self.window = window
        self.alpha = 2.0 / (window + 1)
        self._ema: Optional[float] = None

    def push(self, x: float) -> float:
        if self._ema is None:
            # seed with first value
            self._ema = x
        else:
            self._ema = self.alpha * x + (1 - self.alpha) * self._ema
        return self._ema


class CandleMonitor:
    """
    Monitors one (symbol, interval) stream, keeps rolling SMA on closed candles,
    and calls a user hook on each closed candle.
    """
    def __init__(self, symbol: Symbol, interval: Interval, sma_windows: List[int], vwap_windows: List[int], rsi_windows: List[int], bollinger_cfg: List[Tuple[int, float]], ema_windows: List[int]):
        self.symbol = symbol
        self.interval = interval
        self.sma = {w: RollingSMA(w) for w in sma_windows}
        self.vwap = {w: RollingVWAP(w) for w in (vwap_windows or [])}
        self.rsi = {w: RollingRSI(w) for w in (rsi_windows or [])}
        self.bbands = {(w, k): RollingBollinger(w, k) for w, k in (bollinger_cfg or [])}
        self.ema = {w: RollingEMA(w) for w in (ema_windows or [])}
        self.last_processed_T: int = 0  # end time (ms) of last processed candle
        self._latest_candle: Optional[dict] = None  # most recent WS snapshot for current (open) candle

    @staticmethod
    def _now_ms() -> int:
        return int(time.time() * 1000)

    async def seed_history(self, session: aiohttp.ClientSession, lookback_ms: int) -> None:
        """Seed with enough history to warm up SMA windows."""
        end_ms = self._now_ms()
        start_ms = end_ms - lookback_ms

        body = {
            "type": "candleSnapshot",
            "req": {
                "coin": self.symbol,
                "interval": self.interval,
                "startTime": start_ms,
                "endTime": end_ms,
            },
        }

        max_attempts = 5
        base_backoff_seconds = 1.0
        data = []
        for attempt in range(1, max_attempts + 1):
            try:
                async with session.post(HYPER_REST, json=body, timeout=15) as r:
                    r.raise_for_status()
                    data = await r.json()
                    logger.info(f"Fetched {len(data)} candles for {self.symbol}/{self.interval}")
                    break
            except aiohttp.ClientResponseError as e:
                # Retry on 5xx and 429; otherwise, consider it fatal for seeding
                if e.status and (500 <= e.status < 600 or e.status == 429):
                    jitter = random.uniform(0, 0.5)
                    wait = min(base_backoff_seconds * (2 ** (attempt - 1)) + jitter, 30.0)
                    logger.warning(
                        f"Seed history attempt {attempt}/{max_attempts} failed with {e.status}. "
                        f"Retrying in {wait:.1f}s for {self.symbol}/{self.interval}"
                    )
                    await asyncio.sleep(wait)
                    continue
                logger.error(
                    f"Seed history failed with non-retriable status {e.status} for {self.symbol}/{self.interval}: {e}"
                )
                break
            except (aiohttp.ClientConnectorError, aiohttp.ServerDisconnectedError, asyncio.TimeoutError) as e:
                jitter = random.uniform(0, 0.5)
                wait = min(base_backoff_seconds * (2 ** (attempt - 1)) + jitter, 30.0)
                logger.warning(
                    f"Seed history attempt {attempt}/{max_attempts} encountered {type(e).__name__}: {e}. "
                    f"Retrying in {wait:.1f}s for {self.symbol}/{self.interval}"
                )
                await asyncio.sleep(wait)
                continue
            except Exception as e:
                logger.error(f"Seed history failed for {self.symbol}/{self.interval}: {e}")
                break

        # Sort and only consider truly closed (T <= now)
        data.sort(key=lambda c: c["T"])
        for c in data:
            if c["T"] <= self._now_ms():
                close_f = float(c["c"])
                for w, sma in self.sma.items():
                    sma.push(close_f)
                volume = float(c.get("v", 0))
                low_f = float(c.get("l", 0))
                high_f = float(c.get("h", 0))
                tp = (close_f + low_f + high_f) / 3
                for w, vwap in self.vwap.items():
                    vwap.push(tp, volume)
                for w, rsi in self.rsi.items():
                    rsi.push(close_f)
                for w, bb in self.bbands.items():
                    bb.push(close_f)
                for w, ema in self.ema.items():
                    ema.push(close_f)
                self.last_processed_T = max(self.last_processed_T, int(c["T"]))

    def _maybe_finalize_current(self) -> Optional[dict]:
        """
        If the currently tracked candle is closed (based on time, not a flag),
        finalize it and return the closed candle dict (with SMAs included).
        """
        if not self._latest_candle:
            return None

        c = self._latest_candle
        T = int(c["T"])
        if self._now_ms() >= T and T > self.last_processed_T:

            close_f = float(c["c"])
            smas = {}
            for w, sma in self.sma.items():
                smas[f"sma_{w}"] = sma.push(close_f)
            vwaps = {}
            volume = float(c.get("v", 0))
            low_f = float(c.get("l", 0))
            high_f = float(c.get("h", 0))
            tp = (close_f + low_f + high_f) / 3
            for w, vwap in self.vwap.items():
                vwaps[f"vwap_{w}"] = vwap.push(tp, volume)
            rsis = {}
            for w, rsi in self.rsi.items():
                rsis[f"rsi_{w}"] = rsi.push(close_f)
            bbands = {}
            for (w, k), bb in self.bbands.items():
                res = bb.push(close_f)
                if res is not None:
                    mid, upper, lower = res
                    bbands[f"bb_{w}_{k}_mid"] = mid
                    bbands[f"bb_{w}_{k}_upper"] = upper
                    bbands[f"bb_{w}_{k}_lower"] = lower
            emas = {}
            for w, ema in self.ema.items():
                emas[f"ema_{w}"] = ema.push(close_f)
            closed = dict(c)    
            closed.update(smas)
            closed.update(vwaps)
            closed.update(rsis)
            closed.update(bbands)
            closed.update(emas)
            self.last_processed_T = T
            return closed
        return None

    @staticmethod
    def interval_to_ms(interval: str) -> int:
            table = {
                "1m": 60_000,
                "3m": 3 * 60_000,
                "5m": 5 * 60_000,
                "15m": 15 * 60_000,
                "30m": 30 * 60_000,
                "1h": 60 * 60_000,
                "2h": 2 * 60 * 60_000,
                "4h": 4 * 60 * 60_000,
                "6h": 6 * 60 * 60_000,
                "12h": 12 * 60 * 60_000,
                "1d": 24 * 60 * 60_000,
            }
            if interval not in table:
                raise ValueError(f"Unsupported interval: {interval}")
            return table[interval]

    async def handle_ws_message(self, msg: str) -> Optional[dict]:
        """Handle a WS message; return a closed candle if one just finalized."""
        try:
            payload = json.loads(msg)
        except json.JSONDecodeError:
            return None

        if payload.get("channel") != "candle":
            return None

        candle = payload.get("data")
        if not isinstance(candle, dict):
            return None


        self._latest_candle = candle

        return self._maybe_finalize_current()

    async def on_closed_candle(self, candle: dict) -> None:
        """
        Process closed candle and check for triggered orders
        """
        try:
            logger.info(
                f"Closed {candle['s']} {candle['i']} "
                f"t=[{candle['t']}..{candle['T']}] close={candle['c']} "
                + " ".join(
                    f"{k}={v:.4f}" for k, v in candle.items() if k.startswith("sma_") or k.startswith("vwap_") or k.startswith("rsi_") or k.startswith("bb_") or k.startswith("ema_") and v is not None
                )
            )
           
            
            # Process triggers for this candle
            #await trigger_processor.process_candle(self.symbol, self.interval, candle)
            
        except Exception as e:
            logger.error(f"Error processing closed candle: {e}")

async def ensure_subscription(symbol: Symbol, interval: Interval) -> None:
    """Ensure we have an active subscription for a symbol/interval pair"""

    canonical_symbol = canonicalize_symbol(symbol)
    key = (canonical_symbol, interval)
    if key not in active_subscriptions:
        active_subscriptions[key] = True
        if canonical_symbol != symbol:
            logger.info(f"Starting subscription for {symbol}/{interval} as {canonical_symbol}")
        else:
            logger.info(f"Starting subscription for {symbol}/{interval}")
        # Start monitoring in background
        asyncio.create_task(run_stream(canonical_symbol, interval))

async def maybe_unsubscribe(symbol: Symbol, interval: Interval) -> None:
    """Unsubscribe from a symbol/interval if no more triggers need it"""
    key = (symbol, interval)
    if key in active_subscriptions:


        logger.info(f"Keeping subscription for {symbol}/{interval} (orders may still need it)")

async def run_stream(
    symbol: Symbol = "BTC",
    interval: Interval = "1m",
    sma_windows: List[int] = [5, 20],
    history_lookback_ms: int = 24 * 60 * 60 * 1000,  # 24h
    vwap_windows: List[int] = [210, 400],  
    rsi_windows: List[int] = [14, 21],  
    bollinger_cfg: List[Tuple[int, float]] = [(20, 2.0), (50, 2.0)],  #add/remove windows as you like
    ema_windows: List[int] = [50, 200],  #add/remove windows as you like
) -> None:
    # Ensure symbol is canonical for HL
    canonical_symbol = canonicalize_symbol(symbol)
    if canonical_symbol != symbol:
        logger.info(f"Using canonical symbol {canonical_symbol} for {symbol}/{interval}")
    monitor = CandleMonitor(canonical_symbol, interval, sma_windows, vwap_windows, rsi_windows, bollinger_cfg)
    lookback_ms = CandleMonitor.interval_to_ms(interval)*CANDLES_TO_FETCH_AT_START
    
    logger.info(f"Starting stream for {canonical_symbol}/{interval}")
    
    # Use a single HTTP session for REST
    async with aiohttp.ClientSession() as session:

        try:
            await monitor.seed_history(session, lookback_ms)
        except Exception as e:

            logger.error(
                f"Seeding history failed for {symbol}/{interval}; continuing without seed: {type(e).__name__}: {e}"
            )

    backoff = 1.0
    while True:
        try:
            async with websockets.connect(HYPER_WS, ping_interval=20, ping_timeout=20) as ws:
                sub = {
                    "method": "subscribe",
                    "subscription": {"type": "candle", "interval": interval, "coin": canonical_symbol},
                }
                await ws.send(json.dumps(sub))
                logger.info(f"Subscribed to {canonical_symbol}/{interval}")

                # After subscribing, try finalizing the last open candle periodically
                async def finalizer():
                    while True:
                        closed = monitor._maybe_finalize_current()
                        if closed:
                            await monitor.on_closed_candle(closed)
                        await asyncio.sleep(0.5)  # lightweight watchdog

                finalizer_task = asyncio.create_task(finalizer())

                async for raw in ws:
                    closed = await monitor.handle_ws_message(raw)
                    if closed:
                        await monitor.on_closed_candle(closed)

        except Exception as e:
            logger.error(f"[WS] error for {canonical_symbol}/{interval}: {type(e).__name__}: {e} — reconnecting soon...")
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 30.0)  # exponential backoff capped at 30s
        else:
            backoff = 1.0  # reset backoff on clean exit

if __name__ == "__main__":
    asyncio.run(run_stream(
        symbol="BTC",
        interval="1m",
        sma_windows=[50, 200],  # add/remove windows as you like
        vwap_windows=[210, 400],  #dd/remove windows as you like
        rsi_windows=[14, 21],  #add/remove windows as you like
        bollinger_cfg=[(20, 2.0), (50, 2.0)],  #add/remove windows as you like
        ema_windows=[50, 200],  #add/remove windows as you like
    ))
