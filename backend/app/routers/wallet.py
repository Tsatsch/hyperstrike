from fastapi import APIRouter, Query, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
from app.models.wallet import WalletResponse
from app.services import wallet as wallet_service
from app.services.user import create_or_get_user
from app.db.sb import supabase
from app.auth.privy import verify_privy_token

router = APIRouter()

class UserCreateResponse(BaseModel):
    user_id: int
    wallet: str
    created: bool

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


@router.post("/user", response_model=UserCreateResponse)
async def register_user(wallet: str, authorization: str = Header(None)):
    """Register user if not exists; requires Authorization: Bearer <Privy token>."""
    wallet_norm = wallet.lower()
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    claims = verify_privy_token(authorization)
    # Privy access tokens often do not include a wallet address.
    # Only enforce match if a wallet/address claim is present.
    token_wallet = claims.get("wallet") or claims.get("address")
    if token_wallet and token_wallet.lower() != wallet_norm:
        raise HTTPException(status_code=401, detail="Token-wallet mismatch")
    try:
        existing = (
            supabase.table("users")
            .select("user_id")
            .eq("wallet_address", wallet_norm)
            .limit(1)
            .execute()
        )
        if getattr(existing, "data", None):
            return UserCreateResponse(user_id=existing.data[0]["user_id"], wallet=wallet_norm, created=False)

        user = create_or_get_user(wallet_norm)
        return UserCreateResponse(user_id=user["user_id"], wallet=wallet_norm, created=True)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
