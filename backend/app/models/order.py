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



class IndicatorParameters(BaseModel):
    length: int
    OHLC_source: str
    std_dev: Optional[float] = None

class FirstSource(BaseModel):
    type: Literal["OHLCV", "indicators"]
    source: Optional[str] = None
    indicator: Optional[str] = None
    parameters: Optional[IndicatorParameters] = None


class SecondSource(BaseModel):
    type: Literal["value","indicators"]
    indicator: Optional[str] = None
    parameters: Optional[IndicatorParameters] = None
    value: Optional[float] = None




class Cooldown(BaseModel):
    active: Optional[bool] = False
    value: Optional[int] = None

class ChainedConfirmation(BaseModel):
    active: Optional[bool] = False
    
class InvalidationHalt(BaseModel):
    active: Optional[bool] = False






class OhlcvTriggerData(BaseModel):
    pair: str
    timeframe: str
    first_source: FirstSource
    triggerWhen: str #above, below
    second_source: SecondSource
    cooldown: Cooldown
    chained_confirmation: ChainedConfirmation
    invalidation_halt: InvalidationHalt
    lifetime: Optional[str] = None


class OrderData(BaseModel):
    type: str  # e.g. "ohlcvTrigger", "walletActivity"
    ohlcvTrigger: Optional[OhlcvTriggerData] = None
    walletActivity: Optional[Dict[str, Any]] = None

    #to add support for other types of orders


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
    state: Literal["open", "done_successful", "done_failed", "successful", "failed", "deleted"] = "open"
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



class ActualOutput(BaseModel):
    token: str
    amount: float


class OrderTriggeredRequest(BaseModel):
    orderId: int
    inputValueUsd: float = Field(..., description="Executed input notional in USD")
    triggeredPrice: float = Field(..., description="Price at the moment the order triggered on-chain")
    actualOutputs: Optional[List[ActualOutput]] = Field(None, description="Realized outputs per token from the smart contract")
    
    @field_validator("actualOutputs")
    @classmethod
    def validate_actual_outputs_max_len(cls, v):
        if v is not None and len(v) > 4:
            raise ValueError("actualOutputs must have at most 4 items")
        return v


class UpdateOrderStateRequest(BaseModel):
    orderId: int
    state: Literal["open", "done_successful", "done_failed", "successful", "failed", "deleted"]
    termination_message: Optional[str] = None

