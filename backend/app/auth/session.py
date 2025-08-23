from fastapi import Header, HTTPException
from app.auth.jwt import decode_jwt

def get_current_user(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing Bearer token")
    token = authorization.split(" ")[1]

    try:
        payload = decode_jwt(token)
    except Exception:
        raise HTTPException(401, "Invalid or expired token")

    # Case 1: System worker token
    if payload.get("sub") == "system_worker":
        return {"role": "system"}

    # Case 2: Normal user token
    if "user_id" not in payload or "wallet" not in payload:
        raise HTTPException(401, "Malformed user token")

    return {
        "user_id": payload["user_id"],
        "wallet": payload["wallet"],
        "role": "user"
    }
