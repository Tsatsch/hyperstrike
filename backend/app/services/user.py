from app.db.sb import supabase  # your existing Supabase client
import secrets
import string

def create_or_get_user(wallet_address: str) -> dict:
    # Normalize address (important!)
    wallet_address = wallet_address.lower()

    # Check if user exists
    try:
        existing = (
            supabase.table("users")
            .select("user_id")
            .eq("wallet_address", wallet_address)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise Exception(f"Failed to fetch user: {exc}")
    
    if getattr(existing, "data", None):
        return {"user_id": existing.data[0]["user_id"], "wallet": wallet_address}
    
    # Create new user
    try:
        result = supabase.table("users").insert({"wallet_address": wallet_address}).execute()
    except Exception as exc:
        raise Exception(f"Failed to create user: {exc}")
    if not getattr(result, "data", None):
        raise Exception("Failed to create user: no data returned")
    
    return {"user_id": result.data[0]["user_id"], "wallet": wallet_address}


def get_user_xp(user_id: int) -> int:
    try:
        result = (
            supabase.table("users")
            .select("xp")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if getattr(result, "data", None):
            xp = result.data[0].get("xp")
            return int(xp) if xp is not None else 0
        return 0
    except Exception:
        return 0


def ensure_user_has_xp_column_default(user_id: int) -> None:
    """Best-effort: if xp is null, set it to 0 for the given user."""
    try:
        (
            supabase.table("users")
            .update({"xp": 0})
            .eq("user_id", user_id)
            .is_("xp", None)
            .execute()
        )
    except Exception:
        # Ignore if column does not exist; schema should be migrated separately
        pass


def increment_user_xp(user_id: int, delta: int) -> int:
    """Increment a user's XP by delta and return the new total. Best-effort if column missing."""
    try:
        current = get_user_xp(user_id)
        new_total = max(0, current + int(delta))
        supabase.table("users").update({"xp": new_total}).eq("user_id", user_id).execute()
        return new_total
    except Exception:
        # Ignore if column missing
        return 0


def award_xp_for_trigger(user_id: int, input_symbol: str, input_amount: float, price_usd: float) -> int:
    """Award 1% of USD notional as XP when an order triggers."""
    try:
        usd_notional = max(0.0, float(input_amount)) * max(0.0, float(price_usd))
        xp_delta = int(usd_notional * 0.01)
        return increment_user_xp(user_id, xp_delta)
    except Exception:
        return 0


def _generate_referral_code(length: int = 8) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def ensure_referral_code(user_id: int) -> str:
    try:
        res = supabase.table("users").select("referral_code").eq("user_id", user_id).limit(1).execute()
        if getattr(res, "data", None) and res.data[0].get("referral_code"):
            return res.data[0]["referral_code"]
        # Generate unique code (best-effort; retry few times)
        for _ in range(5):
            code = _generate_referral_code()
            exists = supabase.table("users").select("user_id").eq("referral_code", code).limit(1).execute()
            if not getattr(exists, "data", None):
                supabase.table("users").update({"referral_code": code}).eq("user_id", user_id).execute()
                return code
        # Fallback: use user_id-based code
        code = f"U{user_id:06d}"
        supabase.table("users").update({"referral_code": code}).eq("user_id", user_id).execute()
        return code
    except Exception:
        return ""


def get_user_by_referral_code(code: str) -> dict | None:
    try:
        res = supabase.table("users").select("user_id, wallet_address").eq("referral_code", code).limit(1).execute()
        if getattr(res, "data", None):
            return res.data[0]
        return None
    except Exception:
        return None


def set_referred_by_if_empty(user_id: int, inviter_user_id: int) -> bool:
    if user_id == inviter_user_id:
        return False
    try:
        res = supabase.table("users").select("referred_by_user_id").eq("user_id", user_id).limit(1).execute()
        if not getattr(res, "data", None):
            return False
        if res.data[0].get("referred_by_user_id"):
            return False
        supabase.table("users").update({"referred_by_user_id": inviter_user_id}).eq("user_id", user_id).execute()
        return True
    except Exception:
        return False