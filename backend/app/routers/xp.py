from fastapi import APIRouter, Depends, HTTPException
from app.auth.session import get_current_user
from app.services.user import get_user_xp, ensure_user_has_xp_column_default, increment_user_xp
from app.db.sb import supabase
from datetime import datetime, timezone, timedelta


router = APIRouter()


@router.get("/xp")
async def get_xp(current_user=Depends(get_current_user)):
    try:
        user_id = current_user["user_id"]
        ensure_user_has_xp_column_default(user_id)
        xp = get_user_xp(user_id)
        return {"xp": xp}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@router.get("/xp/leaderboard")
async def xp_leaderboard(limit: int = 50):
    try:
        res = (
            supabase.table("users")
            .select("user_id, wallet_address, xp")
            .order("xp", desc=True)
            .limit(limit)
            .execute()
        )
        return {"leaders": res.data or []}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/xp/daily_claim")
async def xp_daily_claim(current_user=Depends(get_current_user)):
    """Grant 10 XP once per 24h. Requires users.last_daily_xp_at TIMESTAMP column."""
    try:
        user_id = current_user["user_id"]
        ensure_user_has_xp_column_default(user_id)
        now = datetime.now(timezone.utc)
        # Read last claim
        res = (
            supabase.table("users")
            .select("last_daily_xp_at")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        last_raw = None
        if getattr(res, "data", None):
            last_raw = res.data[0].get("last_daily_xp_at")
        last = None
        if last_raw:
            try:
                # Supabase returns ISO string; handle 'Z'
                last = datetime.fromisoformat(last_raw.replace('Z', '+00:00'))
            except Exception:
                last = None
        eligible = (last is None) or ((now - last) >= timedelta(hours=24))
        if not eligible:
            next_eligible = (last + timedelta(hours=24)) if last else (now + timedelta(hours=24))
            return {"awarded": 0, "nextEligibleAt": next_eligible.isoformat()}
        # Award and update timestamp
        increment_user_xp(user_id, 10)
        supabase.table("users").update({"last_daily_xp_at": now.isoformat()}).eq("user_id", user_id).execute()
        return {"awarded": 10}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
