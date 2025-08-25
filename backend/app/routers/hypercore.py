from fastapi import APIRouter, HTTPException, Depends
from app.auth.session import get_current_user
from app.models.hypercore import PreTriggerOrderCreate, PreTriggerOrder
from app.services.hypercore import HypercoreService
import requests
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

HYPERLIQUID_INFO_API = "https://api.hyperliquid.xyz/info"


@router.post("/hypercore/info")
def proxy_hypercore_info(payload: dict):
    try:
        res = requests.post(HYPERLIQUID_INFO_API, json=payload, timeout=10)
        if not res.ok:
            raise HTTPException(status_code=res.status_code, detail=res.text)
        return res.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"HyperCore upstream error: {e}")


@router.post("/hypercore/pre-trigger-order", response_model=PreTriggerOrder)
async def create_pre_trigger_order(payload: PreTriggerOrderCreate, current_user=Depends(get_current_user)):
    """
    Create a pre-trigger order for HyperCore futures trading.
    Stores the trigger conditions and position data in the pre_trigger_orders table.
    """
    try:
        # Debug logging
        logger.info(f"Creating pre-trigger order for user_id: {payload.user_id}, wallet: {payload.user_wallet}")
        logger.info(f"Current user: {current_user}")
        
        # Normalize wallet addresses for comparison (convert to lowercase)
        payload_wallet_lower = payload.user_wallet.lower()
        current_wallet_lower = current_user["wallet"].lower()
        
        if payload_wallet_lower != current_wallet_lower:
            logger.error(f"Wallet mismatch: payload.user_wallet={payload.user_wallet}, current_user['wallet']={current_user['wallet']}")
            raise HTTPException(status_code=403, detail="Can only create orders for your own wallet")

        # Create the pre-trigger order using the service
        order_data = PreTriggerOrderCreate(
            user_id=current_user["user_id"],
            user_wallet=payload.user_wallet,
            trigger_data=payload.trigger_data,
            position_data=payload.position_data
        )
        
        created_order = await HypercoreService.create_pre_trigger_order(order_data)
        
        if not created_order:
            raise HTTPException(status_code=500, detail="Failed to create pre-trigger order")

        return created_order

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        logger.error(f"Failed to create pre-trigger order: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to create pre-trigger order: {str(e)}")


@router.get("/hypercore/pre-trigger-orders/{user_id}")
async def get_user_pre_trigger_orders(user_id: int, current_user=Depends(get_current_user)):
    """
    Get all pre-trigger orders for a specific user.
    Users can only access their own orders.
    """
    try:
        # Validate that the user is requesting their own orders
        if user_id != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Can only access your own orders")

        # Fetch orders using the service
        orders = await HypercoreService.get_pre_trigger_orders(user_id)
        return [order.model_dump() for order in orders]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch pre-trigger orders: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch pre-trigger orders: {str(e)}")


@router.delete("/hypercore/pre-trigger-orders/{order_id}")
async def delete_pre_trigger_order(order_id: int, current_user=Depends(get_current_user)):
    """
    Delete a pre-trigger order.
    Users can only delete their own orders.
    """
    try:
        # Get all user orders to check ownership
        user_orders = await HypercoreService.get_pre_trigger_orders(current_user["user_id"])
        order_ids = [order.id for order in user_orders]
        
        if order_id not in order_ids:
            raise HTTPException(status_code=404, detail="Order not found")

        # Delete the order using the service
        success = await HypercoreService.delete_pre_trigger_order(order_id)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete order")

        return {"status": "deleted", "order_id": order_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete pre-trigger order: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete pre-trigger order: {str(e)}")


