#!/usr/bin/env python3
"""
Test script for hypercore database operations
Run this after setting up the database to verify everything works
"""

import asyncio
import sys
import os

# Add the app directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.services.hypercore import HypercoreService
from app.models.hypercore import (
    UserSubaccountCreate, PreTriggerOrderCreate, PostTriggerPositionCreate
)

async def test_hypercore_db():
    """Test basic hypercore database operations"""
    print("Testing Hypercore Database Operations...")
    print("=" * 50)
    
    # Test 1: Create a user subaccount
    print("\n1. Testing User Subaccount Creation...")
    subaccount_data = UserSubaccountCreate(
        user_id=12,
        user_wallet="0x55ec57bd05991656cae0b8ca423897ce73c856b5",
        sub_account_pubkey="pubkey123",
        sub_account_privkey="privkey123",
        is_active=True
    )
    
    subaccount = await HypercoreService.create_user_subaccount(subaccount_data)
    if subaccount:
        print(f"✅ User subaccount created successfully: ID {subaccount.id}")
    else:
        print("❌ Failed to create user subaccount")
        return
    
    # Test 2: Get user subaccounts
    print("\n2. Testing User Subaccount Retrieval...")
    subaccounts = await HypercoreService.get_user_subaccounts(12)
    if subaccounts:
        print(f"✅ Retrieved {len(subaccounts)} subaccounts for user 12")
        for sub in subaccounts:
            print(f"   - ID: {sub.id}, Wallet: {sub.user_wallet}, Active: {sub.is_active}")
    else:
        print("❌ Failed to retrieve user subaccounts")
    
    # Test 3: Get user credentials (smart filtering)
    print("\n3. Testing User Credentials Retrieval...")
    credentials = await HypercoreService.get_user_credentials(12)
    if credentials:
        print(f"✅ Retrieved user credentials: ID {credentials.id}, Active: {credentials.is_active}")
    else:
        print("❌ Failed to retrieve user credentials")
    
    # Test 4: Create a pre-trigger order
    print("\n4. Testing Pre-trigger Order Creation...")
    order_data = PreTriggerOrderCreate(
        user_id=12,
        user_wallet="0x55ec57bd05991656cae0b8ca423897ce73c856b5",
        trigger_data={"condition": "price_above", "value": 50000},
        position_data={"side": "long", "size": 100, "leverage": 10}
    )
    
    order = await HypercoreService.create_pre_trigger_order(order_data)
    if order:
        print(f"✅ Pre-trigger order created successfully: ID {order.id}")
    else:
        print("❌ Failed to create pre-trigger order")
    
    # Test 5: Get pre-trigger orders
    print("\n5. Testing Pre-trigger Order Retrieval...")
    orders = await HypercoreService.get_pre_trigger_orders(12)
    if orders:
        print(f"✅ Retrieved {len(orders)} pre-trigger orders for user 12")
        for ord in orders:
            print(f"   - ID: {ord.id}, Trigger: {ord.trigger_data}")
    else:
        print("❌ Failed to retrieve pre-trigger orders")
    
    # Test 6: Create a post-trigger position
    print("\n6. Testing Post-trigger Position Creation...")
    position_data = PostTriggerPositionCreate(
        user_id=12,
        user_wallet="0x55ec57bd05991656cae0b8ca423897ce73c856b5",
        cloid="cloid123",
        is_active=True
    )
    
    position = await HypercoreService.create_post_trigger_position(position_data)
    if position:
        print(f"✅ Post-trigger position created successfully: ID {position.id}")
    else:
        print("❌ Failed to create post-trigger position")
    
    # Test 7: Get post-trigger positions
    print("\n7. Testing Post-trigger Position Retrieval...")
    positions = await HypercoreService.get_post_trigger_positions(12)
    if positions:
        print(f"✅ Retrieved {len(positions)} post-trigger positions for user 12")
        for pos in positions:
            print(f"   - ID: {pos.id}, CLOID: {pos.cloid}, Active: {pos.is_active}")
    else:
        print("❌ Failed to retrieve post-trigger positions")
    
    print("\n" + "=" * 50)
    print("✅ All tests completed!")

if __name__ == "__main__":
    asyncio.run(test_hypercore_db())
