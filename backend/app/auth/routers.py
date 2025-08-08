from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.auth.challenge import generate_nonce, get_nonce
from app.auth.signature import verify_signature_and_get_wallet
from app.auth.jwt import create_jwt
from app.services.user import create_or_get_user

router = APIRouter()

class ChallengeRequest(BaseModel):
    wallet_address: str

class VerifyRequest(BaseModel):
    wallet_address: str
    signature: str

@router.post("/auth/request_challenge")
async def request_challenge(data: ChallengeRequest):
    nonce = generate_nonce(data.wallet_address)
    return {"nonce": nonce}

@router.post("/auth/verify")
async def verify(data: VerifyRequest):
    nonce = get_nonce(data.wallet_address)
    if not nonce:
        raise HTTPException(400, "Missing challenge")

    valid = verify_signature_and_get_wallet(data.signature, data.wallet_address, nonce)
    if not valid:
        raise HTTPException(401, "Signature invalid")

    user = create_or_get_user(data.wallet_address)  # returns {user_id, wallet}
    token = create_jwt(user["user_id"], data.wallet_address)
    return {"token": token}
