import jwt
from datetime import datetime, timedelta

SECRET = "to paste later"
ALGORITHM = "HS256"

def create_jwt(user_id: int, wallet: str) -> str:
    payload = {
        "user_id": user_id,
        "wallet": wallet,
        "exp": datetime.utcnow() + timedelta(days=7)
    }
    return jwt.encode(payload, SECRET, algorithm=ALGORITHM)

def decode_jwt(token: str) -> dict:
    return jwt.decode(token, SECRET, algorithms=[ALGORITHM])
