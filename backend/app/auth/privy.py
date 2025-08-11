import os
import jwt
from fastapi import HTTPException


def _get_privy_jwks_url() -> str:
    # Allow override via env; default to common JWKS path
    return os.getenv("PRIVY_JWKS_URL", "https://www.privy.io/.well-known/jwks.json")


def _get_privy_audience() -> str:
    audience = os.getenv("PRIVY_APP_ID")
    if not audience:
        raise HTTPException(status_code=500, detail="PRIVY_APP_ID is not configured")
    return audience


def verify_privy_token(authorization_header: str) -> dict:
    """
    Verify a Privy-issued JWT using JWKS and return decoded claims.
    Requires env: PRIVY_APP_ID (used as audience) and optionally PRIVY_JWKS_URL.
    """
    if not authorization_header or not authorization_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    token = authorization_header.split(" ", 1)[1]

    # Remove dev bypass for production

    try:
        jwks_url = _get_privy_jwks_url()
        jwks_client = jwt.PyJWKClient(jwks_url)
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256", "ES256"],
            audience=_get_privy_audience(),
            options={"verify_exp": True},
        )
        return claims
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}")


