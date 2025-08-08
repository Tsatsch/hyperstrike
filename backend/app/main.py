from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import triggers, wallet
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
app.include_router(triggers.router, prefix="/api", tags=["triggers"])

# @app.on_event("startup")
# async def start_watchers():
#     # Optionally subscribe to some default pairs/intervals
#     await ensure_subscription("@107", "1m")
#     await ensure_subscription("@107", "5m")

@app.get("/")
def read_root():
    return {"message": "FastAPI + Hyperliquid triggers are live!"}
