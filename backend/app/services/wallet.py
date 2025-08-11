from datetime import datetime, timedelta
from typing import Dict, Optional, List
from app.models.wallet import WalletConnection, WalletResponse

# In-memory store
wallet_connections: Dict[str, WalletConnection] = {}

def store_wallet_connection(address: str) -> WalletResponse:
    now = datetime.now()
    wallet_connections[address] = WalletConnection(
        address=address,
        connected_at=now,
        last_seen=now
    )
    return WalletResponse(address=address, connected=True)

def get_wallet_response(address: Optional[str]) -> WalletResponse:
    if address and address != "0x0000000000000000000000000000000000000000":
        return store_wallet_connection(address)
    return WalletResponse(address="0x0000000000000000000000000000000000000000", connected=False)

def get_wallet_status() -> WalletResponse:
    cutoff_time = datetime.now() - timedelta(hours=1)
    expired = [addr for addr, conn in wallet_connections.items() if conn.last_seen < cutoff_time]
    for addr in expired:
        del wallet_connections[addr]

    if wallet_connections:
        most_recent = max(wallet_connections.values(), key=lambda x: x.last_seen)
        return WalletResponse(address=most_recent.address, connected=True)
    return WalletResponse(address="0x0000000000000000000000000000000000000000", connected=False)

def get_all_connections() -> dict:
    return {
        "connections": list(wallet_connections.keys()),
        "total_connections": len(wallet_connections),
        "connection_details": [
            {
                "address": conn.address,
                "connected_at": conn.connected_at.isoformat(),
                "last_seen": conn.last_seen.isoformat()
            }
            for conn in wallet_connections.values()
        ]
    }
