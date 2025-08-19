#!/usr/bin/env python3
"""
Test script to verify the trigger system is working
"""
import asyncio
import logging
import sys
import os

# Add the app directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app.services.trigger_processor import TriggerProcessor
from app.models.order import OrderOut, OrderData, OhlcvTriggerData, SwapData

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def test_trigger_evaluation():
    """Test trigger condition evaluation"""
    processor = TriggerProcessor()
    
    # Create a test order
    test_order = OrderOut(
        id=1,
        user_id=1,
        wallet="0x1234567890123456789012345678901234567890",
        platform="hyperevm",
        swapData=SwapData(
            inputToken="0x1234567890123456789012345678901234567890",
            inputAmount=100.0
        ),
        orderData=OrderData(
            type="ohlcvTrigger",
            ohlcvTrigger=OhlcvTriggerData(
                pair="BTC",
                timeframe="1m",
                source="close",
                trigger="above",
                triggerValue="50000"
            )
        ),
        signature=None,
        time=1234567890,
        state="open"
    )
    
    # Test candle data
    test_candle = {
        "s": "BTC",
        "i": "1m",
        "o": "49000",
        "h": "51000",
        "l": "48000",
        "c": "52000",  # Above 50000
        "v": "1000",
        "n": "500"
    }
    
    # Test trigger evaluation
    result = processor.evaluate_trigger_condition(test_order, test_candle)
    logger.info(f"Trigger evaluation result: {result}")
    
    # Test with price below threshold
    test_candle_below = test_candle.copy()
    test_candle_below["c"] = "48000"  # Below 50000
    result_below = processor.evaluate_trigger_condition(test_order, test_candle_below)
    logger.info(f"Trigger evaluation result (below): {result_below}")
    
    # Test different sources
    test_order_volume = OrderOut(
        id=2,
        user_id=1,
        wallet="0x1234567890123456789012345678901234567890",
        platform="hyperevm",
        swapData=SwapData(
            inputToken="0x1234567890123456789012345678901234567890",
            inputAmount=100.0
        ),
        orderData=OrderData(
            type="ohlcvTrigger",
            ohlcvTrigger=OhlcvTriggerData(
                pair="BTC",
                timeframe="1m",
                source="volume",
                trigger="above",
                triggerValue="500"
            )
        ),
        signature=None,
        time=1234567890,
        state="open"
    )
    
    result_volume = processor.evaluate_trigger_condition(test_order_volume, test_candle)
    logger.info(f"Volume trigger evaluation result: {result_volume}")
    
    return result and not result_below and result_volume

async def test_order_processing():
    """Test order processing with a mock candle"""
    processor = TriggerProcessor()
    
    # Mock candle data
    mock_candle = {
        "s": "BTC",
        "i": "1m",
        "o": "49000",
        "h": "51000",
        "l": "48000",
        "c": "52000",
        "v": "1000",
        "n": "500"
    }
    
    # Process the candle (this will check for orders in the database)
    await processor.process_candle("BTC", "1m", mock_candle)

async def main():
    """Main test function"""
    logger.info("Starting trigger system tests...")
    
    try:
        # Test trigger evaluation
        logger.info("Testing trigger evaluation...")
        eval_result = await test_trigger_evaluation()
        
        if eval_result:
            logger.info("✅ Trigger evaluation tests passed!")
        else:
            logger.error("❌ Trigger evaluation tests failed!")
            return False
        
        # Test order processing (this will check the database)
        logger.info("Testing order processing...")
        await test_order_processing()
        logger.info("✅ Order processing test completed!")
        
        logger.info("🎉 All tests completed successfully!")
        return True
        
    except Exception as e:
        logger.error(f"❌ Test failed with error: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
