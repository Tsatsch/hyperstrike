from pydantic import BaseModel, Field
from enum import Enum
from typing import Literal, Union, Optional
from datetime import datetime


# -------- Trigger Type --------
class TriggerType(str, Enum):
    # OHLCVN = "ohlcvn"
    pass
    # more types like 'sma_cross', 'price_change' etc. can be added later


# -------- OHLCVN Condition --------
class OhlcvnCondition(BaseModel):
    symbol: str               # e.g. '@107'
    interval: str             # e.g. '1m', '5m'

    # allow both single char and full words (o, open), case-insensitive
    source: Literal["o", "open", "h", "high", "l", "low", "c", "close", "v", "volume", "n", "trades"]
    
    above: bool               # true if source should be > threshold
    threshold: float          # price / volume / trade count
    lookback: int = 0         # placeholder for future use
# -------- Full Universal Trigger --------
class UniversalTrigger(BaseModel):
    id: Optional[int] = None
    user_id: Optional[int] = None
    type: str                 # e.g. "ohlcvn" — for now treat as free text
    condition: Union[OhlcvnCondition]  # future: add SMACondition, etc.
    platform: str
    chat_id: Union[int, str]
    registered_at: datetime
    
    model_config = {
        "populate_by_name": True,
        "alias_generator": None,
        "extra": "forbid"
    }
