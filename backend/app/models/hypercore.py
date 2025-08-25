from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


class UserSubaccount(BaseModel):
    """User subaccount database model"""
    id: Optional[int] = None
    user_id: int
    user_wallet: str
    sub_account_pubkey: str
    sub_account_privkey: str
    timestamp_creation: datetime
    is_active: bool = True

    class Config:
        from_attributes = True


class UserSubaccountCreate(BaseModel):
    """Create user subaccount request"""
    user_id: int
    user_wallet: str
    sub_account_pubkey: str
    sub_account_privkey: str
    is_active: bool = True


class UserSubaccountUpdate(BaseModel):
    """Update user subaccount request"""
    is_active: Optional[bool] = None


class PreTriggerOrder(BaseModel):
    """Pre-trigger order database model"""
    id: Optional[int] = None
    user_id: int
    user_wallet: str
    trigger_data: Dict[str, Any]  # JSON field for trigger configuration
    position_data: Dict[str, Any]  # JSON field for futures position data
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PreTriggerOrderCreate(BaseModel):
    """Create pre-trigger order request"""
    user_id: Optional[int] = None
    user_wallet: str
    trigger_data: Dict[str, Any]
    position_data: Dict[str, Any]


class PostTriggerPosition(BaseModel):
    """Post-trigger position database model"""
    id: Optional[int] = None
    user_id: int
    user_wallet: str
    cloid: str
    is_active: bool = True
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PostTriggerPositionCreate(BaseModel):
    """Create post-trigger position request"""
    user_id: int
    user_wallet: str
    cloid: str
    is_active: bool = True


class PostTriggerPositionUpdate(BaseModel):
    """Update post-trigger position request"""
    is_active: Optional[bool] = None
