from app.db.sb import supabase  # your existing Supabase client

def create_or_get_user(wallet_address: str) -> dict:
    # Normalize address (important!)
    wallet_address = wallet_address.lower()

    # Check if user exists
    existing = supabase.table("users").select("user_id").eq("wallet_address", wallet_address).limit(1).execute()
    if existing.error:
        raise Exception(f"Failed to fetch user: {existing.error}")
    
    if existing.data:
        return {"user_id": existing.data[0]["user_id"], "wallet": wallet_address}
    
    # Create new user
    result = supabase.table("users").insert({"wallet_address": wallet_address}).execute()
    if result.error:
        raise Exception(f"Failed to create user: {result.error}")
    
    return {"user_id": result.data[0]["user_id"], "wallet": wallet_address}
