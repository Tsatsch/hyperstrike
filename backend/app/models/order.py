from typing import Literal, Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator


# ---- Core nested models ----
class OutputSplit(BaseModel):
    token: str
    percentage: float


class SwapData(BaseModel):
    inputToken: str
    inputAmount: float
    # Legacy single-output fields (kept optional for backward compatibility)
    outputToken: Optional[str] = None
    outputAmount: Optional[float] = None  # deprecated, no longer populated by frontend
    # New multi-output percentage-based splits (max 4)
    outputs: Optional[List[OutputSplit]] = None

    @field_validator("outputs")
    @classmethod
    def validate_outputs_max_len(cls, v):
        if v is not None and len(v) > 4:
            raise ValueError("outputs must have at most 4 items")
        return v


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
    state: Literal["open", "done", "closed", "deleted"] = "open"
    termination_message: Optional[str] = None
    created_at: Optional[str] = None

    model_config = {
        "populate_by_name": True,
        "extra": "allow",
    }


class DeleteOrderRequest(BaseModel):
    wallet: str
    signature: Optional[str] = None
    orderId: int



class OrderTriggeredRequest(BaseModel):
    orderId: int
    inputValueUsd: float = Field(..., description="Executed input notional in USD")


class UpdateOrderStateRequest(BaseModel):
    orderId: int
    state: Literal["open", "done", "closed", "deleted"]
    termination_message: Optional[str] = None

