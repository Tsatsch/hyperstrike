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
import os
import dotenv
dotenv.load_dotenv()
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from app.models.order import OhlcvTriggerData, OrderTriggeredRequest, UpdateOrderStateRequest, ActualOutput, OrderOut
import httpx





BACKEND_JWT = os.getenv("BACKEND_JWT")
spot_mappings = json.load(open("app/utils/name_coin_mapping.json"))

# from app.services.trigger_processor import TriggerProcessor

HYPER_WS = "wss://api.hyperliquid.xyz/ws"
HYPER_REST = "https://api.hyperliquid.xyz/info"
CANDLES_TO_FETCH_AT_START = 500


logging.basicConfig(
    level=logging.INFO,  # show INFO and above
    format="%(asctime)s %(levelname)s %(name)s:%(lineno)d - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],  # -> stdout; omit to keep stderr
    force=True,  # overwrite any prior config (handy in notebooks/frameworks)
)
logger = logging.getLogger(__name__)

# Global trigger processor instance
# trigger_processor = TriggerProcessor()
class RuntimeTrigger:
    def __init__(self, trigger: OhlcvTriggerData):
        self.trigger = trigger
        self.last_fired_T: Optional[int] = None
        self.consecutive_hits: int = 0


active_triggers: Dict[Tuple[str, str], List[RuntimeTrigger]] = {}
active_subscriptions: Dict[Tuple[str, str], bool] = {}

def get_coin_for_hyperliquid_pair(symbol: str) -> str:
    if '-' in symbol:
        # Perp pairs are formatted as "coin-USDC"
        coin = symbol[:symbol.find('-')]
        #print(f"Perp pair: {coin}")
        return coin
    else:
        # Spot pairs are formatted as "coin/USDC" or "coin/USDT"
        parts = symbol.split('/')
        if len(parts) != 2:
            return symbol  # Return original if format is unexpected
            
        coin = parts[0]
        quote = parts[1]
        
        #print(f"Spot pair: {coin}/{quote}")
        
        if quote == 'USDC':
            # For USDC pairs, prefer unique mapping or name_1
            if coin in spot_mappings:
                return spot_mappings[coin]
            elif f"{coin}_1" in spot_mappings:
                return spot_mappings[f"{coin}_1"]
            else:
                return coin  # Fallback to original coin name
                
        elif quote == 'USDT':
            # For USDT pairs, always use name_2
            if f"{coin}_2" in spot_mappings:
                return spot_mappings[f"{coin}_2"]
            else:
                return coin  # Fallback if name_2 doesn't exist
        else:
            # For other quote currencies, use original logic
            return spot_mappings.get(coin, coin)



class RollingSMA:
    """O(1) rolling SMA using a deque and running sum."""
    def __init__(self, window: int, source: str = "close"):
        if window <= 0:
            raise ValueError("SMA window must be > 0")
        if source not in ["open", "high", "low", "close", "hl2", "hlc3", "ohlc4"]:
            raise ValueError("source must be one of: open, high, low, close, hl2, hlc3, ohlc4")
        self.window = window
        self.source = source
        self.values: Deque[float] = deque(maxlen=window)
        self._sum: float = 0.0

    def _get_source_value(self, candle: dict) -> float:
        """Extract the appropriate value from candle based on source."""
        if self.source == "open":
            return float(candle.get("o", candle.get("open", 0)))
        elif self.source == "high":
            return float(candle.get("h", candle.get("high", 0)))
        elif self.source == "low":
            return float(candle.get("l", candle.get("low", 0)))
        elif self.source == "close":
            return float(candle.get("c", candle.get("close", 0)))
        elif self.source == "hl2":
            high = float(candle.get("h", candle.get("high", 0)))
            low = float(candle.get("l", candle.get("low", 0)))
            return (high + low) / 2
        elif self.source == "hlc3":
            high = float(candle.get("h", candle.get("high", 0)))
            low = float(candle.get("l", candle.get("low", 0)))
            close = float(candle.get("c", candle.get("close", 0)))
            return (high + low + close) / 3
        elif self.source == "ohlc4":
            open_val = float(candle.get("o", candle.get("open", 0)))
            high = float(candle.get("h", candle.get("high", 0)))
            low = float(candle.get("l", candle.get("low", 0)))
            close = float(candle.get("c", candle.get("close", 0)))
            return (open_val + high + low + close) / 4
        else:
            return float(candle.get("c", candle.get("close", 0)))

    def push(self, candle: dict) -> Optional[float]:
        x = self._get_source_value(candle)
        if len(self.values) == self.window:
            self._sum -= self.values[0]
        self.values.append(x)
        self._sum += x
        if len(self.values) < self.window:
            return None
        return self._sum / len(self.values)

class RollingRSI:
    def __init__(self, window: int = 14, source: str = "close"):
        if source not in ["open", "high", "low", "close", "hl2", "hlc3", "ohlc4"]:
            raise ValueError("source must be one of: open, high, low, close, hl2, hlc3, ohlc4")
        self.window = window
        self.source = source
        self.prev_value: Optional[float] = None
        self.gains: List[float] = []  
        self.losses: List[float] = []  
        self.avg_gain: Optional[float] = None
        self.avg_loss: Optional[float] = None

    def _get_source_value(self, candle: dict) -> float:
        """Extract the appropriate value from candle based on source."""
        if self.source == "open":
            return float(candle.get("o", candle.get("open", 0)))
        elif self.source == "high":
            return float(candle.get("h", candle.get("high", 0)))
        elif self.source == "low":
            return float(candle.get("l", candle.get("low", 0)))
        elif self.source == "close":
            return float(candle.get("c", candle.get("close", 0)))
        elif self.source == "hl2":
            high = float(candle.get("h", candle.get("high", 0)))
            low = float(candle.get("l", candle.get("low", 0)))
            return (high + low) / 2
        elif self.source == "hlc3":
            high = float(candle.get("h", candle.get("high", 0)))
            low = float(candle.get("l", candle.get("low", 0)))
            close = float(candle.get("c", candle.get("close", 0)))
            return (high + low + close) / 3
        elif self.source == "ohlc4":
            open_val = float(candle.get("o", candle.get("open", 0)))
            high = float(candle.get("h", candle.get("high", 0)))
            low = float(candle.get("l", candle.get("low", 0)))
            close = float(candle.get("c", candle.get("close", 0)))
            return (open_val + high + low + close) / 4
        else:
            return float(candle.get("c", candle.get("close", 0)))

    def push(self, candle: dict) -> Optional[float]:
        value = self._get_source_value(candle)
        if self.prev_value is None:
            self.prev_value = value
            return None

        change = value - self.prev_value
        gain = max(change, 0.0)
        loss = -min(change, 0.0)

        if len(self.gains) < self.window:
            self.gains.append(gain)
            self.losses.append(loss)
            self.prev_value = value
            
            if len(self.gains) == self.window:
                self.avg_gain = sum(self.gains) / self.window
                self.avg_loss = sum(self.losses) / self.window
            return None
        else:
            self.avg_gain = (self.avg_gain * (self.window - 1) + gain) / self.window
            self.avg_loss = (self.avg_loss * (self.window - 1) + loss) / self.window

        self.prev_value = value

        if self.avg_loss == 0:
            return 100.0
        rs = self.avg_gain / self.avg_loss
        return 100.0 - (100.0 / (1.0 + rs))

class RollingBollinger:
    """
    O(1) rolling Bollinger Bands over N closes using SMA and different OHLC sources.
    Returns (mid, upper, lower) where:
      mid   = SMA(N) of selected OHLC source
      upper = SMA + k * std
      lower = SMA - k * std
    """
    def __init__(self, length: int, k: float = 2.0, source: str = "close"):
        if length <= 1:
            raise ValueError("Bollinger length must be > 1")
        if source not in ["open", "high", "low", "close", "hl2", "hlc3", "ohlc4"]:
            raise ValueError("source must be one of: open, high, low, close, hl2, hlc3, ohlc4")
        
        self.length = length
        self.k = k
        self.source = source
        
        self.values: Deque[float] = deque(maxlen=length)
        self._sum = 0.0
        self._sumsq = 0.0

    def _get_source_value(self, candle: dict) -> float:
        """Extract the appropriate value from candle based on source."""
        if self.source == "open":
            return float(candle.get("o", candle.get("open", 0)))
        elif self.source == "high":
            return float(candle.get("h", candle.get("high", 0)))
        elif self.source == "low":
            return float(candle.get("l", candle.get("low", 0)))
        elif self.source == "close":
            return float(candle.get("c", candle.get("close", 0)))
        elif self.source == "hl2":
            high = float(candle.get("h", candle.get("high", 0)))
            low = float(candle.get("l", candle.get("low", 0)))
            return (high + low) / 2
        elif self.source == "hlc3":
            high = float(candle.get("h", candle.get("high", 0)))
            low = float(candle.get("l", candle.get("low", 0)))
            close = float(candle.get("c", candle.get("close", 0)))
            return (high + low + close) / 3
        elif self.source == "ohlc4":
            open_val = float(candle.get("o", candle.get("open", 0)))
            high = float(candle.get("h", candle.get("high", 0)))
            low = float(candle.get("l", candle.get("low", 0)))
            close = float(candle.get("c", candle.get("close", 0)))
            return (open_val + high + low + close) / 4
        else:
            return float(candle.get("c", candle.get("close", 0)))

    def push(self, candle: dict) -> Optional[Tuple[float, float, float]]:
        """Push a candle and return (mid, upper, lower) bands."""
        x = self._get_source_value(candle)
        
        if len(self.values) == self.length:
            oldest = self.values[0]
            self._sum -= oldest
            self._sumsq -= oldest * oldest

        self.values.append(x)
        self._sum += x
        self._sumsq += x * x

        n = len(self.values)
        if n < self.length:
            return None

        mean = self._sum / n
        variance = (self._sumsq / n) - (mean * mean)
        std = math.sqrt(max(variance, 0.0)) 
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
    def __init__(self, window: int, source: str = "close"):
        if window <= 0:
            raise ValueError("EMA window must be > 0")
        if source not in ["open", "high", "low", "close", "hl2", "hlc3", "ohlc4"]:
            raise ValueError("source must be one of: open, high, low, close, hl2, hlc3, ohlc4")
        self.window = window
        self.source = source
        self.alpha = 2.0 / (window + 1)
        self._ema: Optional[float] = None

    def _get_source_value(self, candle: dict) -> float:
        """Extract the appropriate value from candle based on source."""
        if self.source == "open":
            return float(candle.get("o", candle.get("open", 0)))
        elif self.source == "high":
            return float(candle.get("h", candle.get("high", 0)))
        elif self.source == "low":
            return float(candle.get("l", candle.get("low", 0)))
        elif self.source == "close":
            return float(candle.get("c", candle.get("close", 0)))
        elif self.source == "hl2":
            high = float(candle.get("h", candle.get("high", 0)))
            low = float(candle.get("l", candle.get("low", 0)))
            return (high + low) / 2
        elif self.source == "hlc3":
            high = float(candle.get("h", candle.get("high", 0)))
            low = float(candle.get("l", candle.get("low", 0)))
            close = float(candle.get("c", candle.get("close", 0)))
            return (high + low + close) / 3
        elif self.source == "ohlc4":
            open_val = float(candle.get("o", candle.get("open", 0)))
            high = float(candle.get("h", candle.get("high", 0)))
            low = float(candle.get("l", candle.get("low", 0)))
            close = float(candle.get("c", candle.get("close", 0)))
            return (open_val + high + low + close) / 4
        else:
            return float(candle.get("c", candle.get("close", 0)))

    def push(self, candle: dict) -> float:
        x = self._get_source_value(candle)
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
    def __init__(self, order: OrderOut, symbol: str, interval: str, sma_config: List[Tuple[int, str]], rsi_config: List[Tuple[int, str]], bollinger_cfg: List[Tuple[int, float, str, str]], ema_config: List[Tuple[int, str]]):
        self.order = order
        self.symbol = symbol
        self.interval = interval
        # SMA config: (window, source) where source can be "close", "hl2", "hlc3", "ohlc4", etc.
        self.sma = {w: RollingSMA(w, source) for w, source in (sma_config or [])}
        # RSI config: (window, source) where source can be "close", "hl2", "hlc3", "ohlc4", etc.
        self.rsi = {w: RollingRSI(w, source) for w, source in (rsi_config or [])}
        # Bollinger Bands: (length, k_multiplier, source)
        # When any band is selected, all three (upper, mid, lower) are automatically set
        self.bbands = {(length, k, source): RollingBollinger(length, k, source) for length, k, source in (bollinger_cfg or [])}
        # EMA config: (window, source) where source can be "close", "hl2", "hlc3", "ohlc4", etc.
        self.ema = {w: RollingEMA(w, source) for w, source in (ema_config or [])}
        self.last_processed_T: int = 0  # end time (ms) of last processed candle
        self._latest_candle: Optional[dict] = None  # most recent WS snapshot for current (open) candle

    @staticmethod
    def _now_ms() -> int:
        return int(time.time() * 1000)

    async def seed_history(self, session: aiohttp.ClientSession, lookback_ms: int) -> None:
        print(f"Trying to seed history for {self.symbol}/{self.interval}")
        """Seed with enough history to warm up SMA windows."""
        
        end_ms = self._now_ms()
        start_ms = end_ms - lookback_ms
        # print(f"Start time: {start_ms}, End time: {end_ms}")
        # print(f"Lookback: {lookback_ms}")

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
                for w, sma in self.sma.items():
                    sma.push(c)
                volume = float(c.get("v", 0))
                low_f = float(c.get("l", 0))
                high_f = float(c.get("h", 0))
                close_f = float(c["c"])
                tp = (close_f + low_f + high_f) / 3
                for w, rsi in self.rsi.items():
                    rsi.push(c)
                for (length, k, source), bb in self.bbands.items():
                    bb.push(c) # Pass the entire candle to the Bollinger Bands
                for w, ema in self.ema.items():
                    ema.push(c)
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
                smas[f"sma_{w}_{sma.source}"] = sma.push(c)
            low_f = float(c.get("l", 0))
            high_f = float(c.get("h", 0))
            tp = (close_f + low_f + high_f) / 3
            rsis = {}
            for w, rsi in self.rsi.items():
                rsis[f"rsi_{w}_{rsi.source}"] = rsi.push(c)
            bbands = {}
            for (length, k, source), bb in self.bbands.items():
                res = bb.push(c) # Pass the entire candle to the Bollinger Bands
                if res is not None:
                    mid, upper, lower = res
                    bbands[f"bb_{length}_{k}_{source}_mid"] = mid
                    bbands[f"bb_{length}_{k}_{source}_upper"] = upper
                    bbands[f"bb_{length}_{k}_{source}_lower"] = lower
            emas = {}
            for w, ema in self.ema.items():
                emas[f"ema_{w}_{ema.source}"] = ema.push(c)
            closed = dict(c)    
            closed.update(smas)
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
            key = (self.symbol, self.interval)
            triggers = active_triggers.get(key, [])
            print(f"Triggers: {triggers}")
            print(f"Candle: {candle}")
            for rt in triggers[:]:  # iterate over copy since we may remove
                trig = rt.trigger

                lhs = resolve_source_value(trig.first_source.model_dump(), candle)
                rhs = resolve_source_value(trig.second_source.model_dump(), candle)
                if lhs is None or rhs is None:
                    continue

                fired = (
                    (trig.trigger_when == "above" and lhs > rhs)
                    or (trig.trigger_when == "below" and lhs < rhs)
                )

                #1. Invalidation
                if trig.invalidation_halt.active:
                    opposite = (
                        (trig.trigger_when == "above" and lhs < rhs)
                        or (trig.trigger_when == "below" and lhs > rhs)
                    )
                    if opposite:
                        logger.info(f"❌ Invalidation hit for {trig}")
                        active_triggers[key].remove(rt)
                        # TODO: update state in DB if needed
                        continue

                #2. Chained confirmation (consecutive hits)
                if fired:
                    rt.consecutive_hits += 1
                else:
                    rt.consecutive_hits = 0

                if trig.chained_confirmation.active:
                    required = trig.chained_confirmation.value
                    if rt.consecutive_hits < required:
                        continue  # not enough consecutive bars

                #3. Cooldown
                interval_ms = CandleMonitor.interval_to_ms(self.interval)
                if fired and cooldown_ok(rt, trig, int(candle["T"]), interval_ms):
                    rt.last_fired_T = int(candle["T"])
                    logger.info(
                        f"🔥 Trigger fired for {trig.pair} {trig.timeframe}: "
                        f"{lhs} {trig.trigger_when} {rhs}"
                    )
                    
                    # TODO: action: swap, update db
                    triggered_order = OrderTriggeredRequest(
                        order_id=self.order.id,
                        input_value_usd=100, #to change later
                        triggered_price=float(candle["c"]), # to change later
                        actual_outputs=[] #to change later
                    )
                    await order_triggered(triggered_order, key, rt)
                    # await notify_trigger(trig, candle)

                #print out the current info of the source1 and source2
                else:
                    logger.info(f"Still monitoring: {lhs} {trig.trigger_when} {rhs} to be triggered")

        except Exception as e:
            logger.error(f"Error processing closed candle: {e}")

async def order_triggered(triggered_order: OrderTriggeredRequest, key: Tuple[str, str], rt: RuntimeTrigger):
    active_triggers[key].remove(rt)
    async with httpx.AsyncClient() as client:
        await client.post(f"{os.getenv('BACKEND_URL')}/api/order/triggered", json=triggered_order.model_dump(), headers={"Authorization": f"Bearer {BACKEND_JWT}"})
    
    





async def register_ohlcv_trigger(order: OrderOut):
    trigger = order.order_data.ohlcv_trigger
    coin = get_coin_for_hyperliquid_pair(trigger.pair)
    key = (coin, trigger.timeframe)
    rt = RuntimeTrigger(trigger)
    active_triggers.setdefault(key, []).append(rt)
    await ensure_subscription(order)


async def ensure_subscription(order: OrderOut) -> None:
    """Ensure we have an active subscription for a symbol/interval pair"""
    symbol = order.order_data.ohlcv_trigger.pair
    interval = order.order_data.ohlcv_trigger.timeframe
    if "-" in symbol or "/" in symbol:
        symbol = get_coin_for_hyperliquid_pair(symbol)
    key = (symbol, interval)
    if key not in active_subscriptions:
        active_subscriptions[key] = True
        logger.info(f"Starting subscription for {symbol}/{interval}")
        # Start monitoring in background
        source_config = resolve_source_config(order)
        asyncio.create_task(run_stream(order, symbol, interval, source_config["sma_config"], source_config["rsi_config"], source_config["bollinger_cfg"], source_config["ema_config"]))

async def maybe_unsubscribe(symbol: str, interval: str) -> None:
    """Unsubscribe from a symbol/interval if no more triggers need it"""
    key = (symbol, interval)
    if key in active_subscriptions:


        logger.info(f"Keeping subscription for {symbol}/{interval} (orders may still need it)")



def cooldown_ok(rt: RuntimeTrigger, trig: OhlcvTriggerData, candle_T: int, interval_ms: int) -> bool:
    if not trig.cooldown.active:
        return True
    if not rt.last_fired_T:
        return True
    bars_since = (candle_T - rt.last_fired_T) // interval_ms
    return bars_since >= trig.cooldown.value


def resolve_source_config(order: OrderOut) -> Optional[float]:
    #return source indicator name and parameters to pass to run_stream
    #returns sma_config, rsi_config, bollinger_cfg, ema_config
    order_data = order.order_data
    config = {
        "sma_config": [],
        "rsi_config": [],
        "bollinger_cfg": [],
        "ema_config": []
    }
    if order_data.type == "ohlcv_trigger":
        trigger = order_data.ohlcv_trigger
        if trigger.first_source.type == "indicators":
            if trigger.first_source.indicator == "sma":
                config["sma_config"].append((trigger.first_source.parameters.length, trigger.first_source.parameters.OHLC_source))
            elif trigger.first_source.indicator == "ema":
                config["ema_config"].append((trigger.first_source.parameters.length, trigger.first_source.parameters.OHLC_source))
            elif trigger.first_source.indicator == "rsi":
                config["rsi_config"].append((trigger.first_source.parameters.length, trigger.first_source.parameters.OHLC_source))
            elif trigger.first_source.indicator == "bb_upper":
                config["bollinger_cfg"].append((trigger.first_source.parameters.length, trigger.first_source.parameters.std_dev, trigger.first_source.parameters.OHLC_source))
            elif trigger.first_source.indicator == "bb_lower":
                config["bollinger_cfg"].append((trigger.first_source.parameters.length, trigger.first_source.parameters.std_dev, trigger.first_source.parameters.OHLC_source))
            elif trigger.first_source.indicator == "bb_mid":
                config["bollinger_cfg"].append((trigger.first_source.parameters.length, trigger.first_source.parameters.std_dev, trigger.first_source.parameters.OHLC_source))
        return config
            


    
def resolve_source_value(source: dict, candle: dict) -> Optional[float]:
    stype = source["type"]
    if stype == "value":
        return float(source["value"])
    if stype == "OHLCV":
        return float(candle.get(source["source"][:1]))  
    if stype == "indicators":
        ind = source["indicator"].lower()
        params = source.get("parameters", {})
        length = params.get("length")
        OHLC_source = params.get("OHLC_source", "close")
        std_dev = params.get("std_dev", None)
        if ind == "sma":
            return candle.get(f"sma_{length}_{OHLC_source}")
        elif ind == "ema":
            return candle.get(f"ema_{length}_{OHLC_source}")
        elif ind == "rsi":
            return candle.get(f"rsi_{length}_{OHLC_source}")
        elif ind == "bb_upper":
            return candle.get(f"bb_{length}_{float(std_dev)}_{OHLC_source}_upper")
        elif ind == "bb_lower":
            return candle.get(f"bb_{length}_{float(std_dev)}_{OHLC_source}_lower")
        elif ind == "bb_mid":
            return candle.get(f"bb_{length}_{float(std_dev)}_{OHLC_source}_mid")
    return None










async def run_stream(
    order: OrderOut,
    symbol: str = "BTC",
    interval: str = "1m",
    sma_config: List[Tuple[int, str]] = [(5, "close"), (20, "close")],
    rsi_config: List[Tuple[int, str]] = [(14, "close"), (21, "close")],  
    bollinger_cfg: List[Tuple[int, float, str]] = [(20, 2.0, "close"), (50, 2.0, "close")],  #add/remove windows as you like
    # Bollinger Bands config: (length, k_multiplier, source)
    # source can be "open", "high", "low", "close", "hl2", "hlc3", "ohlc4"
    # Examples:
    # - (20, 2.0, "close") = 20-period BB with k=2.0 using close prices
    # - (50, 2.5, "hlc3") = 50-period BB with k=2.5 using (high+low+close)/3
    ema_config: List[Tuple[int, str]] = [(50, "close"), (200, "close")],  #add/remove windows as you like
) -> None:

    monitor = CandleMonitor(order, symbol, interval, sma_config, rsi_config, bollinger_cfg, ema_config)
    lookback_ms = CandleMonitor.interval_to_ms(interval)*CANDLES_TO_FETCH_AT_START
    
    logger.info(f"Starting stream for {symbol}/{interval}")
    
    
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
                    "subscription": {"type": "candle", "interval": interval, "coin": symbol},
                }
                await ws.send(json.dumps(sub))
                logger.info(f"Subscribed to {symbol}/{interval}")

                
                async def finalizer():
                    while True:
                        closed = monitor._maybe_finalize_current()
                        if closed:
                            await monitor.on_closed_candle(closed)
                        await asyncio.sleep(0.5)  

                finalizer_task = asyncio.create_task(finalizer())

                async for raw in ws:
                    closed = await monitor.handle_ws_message(raw)
                    if closed:
                        await monitor.on_closed_candle(closed)

        except Exception as e:
            logger.error(f"[WS] error for {symbol}/{interval}: {type(e).__name__}: {e} — reconnecting soon...")
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 30.0)  
        else:
            backoff = 1.0  

if __name__ == "__main__":
    # asyncio.run(run_stream(
    #     symbol="BTC",
    #     interval="1m",
    #     sma_config=[(50, "close"), (200, "close")],  # add/remove windows as you like

    #     rsi_config=[(14, "close"), (21, "close")],  #add/remove windows as you like
    #     bollinger_cfg=[(20, 2.0, "close"), (50, 2.0, "close")],  # Example: 20-period BB and 50-period BB
    #     ema_config=[(50, "close"), (200, "close")],  #add/remove windows as you like
    # ))

    print(get_coin_for_hyperliquid_pair("UBTC/USDC"))
    print(get_coin_for_hyperliquid_pair("BTC-USDC"))
    print(get_coin_for_hyperliquid_pair("UBTC/USDT"))
    print(get_coin_for_hyperliquid_pair("HYPE/USDC"))
    print(get_coin_for_hyperliquid_pair("HYPE/USDT"))
    print(get_coin_for_hyperliquid_pair("XAUT0/USDT"))