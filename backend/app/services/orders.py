from typing import List, Optional, Dict, Any
from app.db.sb import supabase
from app.models.order import OrderCreateRequest, OrderOut, OhlcvTriggerData
import asyncio
import logging
from app.services.candle_watcher import register_trigger

logger = logging.getLogger(__name__)

def _normalize_wallet(wallet: str) -> str:
    return wallet.lower()

def _canonicalize_symbol_for_hyperliquid(symbol: str) -> str:
    """Map internal symbols (e.g., UBTC) to Hyperliquid canonical form (e.g., BTC)."""
    if not symbol:
        return symbol
    s = symbol.upper()
    if s.startswith("U") and len(s) > 1:
        return s[1:]
    return s



async def create_order(order_req: OrderCreateRequest, user_id: int, user_wallet: str) -> OrderOut:
    """Insert order into Supabase and return saved record."""

    # Exclude None values so JSON payloads remain compact (and omit legacy fields when unused)
    data = order_req.model_dump(exclude_none=True)
    # Authoritative wallet comes from session, not client payload
    data["wallet"] = _normalize_wallet(user_wallet)
    data["user_id"] = user_id
    if "state" not in data or not data["state"]:
        data["state"] = "open"

    # Supabase needs JSON for nested
    response = supabase.table("orders").insert(data).execute()
    if getattr(response, "error", None):
        raise Exception(f"Failed to create order: {response.error}")
    saved = response.data[0]
    
    # Try to subscribe to market data for this order (non-blocking)
    try:
        if (saved.get("order_data") and 
            saved["order_data"].get("type") == "ohlcv_trigger" and
            saved["order_data"].get("ohlcv_trigger")):
            trigger = OhlcvTriggerData(**saved["order_data"]["ohlcv_trigger"])
            await register_trigger(trigger)
        
        # elif (saved.get("order_data") and 
        #     saved["order_data"].get("type") == "wallet_activity"):
        #     trigger = saved["order_data"]["wallet_activity"]
        #     asyncio.create_task(register_trigger(trigger))
        
        # else:
        #     logger.warning(f"Failed to subscribe to market data for new order: {e}")
    except Exception as e:


        #to extend later 
        logger.warning(f"Failed to subscribe to market data for new order: {e}")
    
    return OrderOut(**saved)


async def _subscribe_to_market_data(symbol: str, timeframe: str):
    """Subscribe to market data for a symbol/timeframe combination"""
    try:
        from app.services.candle_watcher import ensure_subscription
        await ensure_subscription(symbol, timeframe)
        logger.info(f"Subscribed to market data for {symbol}/{timeframe}")
    except Exception as e:
        logger.error(f"Failed to subscribe to market data for {symbol}/{timeframe}: {e}")


def list_orders_for_user(user_id: int) -> List[OrderOut]:
    response = supabase.table("orders").select("*").eq("user_id", user_id).order("id", desc=True).execute()
    if getattr(response, "error", None):
        raise Exception(f"Failed to fetch orders: {response.error}")
    return [OrderOut(**row) for row in response.data]


def get_all_open_orders() -> List[OrderOut]:
    """Fetch all open orders in a single query (backend housekeeping)."""
    response = supabase.table("orders").select("*").eq("state", "open").execute()
    if getattr(response, "error", None):
        raise Exception(f"Failed to fetch open orders: {response.error}")
    return [OrderOut(**row) for row in response.data]


def get_open_orders_by_symbol_timeframe(symbol: str, timeframe: str) -> List[OrderOut]:
    """Get all open orders for a specific symbol and timeframe"""
    try:
        response = supabase.table("orders").select("*").eq("state", "open").execute()
        if getattr(response, "error", None):
            raise Exception(f"Failed to fetch orders: {response.error}")
        
        orders = []
        requested_symbol = _canonicalize_symbol_for_hyperliquid(symbol)
        for order_data in response.data:
            try:
                order = OrderOut(**order_data)
                # Check if this order has OHLCV trigger data that matches our symbol/timeframe
                if (order.order_data and 
                    order.order_data.type == "ohlcvTrigger" and
                    order.order_data.ohlcv_trigger and
                    _canonicalize_symbol_for_hyperliquid(order.order_data.ohlcv_trigger.pair) == requested_symbol and
                    order.order_data.ohlcv_trigger.timeframe == timeframe):
                    orders.append(order)
            except Exception:
                continue
        
        return orders
    except Exception as e:
        raise Exception(f"Error fetching orders for {symbol}/{timeframe}: {e}")


def delete_order_for_user(order_id: int, user_id: int) -> None:
    # Option A: soft delete -> set state = 'deleted'
    update = {"state": "deleted"}
    response = supabase.table("orders").update(update).eq("id", order_id).eq("user_id", user_id).neq("state", "deleted").execute()
    if getattr(response, "error", None):
        raise Exception(f"Failed to delete order: {response.error}")
    if not response.data:
        # nothing updated -> either not found, not owner, or already deleted
        raise Exception("Order not found or already deleted")


def close_order_for_user(order_id: int, user_id: int, message: Optional[str] = None) -> OrderOut:
    # Legacy helper retained; now maps to done_failed to reflect non-successful termination
    update: Dict[str, Any] = {"state": "done_failed"}
    if message is not None:
        update["termination_message"] = message
    response = supabase.table("orders").update(update).eq("id", order_id).eq("user_id", user_id).execute()
    if getattr(response, "error", None):
        raise Exception(f"Failed to close order: {response.error}")
    if not response.data:
        raise Exception("Order not found or not owned by user")
    return OrderOut(**response.data[0])


def update_order_state_for_user(order_id: int, user_id: int, state: str, message: Optional[str] = None) -> OrderOut:
    update: Dict[str, Any] = {"state": state}
    if message is not None:
        update["termination_message"] = message
    response = supabase.table("orders").update(update).eq("id", order_id).eq("user_id", user_id).execute()
    if getattr(response, "error", None):
        raise Exception(f"Failed to update order state: {response.error}")
    if not response.data:
        raise Exception("Order not found or not owned by user")
    return OrderOut(**response.data[0])




