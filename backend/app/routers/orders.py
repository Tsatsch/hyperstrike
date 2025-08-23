from typing import List
from fastapi import APIRouter, HTTPException, Depends
from app.auth.session import get_current_user
from app.models.order import OrderCreateRequest, OrderOut, DeleteOrderRequest, OrderTriggeredRequest, UpdateOrderStateRequest
from app.services.orders import create_order, list_orders_for_user, delete_order_for_user, close_order_for_user, update_order_state_for_user
from app.services.user import ensure_user_has_xp_column_default, increment_user_xp

import logging
logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/order", response_model=OrderOut)
async def post_order(payload: OrderCreateRequest, current_user=Depends(get_current_user)):
    try:
        saved = await create_order(payload, current_user["user_id"], current_user["wallet"])  # associate securely with caller
        return saved
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/orders", response_model=List[OrderOut])
async def get_orders(current_user=Depends(get_current_user)):
    try:
        logger.info(f"current_user: {current_user}")

        if current_user.get("role") == "system":
            raise HTTPException(status_code=403, detail="System worker not allowed here")

        return list_orders_for_user(current_user["user_id"])

    except HTTPException:
        raise
    except Exception as exc:
        import traceback
        logger.error(f"/orders failed: {exc}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(exc))




@router.delete("/order")
async def delete_order(payload: DeleteOrderRequest, current_user=Depends(get_current_user)):
    try:
        # Signature validation to be added when scheme finalized
        delete_order_for_user(payload.order_id, current_user["user_id"]) 
        return {"status": "deleted"}
    except Exception as exc:
        detail = str(exc)
        if "not found" in detail.lower():
            raise HTTPException(status_code=404, detail=detail)
        raise HTTPException(status_code=500, detail=detail)


@router.post("/order/triggered")
async def order_triggered(payload: OrderTriggeredRequest, current_user=Depends(get_current_user)):
    """
    Called when an order gets executed; awards 1% of input USD value as XP and marks done_successful.
    Supports both user JWT (normal flow) and system worker JWT (worker flow).
    """
    try:
        from app.db.sb import supabase

        # --- Determine user_id ---
        if current_user.get("role") == "system":
            # Worker case: fetch order owner from DB
            result = supabase.table("orders").select("user_id").eq("id", payload.order_id).execute()
            if not result.data:
                raise HTTPException(status_code=404, detail="Order not found")
            user_id = result.data[0]["user_id"]
        else:
            # Normal user case
            user_id = current_user["user_id"]

        # --- Award XP ---
        ensure_user_has_xp_column_default(user_id)
        xp_delta = int(max(0.0, float(payload.input_value_usd)) * 0.01)

        logger.info(f"XP delta: {xp_delta}")
        if xp_delta > 0:
            increment_user_xp(user_id, xp_delta)

        # --- Persist execution details ---
        update = {
            "state": "done_successful",
            "termination_message": "Triggered",
            "triggered_price": float(payload.triggered_price),
        }
        if payload.actual_outputs is not None:
            update["actual_outputs"] = [
                {"token": item.token, "amount": float(item.amount)} for item in payload.actual_outputs
            ]

        supabase.table("orders").update(update).eq("id", payload.order_id).eq("user_id", user_id).execute()

        return {"xp_awarded": xp_delta}

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))



@router.post("/order/expire")
async def order_expire(orderId: int, reason: str = "time ran out", current_user=Depends(get_current_user)):
    try:
        # mark as done_failed on expiration
        updated = update_order_state_for_user(orderId, current_user["user_id"], "done_failed", reason)
        return {"status": "failed", "order": updated}
    except Exception as exc:
        detail = str(exc)
        if "not found" in detail.lower():
            raise HTTPException(status_code=404, detail=detail)
        raise HTTPException(status_code=500, detail=detail)


@router.post("/order/state", response_model=OrderOut)
async def update_order_state(payload: UpdateOrderStateRequest, current_user=Depends(get_current_user)):
    try:
        updated = update_order_state_for_user(payload.order_id, current_user["user_id"], payload.state, payload.termination_message)
        return updated
    except Exception as exc:
        detail = str(exc)
        if "not found" in detail.lower():
            raise HTTPException(status_code=404, detail=detail)
        raise HTTPException(status_code=500, detail=detail)

