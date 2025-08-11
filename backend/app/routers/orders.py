from typing import List
from fastapi import APIRouter, HTTPException, Depends
from app.auth.session import get_current_user
from app.models.order import OrderCreateRequest, OrderOut, DeleteOrderRequest
from app.services.orders import create_order, list_orders_for_user, delete_order_for_user


router = APIRouter()


@router.post("/order", response_model=OrderOut)
async def post_order(payload: OrderCreateRequest, current_user=Depends(get_current_user)):
    try:
        saved = create_order(payload, current_user["user_id"], current_user["wallet"])  # associate securely with caller
        return saved
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/orders", response_model=List[OrderOut])
async def get_orders(current_user=Depends(get_current_user)):
    try:
        return list_orders_for_user(current_user["user_id"]) 
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/order")
async def delete_order(payload: DeleteOrderRequest, current_user=Depends(get_current_user)):
    try:
        # Signature validation to be added when scheme finalized
        delete_order_for_user(payload.orderId, current_user["user_id"]) 
        return {"status": "deleted"}
    except Exception as exc:
        detail = str(exc)
        if "not found" in detail.lower():
            raise HTTPException(status_code=404, detail=detail)
        raise HTTPException(status_code=500, detail=detail)


