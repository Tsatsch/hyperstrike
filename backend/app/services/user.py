from app.db.sb import supabase  # your existing Supabase client

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
