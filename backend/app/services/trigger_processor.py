import asyncio
import logging
from typing import List, Optional, Dict, Any
from app.db.sb import supabase
from app.models.order import OrderOut
from app.services.orders import update_order_state_for_user, get_open_orders_by_symbol_timeframe
from app.services.gluex import Gluex
import json
import time

logger = logging.getLogger(__name__)

class TriggerProcessor:
    """Processes triggers and executes orders when conditions are met"""
    
    def __init__(self):
        self.web3 = None  # Will be initialized when needed
        self.contract = None  # Will be initialized when needed
    
    def _timeframe_to_ms(self, timeframe: str) -> Optional[int]:
        """Convert timeframe string to milliseconds (same logic as frontend)"""
        if not timeframe:
            return None
        
        tf = timeframe.lower().strip()
        if tf.endswith('m'):
            return int(tf.replace('m', '')) * 60 * 1000
        elif tf.endswith('h'):
            return int(tf.replace('h', '')) * 60 * 60 * 1000
        elif tf.endswith('d'):
            return int(tf.replace('d', '')) * 24 * 60 * 60 * 1000
        return None
    
    def _is_order_expired(self, order: OrderOut) -> bool:
        """Check if an order has expired based on its lifetime"""
        try:
            if not order.orderData or order.orderData.type != "ohlcvTrigger":
                return False
            
            trigger = order.orderData.ohlcvTrigger
            if not trigger or not trigger.lifetime:
                return False
            
            # Convert lifetime to milliseconds
            lifetime_ms = self._timeframe_to_ms(trigger.lifetime)
            if lifetime_ms is None:
                logger.warning(f"Invalid lifetime for order {order.id}: {trigger.lifetime}")
                return False
            
            # Calculate expiration time
            created_time = order.time * 1000  # Convert to milliseconds if needed
            expires_at = created_time + lifetime_ms
            current_time = int(time.time() * 1000)
            
            return current_time >= expires_at
            
        except Exception as e:
            logger.error(f"Error checking expiration for order {order.id}: {e}")
            return False
    
    async def get_open_orders_for_symbol(self, symbol: str, timeframe: str) -> List[OrderOut]:
        """Get all open orders for a specific symbol and timeframe"""
        try:
            return get_open_orders_by_symbol_timeframe(symbol, timeframe)
        except Exception as e:
            logger.error(f"Error fetching orders for {symbol}/{timeframe}: {e}")
            return []
    
    def evaluate_trigger_condition(self, order: OrderOut, candle_data: Dict[str, Any]) -> bool:
        """Evaluate if an order's trigger condition is met"""
        try:
            if not order.orderData or order.orderData.type != "ohlcvTrigger":
                return False
            
            trigger = order.orderData.ohlcvTrigger
            if not trigger:
                return False
            
            # Get the source value from candle data
            source = trigger.source.lower()
            if source == "close":
                value = float(candle_data.get("c", 0))
            elif source == "open":
                value = float(candle_data.get("o", 0))
            elif source == "high":
                value = float(candle_data.get("h", 0))
            elif source == "low":
                value = float(candle_data.get("l", 0))
            elif source == "volume":
                value = float(candle_data.get("v", 0))
            elif source == "trades":
                value = float(candle_data.get("n", 0))
            else:
                logger.warning(f"Unknown source: {source}")
                return False
            
            # Parse trigger value and condition
            try:
                trigger_value = float(trigger.triggerValue)
            except (ValueError, TypeError):
                logger.error(f"Invalid trigger value: {trigger.triggerValue}")
                return False
            
            # Check if condition is met
            trigger_type = trigger.trigger.lower()
            if trigger_type == "above":
                return value > trigger_value
            elif trigger_type == "below":
                return value < trigger_value
            elif trigger_type == "equals":
                return abs(value - trigger_value) < 0.0001  # Small tolerance for floating point
            else:
                logger.warning(f"Unknown trigger type: {trigger_type}")
                return False
                
        except Exception as e:
            logger.error(f"Error evaluating trigger condition for order {order.id}: {e}")
            return False
    
    async def execute_order(self, order: OrderOut, candle_data: Dict[str, Any]) -> bool:
        """Execute an order when its trigger condition is met"""
        try:
            logger.info(f"Executing order {order.id} for user {order.user_id}")
            
            # For now, we'll mark the order as executed
            # In a full implementation, you would:
            # 1. Call the smart contract's withdrawOnTrigger function
            # 2. Execute the actual swap via GlueX or similar
            # 3. Update order state to "done"
            
            # Mark order as executed
            updated_order = update_order_state_for_user(
                order.id, 
                order.user_id, 
                "done", 
                f"Triggered at {candle_data.get('c', 'unknown')} price"
            )
            
            logger.info(f"Order {order.id} executed successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to execute order {order.id}: {e}")
            # Mark order as failed
            try:
                update_order_state_for_user(
                    order.id, 
                    order.user_id, 
                    "closed", 
                    f"Execution failed: {str(e)}"
                )
            except Exception as update_error:
                logger.error(f"Failed to update order state: {update_error}")
            return False
    
    async def process_candle(self, symbol: str, interval: str, candle_data: Dict[str, Any]):
        """Process a closed candle and check for triggered orders"""
        try:
            logger.info(f"Processing candle for {symbol}/{interval}")
            
            # Get all open orders for this symbol/timeframe
            orders = await self.get_open_orders_for_symbol(symbol, interval)
            logger.info(f"Found {len(orders)} open orders for {symbol}/{interval}")
            
            # Filter out expired orders and mark them as closed
            valid_orders = []
            expired_orders = []
            
            for order in orders:
                if self._is_order_expired(order):
                    expired_orders.append(order)
                    logger.info(f"Order {order.id} has expired, marking as closed")
                else:
                    valid_orders.append(order)
            
            # Close expired orders
            for order in expired_orders:
                try:
                    update_order_state_for_user(
                        order.id,
                        order.user_id,
                        "closed",
                        "time ran out"
                    )
                except Exception as e:
                    logger.error(f"Failed to close expired order {order.id}: {e}")
            
            # Process valid orders for triggers
            for order in valid_orders:
                try:
                    if self.evaluate_trigger_condition(order, candle_data):
                        logger.info(f"Order {order.id} trigger condition met, executing...")
                        await self.execute_order(order, candle_data)
                    else:
                        logger.debug(f"Order {order.id} trigger condition not met")
                except Exception as e:
                    logger.error(f"Error processing order {order.id}: {e}")
                    continue
                    
        except Exception as e:
            logger.error(f"Error processing candle for {symbol}/{interval}: {e}")
    
    async def start_processing_loop(self, check_interval: float = 1.0):
        """Start a continuous loop to check for triggered orders"""
        logger.info("Starting trigger processing loop")
        
        while True:
            try:
                # This would be called by the candle watcher
                # For now, we'll just sleep
                await asyncio.sleep(check_interval)
                
            except Exception as e:
                logger.error(f"Error in trigger processing loop: {e}")
                await asyncio.sleep(check_interval)
