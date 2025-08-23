from typing import Literal, Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator


# ---- Core nested models ----
class OutputSplit(BaseModel):
    token: str
    percentage: float


class SwapData(BaseModel):
    input_token: str    
    input_amount: float
    # Legacy single-output fields (kept optional for backward compatibility)
    output_token: Optional[str] = None
    output_amount: Optional[float] = None  # deprecated, no longer populated by frontend
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
    value: Optional[int] = None
class InvalidationHalt(BaseModel):
    active: Optional[bool] = False






class OhlcvTriggerData(BaseModel):
    pair: str
    timeframe: str
    first_source: FirstSource
    trigger_when: str #above, below
    second_source: SecondSource
    cooldown: Cooldown
    chained_confirmation: ChainedConfirmation
    invalidation_halt: InvalidationHalt
    lifetime: Optional[str] = None


class OrderData(BaseModel):
    type: str  # e.g. "ohlcv_trigger", "wallet_activity"
    ohlcv_trigger: Optional[OhlcvTriggerData] = None
    wallet_activity: Optional[Dict[str, Any]] = None

    #to add later


class OrderCreateRequest(BaseModel):
    platform: Literal["hyperevm", "hypercore", "notifications"]
    wallet: str
    swap_data: SwapData  
    order_data: OrderData
    signature: Optional[str] = None
    time: int = Field(..., description="Unix timestamp (seconds or ms)")


class OrderOut(BaseModel):
    id: int
    user_id: int
    wallet: str
    platform: str
    swap_data: SwapData
    order_data: OrderData
    signature: Optional[str] = None
    time: int
    state: Literal["open", "successful", "failed", "deleted", "done_successful", "done_failed"] = "open"
    termination_message: Optional[str] = None
    created_at: Optional[str] = None

    model_config = {
        "populate_by_name": True,
        "extra": "allow",
    }


class DeleteOrderRequest(BaseModel):
    wallet: str
    signature: Optional[str] = None
    order_id: int



class ActualOutput(BaseModel):
    token: str
    amount: float


class OrderTriggeredRequest(BaseModel):
    order_id: int
    input_value_usd: float = Field(..., description="Executed input notional in USD")
    triggered_price: float = Field(..., description="Price at the moment the order triggered on-chain")
    actual_outputs: Optional[List[ActualOutput]] = Field(None, description="Realized outputs per token from the smart contract")
    
    @field_validator("actual_outputs")
    @classmethod
    def validate_actual_outputs_max_len(cls, v):
        if v is not None and len(v) > 4:
            raise ValueError("actual_outputs must have at most 4 items")
        return v


class UpdateOrderStateRequest(BaseModel):
    order_id: int
    state: Literal["open", "successful", "failed", "deleted", "done_successful", "done_failed"]
    termination_message: Optional[str] = None

