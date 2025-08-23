from fastapi import APIRouter, Query, HTTPException, Header, Depends
from pydantic import BaseModel
from typing import Optional
from app.models.wallet import WalletResponse
from app.services import wallet as wallet_service
from app.services.user import (
    create_or_get_user,
    get_user_xp,
    ensure_user_has_xp_column_default,
    ensure_referral_code,
    get_user_by_referral_code,
    set_referred_by_if_empty,
    increment_user_xp,
)
from app.db.sb import supabase
from app.auth.privy import verify_privy_token
from app.auth.session import get_current_user
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

class UserCreateResponse(BaseModel):
    user_id: int
    wallet: str
    created: bool
    xp: Optional[int] = None
    referral_code: Optional[str] = None

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
async def register_user(wallet: str, authorization: str = Header(None), referral: Optional[str] = None):
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
            uid = existing.data[0]["user_id"]
            ensure_user_has_xp_column_default(uid)
            code = ensure_referral_code(uid)
            # If referral code provided on first login, attach inviter
            if referral:
                logger.info("Referral param received for existing user_id=%s: %s", uid, referral)
                inviter = get_user_by_referral_code(referral)
                if inviter:
                    attached = set_referred_by_if_empty(uid, inviter["user_id"])
                    logger.info(
                        "Referral attach attempt for user_id=%s by inviter_user_id=%s: attached=%s",
                        uid,
                        inviter["user_id"],
                        attached,
                    )
                    if attached:
                        increment_user_xp(inviter["user_id"], 200)
            return UserCreateResponse(user_id=uid, wallet=wallet_norm, created=False, xp=get_user_xp(uid), referral_code=code)

        user = create_or_get_user(wallet_norm)
        ensure_user_has_xp_column_default(user["user_id"])
        code = ensure_referral_code(user["user_id"])
        # If referral code provided, attach inviter and reward
        if referral:
            logger.info("Referral param received for new user_id=%s: %s", user["user_id"], referral)
            inviter = get_user_by_referral_code(referral)
            if inviter:
                attached = set_referred_by_if_empty(user["user_id"], inviter["user_id"])
                logger.info(
                    "Referral attach attempt for user_id=%s by inviter_user_id=%s: attached=%s",
                    user["user_id"],
                    inviter["user_id"],
                    attached,
                )
                if attached:
                    increment_user_xp(inviter["user_id"], 200)
        return UserCreateResponse(user_id=user["user_id"], wallet=wallet_norm, created=True, xp=get_user_xp(user["user_id"]), referral_code=code)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


class UserMeResponse(BaseModel):
    user_id: int
    wallet: str
    xp: int
    referral_code: Optional[str] = None


@router.get("/user/me", response_model=UserMeResponse)
async def get_user_me(authorization: str = Header(None), current_user=Depends(get_current_user)):
    try:
        uid = current_user["user_id"]
        wallet = current_user["wallet"]
        ensure_user_has_xp_column_default(uid)
        code = ensure_referral_code(uid)
        return UserMeResponse(user_id=uid, wallet=wallet, xp=get_user_xp(uid), referral_code=code)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
