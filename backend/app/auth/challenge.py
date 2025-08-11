import uuid

# In production, store in Redis or Supabase
_challenges = {}

def generate_nonce(wallet_address: str) -> str:
    nonce = f"Sign this message to login: {uuid.uuid4()}"
    _challenges[wallet_address.lower()] = nonce
    return nonce

def get_nonce(wallet_address: str) -> str:
    return _challenges.get(wallet_address.lower())
