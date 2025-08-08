from fastapi import Header, HTTPException
from app.auth.jwt import decode_jwt

def get_current_user(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing Bearer token")
    token = authorization.split(" ")[1]
    try:
        payload = decode_jwt(token)
        return {"user_id": payload["user_id"], "wallet": payload["wallet"]}
    except Exception:
        raise HTTPException(401, "Invalid or expired token")
