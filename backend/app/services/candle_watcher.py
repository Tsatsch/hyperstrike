import asyncio
import websockets
import json
from datetime import datetime, timezone
from typing import Dict, Tuple

from app.services.triggers import get_triggers_for, delete_trigger_db
from app.utils.notifications import send_telegram

HYPERLIQUID_WS_URL = "wss://api.hyperliquid.xyz/ws"

# Runtime state
latest_candle_ts: Dict[Tuple[str, str], int] = {}
last_closed_candle: Dict[Tuple[str, str], dict] = {}

# Socket task tracking
active_ws_tasks: Dict[Tuple[str, str], asyncio.Task] = {}
ws_task_locks = asyncio.Lock()

# 🟢 Called when a trigger is registered
async def ensure_subscription(symbol: str, interval: str):
    key = (symbol, interval)
    async with ws_task_locks:
        if key in active_ws_tasks:
            return
        print(f"🧩 Launching WS for {symbol} {interval}")
        task = asyncio.create_task(watch_candle_stream(symbol, interval))
        active_ws_tasks[key] = task

# 🔴 Called after triggers are removed
async def maybe_unsubscribe(symbol: str, interval: str):
    key = (symbol, interval)
    async with ws_task_locks:
        if key not in active_ws_tasks:
            return

        triggers = get_triggers_for(symbol, interval)
        if not triggers:
            print(f"🧹 No DB triggers left for {key}. Cancelling socket.")
            task = active_ws_tasks.pop(key)
            task.cancel()

# 🔁 Main WebSocket stream loop
async def watch_candle_stream(symbol: str, interval: str):
    try:
        async with websockets.connect(HYPERLIQUID_WS_URL) as ws:
            await ws.send(json.dumps({
                "method": "subscribe",
                "subscription": {
                    "type": "candle",
                    "coin": symbol,
                    "interval": interval
                }
            }))
            print(f"✅ Subscribed to {symbol} {interval}")

            while True:
                msg = await ws.recv()
                data = json.loads(msg)
                if data.get("channel") == "candle":
                    await handle_candle(data["data"])

    except asyncio.CancelledError:
        print(f"🛑 WS for {symbol} {interval} was cancelled.")
    except Exception as e:
        print(f"❌ Error in WS {symbol} {interval}: {e}")
    finally:
        async with ws_task_locks:
            active_ws_tasks.pop((symbol, interval), None)

# 🧠 Candle Handler
async def handle_candle(candle: dict):
    symbol = candle['s']
    interval = candle['i']
    start_ts = candle['t']
    key = (symbol, interval)

    if key not in latest_candle_ts:
        latest_candle_ts[key] = start_ts
        last_closed_candle[key] = candle
        return

    if latest_candle_ts[key] != start_ts:
        await evaluate_triggers(symbol, interval, last_closed_candle[key])
        last_closed_candle[key] = candle
        latest_candle_ts[key] = start_ts
    else:
        last_closed_candle[key] = candle

# 🧠 Trigger Evaluation
async def evaluate_triggers(symbol: str, interval: str, candle: dict):
    ts = datetime.fromtimestamp(candle['t'] / 1000, tz=timezone.utc)
    triggers = get_triggers_for(symbol, interval)
    fired_trigger_ids = []

    for trigger in triggers:
        if ts < trigger.registered_at.replace(tzinfo=timezone.utc):
            continue

        if trigger.type == "ohlcvn":
            cond = trigger.condition
            value = float(candle[cond.source])

            if cond.above and value > cond.threshold:
                await send_telegram(trigger.chat_id, f"✅ {symbol} {interval} {cond.source} > {cond.threshold}")
                fired_trigger_ids.append(trigger.id)
            elif not cond.above and value < cond.threshold:
                await send_telegram(trigger.chat_id, f"🔻 {symbol} {interval} {cond.source} < {cond.threshold}")
                fired_trigger_ids.append(trigger.id)

    # ❌ Delete fired triggers from DB
    for tid in fired_trigger_ids:
        delete_trigger_db(tid)

    if fired_trigger_ids:
        print(f"🗑 Removed {len(fired_trigger_ids)} fired DB triggers for {symbol} {interval}")

    # 🔌 Shutdown WS if no triggers remain
    await maybe_unsubscribe(symbol, interval)
