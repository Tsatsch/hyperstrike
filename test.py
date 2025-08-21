import asyncio
import json
import time
from collections import deque
from typing import Deque, Dict, List, Optional, Tuple

import aiohttp
import websockets

HYPER_WS = "wss://api.hyperliquid.xyz/ws"
HYPER_REST = "https://api.hyperliquid.xyz/info"
CANDLES_TO_FETCH_AT_START = 1000

Symbol = str
Interval = str

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
        return self._sum / self.window

class CandleMonitor:
    """
    Monitors one (symbol, interval) stream, keeps rolling SMA on closed candles,
    and calls a user hook on each closed candle.
    """
    def __init__(self, symbol: Symbol, interval: Interval, sma_windows: List[int]):
        self.symbol = symbol
        self.interval = interval
        self.sma = {w: RollingSMA(w) for w in sma_windows}
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
        async with session.post(HYPER_REST, json=body, timeout=15) as r:
            r.raise_for_status()
            data = await r.json()
            print(f"Fetched {len(data)} candles")

        # Sort and only consider truly closed (T <= now)
        data.sort(key=lambda c: c["T"])
        for c in data:
            if c["T"] <= self._now_ms():
                close_f = float(c["c"])
                for w, sma in self.sma.items():
                    sma.push(close_f)
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
            # Closed: push close price into SMA(s) once
            close_f = float(c["c"])
            smas = {}
            for w, sma in self.sma.items():
                smas[f"sma_{w}"] = sma.push(close_f)
            closed = dict(c)
            closed.update(smas)
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

        # keep the latest snapshot of the live candle
        self._latest_candle = candle
        # Attempt to finalize if it has crossed its end time
        return self._maybe_finalize_current()

    async def on_closed_candle(self, candle: dict) -> None:
        """
        >>> PLACE YOUR STRATEGY/ACTIONS HERE <<<
        `candle` includes keys:
          t, T, s, i, o, c, h, l, v, n, and any "sma_<window>" you've configured.
        This method is awaited for each closed candle.
        """
        # Example: act on SMA cross logic (toy)
        # close = float(candle["c"])
        # s5 = candle.get("sma_5"); s20 = candle.get("sma_20")
        # if s5 is not None and s20 is not None:
        #     if s5 > s20: ... BUY
        #     elif s5 < s20: ... SELL

        print(
            f"Closed {candle['s']} {candle['i']} "
            f"t=[{candle['t']}..{candle['T']}] close={candle['c']} "
            + " ".join(
                f"{k}={v:.4f}" for k, v in candle.items() if k.startswith("sma_") and v is not None
            )
        )

async def run_stream(
    symbol: Symbol = "BTC",
    interval: Interval = "1m",
    sma_windows: List[int] = [5, 20],
    history_lookback_ms: int = 24 * 60 * 60 * 1000,  # 24h
) -> None:
    monitor = CandleMonitor(symbol, interval, sma_windows)
    lookback_ms = CandleMonitor.interval_to_ms(interval)*CANDLES_TO_FETCH_AT_START
    # Use a single HTTP session for REST
    async with aiohttp.ClientSession() as session:
        # Seed enough candles to warm up the largest SMA
        await monitor.seed_history(session, lookback_ms)

    backoff = 1.0
    while True:
        try:
            async with websockets.connect(HYPER_WS, ping_interval=20, ping_timeout=20) as ws:
                sub = {
                    "method": "subscribe",
                    "subscription": {"type": "candle", "interval": interval, "coin": symbol},
                }
                await ws.send(json.dumps(sub))

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
            print(f"[WS] error: {type(e).__name__}: {e} — reconnecting soon...")
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 30.0)  # exponential backoff capped at 30s
        else:
            backoff = 1.0  # reset backoff on clean exit

if __name__ == "__main__":
    asyncio.run(run_stream(
        symbol="PURR",
        interval="1m",
        sma_windows=[50, 200],  # add/remove windows as you like
    ))
