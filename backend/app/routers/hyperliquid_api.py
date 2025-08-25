"""
Hyperliquid API Router
FastAPI endpoints for Hyperliquid trading operations
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
import logging
import time

from ..hypercore.hyperliquid_api import (
    hyperliquid_api, 
    CreatePositionRequest, 
    OrderRequest
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/hyperliquid", tags=["hyperliquid"])

# Pydantic models for request validation

class CreatePositionRequestModel(BaseModel):
    user_id: str
    user_wallet: str
    token_symbol: str
    is_long: bool
    size: float
    leverage: int
    order_type: str = "market"
    limit_price: Optional[float] = None
    take_profit: Optional[float] = None
    stop_loss: Optional[float] = None

class CreateOrderRequestModel(BaseModel):
    user_id: str
    user_wallet: str
    asset: str
    is_buy: bool
    size: str
    price: Optional[str] = None
    reduce_only: bool = False
    order_type: str = "limit"
    time_in_force: str = "Gtc"
    trigger_price: Optional[str] = None
    trigger_type: Optional[str] = None
    is_market_trigger: bool = False
    client_order_id: Optional[str] = None

class TransferRequestModel(BaseModel):
    user_id: str
    user_wallet: str
    amount: str

class SpotTransferRequestModel(BaseModel):
    user_id: str
    user_wallet: str
    destination: str
    amount: str
    token: str

class ApproveAgentRequestModel(BaseModel):
    user_wallet: str
    agent_name: str = "Hypertick"

class CompleteAgentApprovalRequestModel(BaseModel):
    action: Dict[str, Any]
    signature: str
    agent_details: Dict[str, Any]

class AgentPositionRequestModel(BaseModel):
    user_wallet: str
    token_symbol: str
    is_long: bool
    size: float
    leverage: int
    order_type: str = "market"
    limit_price: Optional[float] = None
    take_profit: Optional[float] = None
    stop_loss: Optional[float] = None

class AgentTransferRequestModel(BaseModel):
    user_wallet: str
    amount: str

# Agent Approval Endpoints

@router.post("/approve_agent")
async def approve_agent(request: ApproveAgentRequestModel):
    """
    Generate agent approval message for user to sign with their wallet
    
    This endpoint creates a signable EIP-712 message that the user must sign
    with their wallet to approve an agent for trading on their behalf.
    """
    try:
        result = hyperliquid_api.approve_agent(
            user_wallet=request.user_wallet,
            agent_name=request.agent_name
        )
        
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])
        
        return result
        
    except Exception as e:
        logger.error(f"Error in approve_agent endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/complete_agent_approval")
async def complete_agent_approval(request: CompleteAgentApprovalRequestModel):
    """
    Complete the agent approval process after user signs the message
    
    Submit the user's signature to Hyperliquid to finalize agent approval
    and store agent credentials in the database.
    """
    try:
        result = hyperliquid_api.complete_agent_approval(
            action=request.action,
            signature=request.signature,
            agent_details=request.agent_details
        )
        
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])
        
        return result
        
    except Exception as e:
        logger.error(f"Error in complete_agent_approval endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/agent_status/{user_wallet}")
async def get_agent_status(user_wallet: str):
    """
    Check if user has an active agent approved
    """
    try:
        result = hyperliquid_api.get_user_agent(user_wallet)
        
        if result["status"] == "error":
            return {
                "status": "no_agent",
                "message": "No active agent found",
                "has_agent": False
            }
        
        return {
            "status": "has_agent",
            "message": "Active agent found",
            "has_agent": True,
            "agent_address": result["agent_address"],
            "agent_name": result["agent_name"],
            "network": result["network"]
        }
        
    except Exception as e:
        logger.error(f"Error in get_agent_status endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/agent/create_position")
async def create_position_with_agent(request: AgentPositionRequestModel):
    """
    Create a new position using the user's approved agent
    
    This endpoint uses the user's approved agent to create positions
    without requiring the user to sign each transaction.
    """
    try:
        # Convert to CreatePositionRequest format
        position_request = CreatePositionRequest(
            user_id="",  # Not needed for agent-based trading
            user_wallet=request.user_wallet,
            token_symbol=request.token_symbol,
            is_long=request.is_long,
            size=request.size,
            leverage=request.leverage,
            order_type=request.order_type,
            limit_price=request.limit_price,
            take_profit=request.take_profit,
            stop_loss=request.stop_loss
        )
        
        result = hyperliquid_api.create_position_with_agent(position_request)
        
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])
        
        return result
        
    except Exception as e:
        logger.error(f"Error in create_position_with_agent endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/agent/positions/{user_wallet}")
async def get_user_positions_with_agent(user_wallet: str):
    """
    Fetch user's current positions using their approved agent
    """
    try:
        result = hyperliquid_api.get_user_positions(user_wallet)
        
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])
        
        return result
        
    except Exception as e:
        logger.error(f"Error in get_user_positions_with_agent endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/agent/transfer/spot_to_perp")
async def transfer_spot_to_perp_with_agent(request: AgentTransferRequestModel):
    """
    Transfer funds from spot account to perp account using agent
    """
    try:
        result = hyperliquid_api.transfer_spot_to_perp_with_agent(
            request.user_wallet, 
            request.amount
        )
        
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])
        
        return result
        
    except Exception as e:
        logger.error(f"Error in transfer_spot_to_perp_with_agent endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/agent/transfer/perp_to_spot")
async def transfer_perp_to_spot_with_agent(request: AgentTransferRequestModel):
    """
    Transfer funds from perp account to spot account using agent
    """
    try:
        result = hyperliquid_api.transfer_perp_to_spot_with_agent(
            request.user_wallet, 
            request.amount
        )
        
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])
        
        return result
        
    except Exception as e:
        logger.error(f"Error in transfer_perp_to_spot_with_agent endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Legacy Trading Endpoints (kept for compatibility)

@router.post("/create_position")
async def create_position(request: CreatePositionRequestModel):
    """
    Create a new position on Hyperliquid
    
    This endpoint handles all the complexity of:
    - Fetching user credentials from database
    - Setting leverage
    - Creating the position
    - Handling TP/SL orders
    - Storing position data in database
    """
    try:
        # Convert Pydantic model to dataclass
        position_request = CreatePositionRequest(
            user_id=request.user_id,
            user_wallet=request.user_wallet,
            token_symbol=request.token_symbol,
            is_long=request.is_long,
            size=request.size,
            leverage=request.leverage,
            order_type=request.order_type,
            limit_price=request.limit_price,
            take_profit=request.take_profit,
            stop_loss=request.stop_loss
        )
        
        result = hyperliquid_api.create_position(position_request)
        
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])
        
        return result
        
    except Exception as e:
        logger.error(f"Error in create_position endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/create_order")
async def create_order(request: CreateOrderRequestModel):
    """
    Create an order with all possible properties
    
    Supports all order types: market, limit, trigger orders
    with comprehensive parameter support
    """
    try:
        # Convert Pydantic model to dataclass
        order_request = OrderRequest(
            user_id=request.user_id,
            user_wallet=request.user_wallet,
            asset=request.asset,
            is_buy=request.is_buy,
            size=request.size,
            price=request.price,
            reduce_only=request.reduce_only,
            order_type=request.order_type,
            time_in_force=request.time_in_force,
            trigger_price=request.trigger_price,
            trigger_type=request.trigger_type,
            is_market_trigger=request.is_market_trigger,
            client_order_id=request.client_order_id
        )
        
        result = hyperliquid_api.create_order(order_request)
        
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])
        
        return result
        
    except Exception as e:
        logger.error(f"Error in create_order endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/positions/{user_id}")
async def get_user_positions(user_id: str, user_wallet: str):
    """
    Fetch user's current positions in all available values
    """
    try:
        result = hyperliquid_api.get_user_positions(user_id, user_wallet)
        
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])
        
        return result
        
    except Exception as e:
        logger.error(f"Error in get_user_positions endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Transfer Endpoints

@router.post("/transfer/spot_to_perp")
async def transfer_spot_to_perp(request: TransferRequestModel):
    """
    Transfer funds from spot account to perp account
    """
    try:
        result = hyperliquid_api.transfer_spot_to_perp(
            request.user_id, 
            request.user_wallet, 
            request.amount
        )
        
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])
        
        return result
        
    except Exception as e:
        logger.error(f"Error in transfer_spot_to_perp endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/transfer/perp_to_spot")
async def transfer_perp_to_spot(request: TransferRequestModel):
    """
    Transfer funds from perp account to spot account
    """
    try:
        result = hyperliquid_api.transfer_perp_to_spot(
            request.user_id, 
            request.user_wallet, 
            request.amount
        )
        
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])
        
        return result
        
    except Exception as e:
        logger.error(f"Error in transfer_perp_to_spot endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/transfer/core_spot")
async def core_spot_transfer(request: SpotTransferRequestModel):
    """
    Core spot transfer to external address
    """
    try:
        result = hyperliquid_api.core_spot_transfer(
            request.user_id,
            request.user_wallet,
            request.destination,
            request.amount,
            request.token
        )
        
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])
        
        return result
        
    except Exception as e:
        logger.error(f"Error in core_spot_transfer endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Info Endpoints (proxying Hyperliquid info API)

@router.post("/info")
async def proxy_hyperliquid_info(payload: dict):
    """
    Proxy endpoint for Hyperliquid info API
    """
    try:
        # Get info client from our API instance
        info = hyperliquid_api.get_info_client()
        
        if payload.get("type") == "meta":
            result = info.meta()
        elif payload.get("type") == "clearinghouseState":
            user = payload.get("user")
            if not user:
                raise HTTPException(status_code=400, detail="User address required")
            result = info.user_state(user)
        elif payload.get("type") == "openOrders":
            user = payload.get("user")
            if not user:
                raise HTTPException(status_code=400, detail="User address required")
            result = info.open_orders(user)
        elif payload.get("type") == "allMids":
            result = info.all_mids()
        elif payload.get("type") == "spotMeta":
            result = info.spot_meta()
        elif payload.get("type") == "spotClearinghouseState":
            user = payload.get("user")
            if not user:
                raise HTTPException(status_code=400, detail="User address required")
            result = info.spot_user_state(user)
        else:
            # For other types, make direct request
            import requests
            api_url = "https://api.hyperliquid-testnet.xyz/info" if hyperliquid_api.testnet else "https://api.hyperliquid.xyz/info"
            response = requests.post(api_url, json=payload, timeout=10)
            if not response.ok:
                raise HTTPException(status_code=response.status_code, detail=response.text)
            result = response.json()
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in proxy_hyperliquid_info endpoint: {e}")
        raise HTTPException(status_code=502, detail=f"Hyperliquid upstream error: {e}")

# Health check endpoint
@router.get("/health")
async def health_check():
    """
    Health check endpoint
    """
    return {
        "status": "healthy",
        "service": "hyperliquid_api",
        "testnet": hyperliquid_api.testnet,
        "timestamp": int(time.time() * 1000)
    }
