from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from app.routers import wallet
from app.routers import orders as orders_router
from app.routers import xp as xp_router
from app.routers import hypercore as hypercore_router
from app.auth import routers as auth_router
from app.services.startup_service import start_background_tasks
import asyncio
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Basic CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://Hypertick-silk.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(wallet.router, prefix="/api", tags=["wallet"])
app.include_router(orders_router.router, prefix="/api", tags=["orders"])
app.include_router(xp_router.router, prefix="/api", tags=["xp"])
app.include_router(hypercore_router.router, prefix="/api", tags=["hypercore"])
app.include_router(auth_router.router, prefix="/api", tags=["auth"])

@app.on_event("startup")
async def start_watchers():
    """Start background tasks including market data subscriptions"""
    try:
        logger.info("Starting background tasks...")
        # Start background tasks in a separate task to avoid blocking startup
        # Don't await this to prevent blocking startup
        asyncio.create_task(start_background_tasks())
        logger.info("Background tasks started successfully")
    except Exception as e:
        logger.error(f"Failed to start background tasks: {e}")
        # Don't raise the exception to prevent startup failure

@app.get("/")
def read_root():
    return {"message": "FastAPI + Hyperliquid orders are live!"}

@app.get("/debug/cors")
def debug_cors():
    """Debug endpoint to check CORS configuration"""
    return {
        "message": "CORS is working!",
        "status": "ok"
    }

@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "message": "Backend is running"
    }