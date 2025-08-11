from pydantic import BaseModel
from datetime import datetime

class WalletResponse(BaseModel):
    address: str
    connected: bool

class WalletConnection(BaseModel):
    address: str
    connected_at: datetime
    last_seen: datetime
