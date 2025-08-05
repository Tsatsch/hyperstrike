from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta

router = APIRouter()

class WalletResponse(BaseModel):
    address: str
    connected: bool

class WalletConnection(BaseModel):
    address: str
    connected_at: datetime
    last_seen: datetime

# In-memory storage for wallet connections
wallet_connections = {}

@router.get("/test")
async def test_endpoint():
    """Test endpoint to verify the backend is working"""
    return {"message": "Backend is working!", "status": "ok"}

@router.get("/wallet", response_model=WalletResponse)
async def get_wallet_address(address: Optional[str] = Query(None, description="Wallet address from frontend")):
    """
    Get the connected wallet address.
    Returns the provided address if connected, otherwise returns default address.
    """
    print(f"Backend received wallet request with address: {address}")
    
    if address and address != "0x0000000000000000000000000000000000000000":
        # Store the wallet connection
        now = datetime.now()
        wallet_connections[address] = WalletConnection(
            address=address,
            connected_at=now,
            last_seen=now
        )
        print(f"Stored wallet connection: {address}")
        
        response = WalletResponse(
            address=address,
            connected=True
        )
        print(f"Backend returning connected wallet: {response}")
        return response
    else:
        response = WalletResponse(
            address="0x0000000000000000000000000000000000000000",
            connected=False
        )
        print(f"Backend returning disconnected wallet: {response}")
        return response

@router.get("/wallet/status")
async def get_wallet_status():
    """
    Get the current wallet connection status.
    Returns the most recently connected wallet or default if none connected.
    """
    # Clean up old connections (older than 1 hour)
    cutoff_time = datetime.now() - timedelta(hours=1)
    expired_addresses = [
        addr for addr, conn in wallet_connections.items() 
        if conn.last_seen < cutoff_time
    ]
    for addr in expired_addresses:
        del wallet_connections[addr]
    
    if wallet_connections:
        # Get the most recently seen wallet
        most_recent = max(wallet_connections.values(), key=lambda x: x.last_seen)
        return WalletResponse(
            address=most_recent.address,
            connected=True
        )
    else:
        return WalletResponse(
            address="0x0000000000000000000000000000000000000000",
            connected=False
        )

@router.get("/wallet/connections")
async def get_all_connections():
    """
    Get all active wallet connections (for debugging).
    """
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