from eth_account.messages import encode_defunct
from eth_account import Account

def verify_signature_and_get_wallet(signature: str, wallet_address: str, nonce: str) -> bool:
    msg = encode_defunct(text=nonce)
    recovered = Account.recover_message(msg, signature=signature)
    return recovered.lower() == wallet_address.lower()
