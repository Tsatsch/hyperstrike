from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import wallet
from app.routers import orders as orders_router
from app.routers import xp as xp_router
from app.auth import routers as auth_router
from app.services.candle_watcher import ensure_subscription

import asyncio

app = FastAPI()
#
# Allow frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(wallet.router, prefix="/api", tags=["wallet"])
app.include_router(orders_router.router, prefix="/api", tags=["orders"])
app.include_router(xp_router.router, prefix="/api", tags=["xp"])
app.include_router(auth_router.router, prefix="/api", tags=["auth"])

# @app.on_event("startup")
# async def start_watchers():
#     # Optionally subscribe to some default pairs/intervals
#     await ensure_subscription("@107", "1m")
#     await ensure_subscription("@107", "5m")

@app.get("/")
def read_root():
    return {"message": "FastAPI + Hyperliquid triggers are live!"}

