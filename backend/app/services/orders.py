from typing import List, Optional, Dict, Any
from app.db.sb import supabase
from app.models.order import OrderCreateRequest, OrderOut


def _normalize_wallet(wallet: str) -> str:
    return wallet.lower()


def create_order(order_req: OrderCreateRequest, user_id: int, user_wallet: str) -> OrderOut:
    """Insert order into Supabase and return saved record."""
    data = order_req.model_dump()
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
    return OrderOut(**saved)


def list_orders_for_user(user_id: int) -> List[OrderOut]:
    response = supabase.table("orders").select("*").eq("user_id", user_id).order("id", desc=True).execute()
    if getattr(response, "error", None):
        raise Exception(f"Failed to fetch orders: {response.error}")
    return [OrderOut(**row) for row in response.data]


def delete_order_for_user(order_id: int, user_id: int) -> None:
    # Option A: soft delete -> set state = 'deleted'
    update = {"state": "deleted"}
    response = supabase.table("orders").update(update).eq("id", order_id).eq("user_id", user_id).neq("state", "deleted").execute()
    if getattr(response, "error", None):
        raise Exception(f"Failed to delete order: {response.error}")
    if not response.data:
        # nothing updated -> either not found, not owner, or already deleted
        raise Exception("Order not found or already deleted")


