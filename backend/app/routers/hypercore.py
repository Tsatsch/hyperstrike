from fastapi import APIRouter, HTTPException
import requests


router = APIRouter()

HYPERLIQUID_INFO_API = "https://api.hyperliquid.xyz/info"


@router.post("/hypercore/info")
def proxy_hypercore_info(payload: dict):
    try:
        res = requests.post(HYPERLIQUID_INFO_API, json=payload, timeout=10)
        if not res.ok:
            raise HTTPException(status_code=res.status_code, detail=res.text)
        return res.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"HyperCore upstream error: {e}")


