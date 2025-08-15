from typing import Literal, Optional, List, Dict, Any
from pydantic import BaseModel, Field


# ---- Core nested models ----
class SwapData(BaseModel):
    inputToken: str
    inputAmount: float
    outputToken: str
    outputAmount: float


class OhlcvTriggerData(BaseModel):
    pair: str
    timeframe: str
    source: str
    trigger: str
    triggerValue: str


class OrderData(BaseModel):
    type: str  # e.g. "ohlcvTrigger", "walletActivity"
    ohlcvTrigger: Optional[OhlcvTriggerData] = None
    walletActivity: Optional[Dict[str, Any]] = None


class OrderCreateRequest(BaseModel):
    platform: Literal["hyperevm", "hypercore", "notifications"]
    wallet: str
    swapData: SwapData
    orderData: OrderData
    signature: Optional[str] = None
    time: int = Field(..., description="Unix timestamp (seconds or ms)")


class OrderOut(BaseModel):
    id: int
    user_id: int
    wallet: str
    platform: str
    swapData: SwapData
    orderData: OrderData
    signature: Optional[str] = None
    time: int
    state: Literal["open", "closed", "deleted"] = "open"
    created_at: Optional[str] = None

    model_config = {
        "populate_by_name": True,
        "extra": "allow",
    }


class DeleteOrderRequest(BaseModel):
    wallet: str
    signature: Optional[str] = None
    orderId: int


