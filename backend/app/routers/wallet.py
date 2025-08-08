from fastapi import APIRouter, Query
from typing import Optional
from app.models.wallet import WalletResponse
from app.services import wallet as wallet_service

router = APIRouter()

@router.get("/test")
async def test_endpoint():
    return {"message": "Backend is working!", "status": "ok"}

@router.get("/wallet", response_model=WalletResponse)
async def get_wallet_address(address: Optional[str] = Query(None, description="Wallet address")):
    return wallet_service.get_wallet_response(address)

@router.get("/wallet/status", response_model=WalletResponse)
async def get_wallet_status():
    return wallet_service.get_wallet_status()

@router.get("/wallet/connections")
async def get_all_connections():
    return wallet_service.get_all_connections()
