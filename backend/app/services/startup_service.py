import asyncio
import logging
from typing import Set, Tuple
from app.services.orders import get_all_open_orders
from app.services.swap import process_swaps
from app.services.candle_watcher import ensure_subscription
import time
import os

logger = logging.getLogger(__name__)

DEV_MODE = os.getenv("DEV_MODE", "true").lower() == "true"
CLEANUP_INTERVAL_SEC = int(os.getenv("CLEANUP_INTERVAL_SEC", "30" if not DEV_MODE else "180"))

class StartupService:
    """Service to handle startup tasks like subscribing to required market data"""
    
    @staticmethod
    async def get_required_subscriptions() -> Set[Tuple[str, str]]:
        """Get all symbol/timeframe combinations that have open orders"""
        try:
            subscriptions = set()
            orders = get_all_open_orders()
            for order in orders:
                try:
                    if (order.order_data and
                        order.order_data.type == "ohlcvTrigger" and
                        order.order_data.ohlcv_trigger and
                        order.order_data.ohlcv_trigger.pair and
                        order.order_data.ohlcv_trigger.timeframe):
                        symbol = order.order_data.ohlcv_trigger.pair
                        timeframe = order.order_data.ohlcv_trigger.timeframe
                        subscriptions.add((symbol, timeframe))
                except Exception:
                    continue
            return subscriptions
        except Exception as e:
            logger.error(f"Error getting required subscriptions: {e}")
            return set()
    
    @staticmethod
    async def start_required_subscriptions():
        try:
            logger.info("Starting required market data subscriptions...")
            subscriptions = await StartupService.get_required_subscriptions()
            logger.info(f"Found {len(subscriptions)} required subscriptions")
            for symbol, timeframe in subscriptions:
                try:
                    await ensure_subscription(symbol, timeframe)

                except Exception as e:
                    logger.error(f"Failed to start subscription for {symbol}/{timeframe}: {e}")
                    continue
            logger.info("Finished starting required subscriptions")
        except Exception as e:
            logger.error(f"Error starting required subscriptions: {e}")
    
    @staticmethod
    def _timeframe_to_ms(timeframe: str) -> int:
        if not timeframe:
            return 0
        tf = timeframe.lower().strip()
        if tf.endswith('m'):
            return int(tf.replace('m', '')) * 60 * 1000
        elif tf.endswith('h'):
            return int(tf.replace('h', '')) * 60 * 60 * 1000
        elif tf.endswith('d'):
            return int(tf.replace('d', '')) * 24 * 60 * 60 * 1000
        return 0
    
    @staticmethod
    async def cleanup_expired_orders():
        try:
            logger.info(f"Starting expired order cleanup task (interval={CLEANUP_INTERVAL_SEC}s, dev={DEV_MODE})...")
            while True:
                try:
                    # Check if database connection is available
                    from app.db.sb import supabase
                    if not supabase:
                        logger.warning("Database connection not available, skipping cleanup cycle")
                        await asyncio.sleep(CLEANUP_INTERVAL_SEC)
                        continue
                    
                    from app.services.orders import get_all_open_orders
                    from app.services.orders import update_order_state_for_user
                    current_time = int(time.time() * 1000)
                    expired_count = 0
                    
                    try:
                        orders = get_all_open_orders()
                    except Exception as db_error:
                        logger.error(f"Database error in cleanup task: {db_error}")
                        await asyncio.sleep(max(60, CLEANUP_INTERVAL_SEC))
                        continue
                    
                    for order in orders:
                        try:
                            if (order.order_data and 
                                order.order_data.type == "ohlcvTrigger" and
                                order.order_data.ohlcv_trigger and
                                order.order_data.ohlcv_trigger.lifetime):
                                lifetime_ms = StartupService._timeframe_to_ms(order.order_data.ohlcv_trigger.lifetime)
                                if lifetime_ms > 0:
                                    created_time = order.time * 1000
                                    expires_at = created_time + lifetime_ms
                                    if current_time >= expires_at:
                                        update_order_state_for_user(
                                            order.id,
                                            order.user_id,
                                            "done_failed",
                                            "time ran out"
                                        )
                                        expired_count += 1
                                        logger.info(f"Marked expired order {order.id} as failed (created: {created_time}, expired: {expires_at}, current: {current_time})")
                        except Exception as e:
                            logger.error(f"Error processing order {order.id}: {e}")
                            continue
                    if expired_count > 0:
                        logger.info(f"Cleaned up {expired_count} expired orders")
                    await asyncio.sleep(CLEANUP_INTERVAL_SEC)
                except Exception as e:
                    logger.error(f"Error in cleanup task: {e}")
                    await asyncio.sleep(max(60, CLEANUP_INTERVAL_SEC))
        except Exception as e:
            logger.error(f"Error starting cleanup task: {e}")
    
    @staticmethod
    async def run_startup_tasks():
        try:
            logger.info("Running startup tasks...")
            await StartupService.start_required_subscriptions()
            asyncio.create_task(StartupService.cleanup_expired_orders())
            logger.info("Startup tasks completed successfully")
        except Exception as e:
            logger.error(f"Error running startup tasks: {e}")

async def start_background_tasks():
    try:
        logger.info("Starting background tasks...")
        await StartupService.run_startup_tasks()
        asyncio.create_task(process_swaps())
        logger.info("Background tasks started successfully")
    except Exception as e:
        logger.error(f"Error starting background tasks: {e}")
