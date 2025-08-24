#!/usr/bin/env python3
"""
Hyperliquid Trader Script using Official SDK
Simplified and accurate implementation using hyperliquid-python-sdk
"""

import os
import json
import time
from dotenv import load_dotenv
from hyperliquid.info import Info
from hyperliquid.exchange import Exchange
from hyperliquid.utils import constants
from hyperliquid.utils.types import OrderRequest, OrderType, Side

# Load environment variables
load_dotenv('../.env')

class HyperliquidTraderSDK:
    def __init__(self, private_key: str, account_address: str):
        """
        Initialize Hyperliquid Trader using Official SDK
        
        Args:
            private_key: Private key for the coordination wallet
            account_address: Public address of the main wallet
        """
        self.private_key = private_key
        self.account_address = account_address
        
        # Determine network (testnet vs mainnet)
        self.is_testnet = os.getenv("HYPERLIQUID_TESTNET", "true").lower() == "true"
        
        # Initialize SDK components
        if self.is_testnet:
            self.info = Info(constants.TESTNET_API_URL, skip_ws=True)
            self.exchange = Exchange(constants.TESTNET_API_URL, private_key, account_address)
            print(f"🌐 Connected to Hyperliquid TESTNET")
        else:
            self.info = Info(constants.MAINNET_API_URL, skip_ws=True)
            self.exchange = Exchange(constants.MAINNET_API_URL, private_key, account_address)
            print(f"🌐 Connected to Hyperliquid MAINNET")
        
        print(f"📱 Account: {account_address}")
        print(f"🔗 API URL: {constants.TESTNET_API_URL if self.is_testnet else constants.MAINNET_API_URL}")
    
    def get_account_info(self):
        """Get account information using SDK"""
        try:
            user_state = self.info.user_state(self.account_address)
            
            if user_state:
                print(f"\n📊 Account Information:")
                print(f"   Address: {self.account_address}")
                
                # Extract balance information
                if 'assetPositions' in user_state:
                    total_value = 0
                    for asset in user_state['assetPositions']:
                        if asset.get('position'):
                            pos = asset['position']
                            size = pos.get('szi', 0)
                            entry_price = pos.get('entryPx', 0)
                            unrealized_pnl = pos.get('unrealizedPnl', 0)
                            
                            if size != 0:
                                asset_name = asset.get('asset', 'Unknown')
                                print(f"   {asset_name}: {size:.6f} @ ${entry_price:.4f}")
                                print(f"     PnL: ${unrealized_pnl:.2f}")
                                total_value += abs(size * entry_price)
                    
                    print(f"   Total Position Value: ${total_value:.2f}")
                else:
                    print("   No open positions")
                
                return user_state
            else:
                print("❌ Could not fetch account information")
                return None
                
        except Exception as e:
            print(f"❌ Error getting account info: {e}")
            return None
    
    def get_all_assets(self):
        """Get all supported assets using SDK"""
        try:
            # Get universe info
            universe = self.info.universe()
            
            if universe:
                print(f"\n🌍 All Supported Assets ({len(universe)} total):")
                
                for asset in universe:
                    name = asset.get('name', 'Unknown')
                    asset_id = asset.get('id', -1)
                    min_size = asset.get('minSize', 0.001)
                    tick_size = asset.get('tickSize', 0.1)
                    step_size = asset.get('stepSize', 0.001)
                    
                    print(f"   {name}: ID {asset_id} | Min: {min_size} | Tick: {tick_size}")
                
                return universe
            else:
                print("❌ Could not fetch universe information")
                return None
                
        except Exception as e:
            print(f"❌ Error getting assets: {e}")
            return None
    
    def get_market_info(self, asset_name: str):
        """Get market information for specific asset"""
        try:
            # Get meta info for the asset
            meta = self.info.meta()
            
            if meta and 'universe' in meta:
                for asset in meta['universe']:
                    if asset.get('name') == asset_name:
                        print(f"\n📈 Market Information for {asset_name}:")
                        print(f"   Asset ID: {asset.get('id', 'N/A')}")
                        print(f"   Min Size: {asset.get('minSize', 'N/A')}")
                        print(f"   Tick Size: {asset.get('tickSize', 'N/A')}")
                        print(f"   Step Size: {asset.get('stepSize', 'N/A')}")
                        
                        # Get current market data
                        market_data = self.info.l2_book(asset_name)
                        if market_data:
                            best_bid = market_data.get('levels', [{}])[0].get('px', 0) if market_data.get('levels') else 0
                            best_ask = market_data.get('levels', [{}])[0].get('px', 0) if market_data.get('levels') else 0
                            
                            print(f"   Best Bid: ${best_bid:.6f}")
                            print(f"   Best Ask: ${best_ask:.6f}")
                            print(f"   Spread: ${best_ask - best_bid:.6f}")
                        
                        return asset
                
                print(f"❌ Asset {asset_name} not found")
                return None
            else:
                print("❌ Could not fetch market meta information")
                return None
                
        except Exception as e:
            print(f"❌ Error getting market info: {e}")
            return None
    
    def open_position(self, asset_name: str, side: str, size: float, order_type: str = "market", price: float = None):
        """
        Open a new position using SDK
        
        Args:
            asset_name: Trading asset (e.g., "BTC")
            side: "buy" or "sell"
            size: Position size
            order_type: "market" or "limit"
            price: Limit price (required for limit orders)
        """
        try:
            # Validate inputs
            if side not in ["buy", "sell"]:
                print(f"❌ Side must be 'buy' or 'sell', got '{side}'")
                return None
            
            if size <= 0:
                print(f"❌ Size must be positive")
                return None
            
            if order_type == "limit" and price is None:
                print(f"❌ Price required for limit orders")
                return None
            
            print(f"\n🚀 Opening Position:")
            print(f"   Asset: {asset_name}")
            print(f"   Side: {side.upper()}")
            print(f"   Size: {size:.6f}")
            print(f"   Order Type: {order_type.upper()}")
            if price:
                print(f"   Price: ${price:.6f}")
            
            # Create order request
            order_request = OrderRequest(
                coin=asset_name,
                is_buy=side == "buy",
                sz=size,
                limit_px=price if order_type == "limit" else None,
                order_type=OrderType.LIMIT if order_type == "limit" else OrderType.MARKET,
                reduce_only=False
            )
            
            # Submit order
            result = self.exchange.order(order_request)
            
            if result:
                print(f"✅ Position opened successfully!")
                print(f"   Order ID: {result.get('hash', 'N/A')}")
                print(f"   Status: {result.get('status', 'N/A')}")
                
                # Wait and check updated positions
                time.sleep(2)
                self.get_account_info()
                
                return result
            else:
                print(f"❌ Failed to open position")
                return None
                
        except Exception as e:
            print(f"❌ Error opening position: {e}")
            return None
    
    def close_position(self, asset_name: str, size: float = None):
        """
        Close a position using SDK
        
        Args:
            asset_name: Trading asset to close
            size: Amount to close (None = close entire position)
        """
        try:
            # Get current positions
            user_state = self.info.user_state(self.account_address)
            
            if not user_state or 'assetPositions' not in user_state:
                print(f"❌ No positions found")
                return None
            
            # Find the specific asset position
            asset_position = None
            for asset in user_state['assetPositions']:
                if asset.get('asset') == asset_name and asset.get('position'):
                    asset_position = asset['position']
                    break
            
            if not asset_position:
                print(f"❌ No open position for {asset_name}")
                return None
            
            current_size = asset_position.get('szi', 0)
            if current_size == 0:
                print(f"❌ Position size is 0 for {asset_name}")
                return None
            
            # Determine close size
            close_size = size if size is not None else abs(current_size)
            if close_size > abs(current_size):
                print(f"❌ Cannot close more than current position size {abs(current_size)}")
                return None
            
            print(f"\n🔒 Closing Position:")
            print(f"   Asset: {asset_name}")
            print(f"   Current Size: {current_size:.6f}")
            print(f"   Close Size: {close_size:.6f}")
            
            # Determine close side (opposite of current position)
            close_side = "sell" if current_size > 0 else "buy"
            
            # Create close order
            order_request = OrderRequest(
                coin=asset_name,
                is_buy=close_side == "buy",
                sz=close_size,
                order_type=OrderType.MARKET,
                reduce_only=True  # This ensures we're reducing position
            )
            
            # Submit order
            result = self.exchange.order(order_request)
            
            if result:
                print(f"✅ Position closed successfully!")
                print(f"   Order ID: {result.get('hash', 'N/A')}")
                
                # Wait and check updated positions
                time.sleep(2)
                self.get_account_info()
                
                return result
            else:
                print(f"❌ Failed to close position")
                return None
                
        except Exception as e:
            print(f"❌ Error closing position: {e}")
            return None
    
    def get_positions(self):
        """Get current open positions using SDK"""
        try:
            user_state = self.info.user_state(self.account_address)
            
            if not user_state or 'assetPositions' not in user_state:
                print(f"\n📋 No open positions")
                return []
            
            positions = []
            print(f"\n📋 Open Positions:")
            
            for asset in user_state['assetPositions']:
                if asset.get('position'):
                    pos = asset['position']
                    size = pos.get('szi', 0)
                    
                    if size != 0:  # Only show non-zero positions
                        asset_name = asset.get('asset', 'Unknown')
                        entry_price = pos.get('entryPx', 0)
                        unrealized_pnl = pos.get('unrealizedPnl', 0)
                        
                        print(f"   {asset_name}: {size:.6f} @ ${entry_price:.4f}")
                        print(f"     PnL: ${unrealized_pnl:.2f}")
                        
                        positions.append({
                            'asset': asset_name,
                            'size': size,
                            'entry_price': entry_price,
                            'unrealized_pnl': unrealized_pnl
                        })
            
            if not positions:
                print("   No open positions")
            
            return positions
            
        except Exception as e:
            print(f"❌ Error getting positions: {e}")
            return []

def main():
    """Main function to run the Hyperliquid Trader SDK"""
    print("🚀 Hyperliquid Trader Script (Official SDK)")
    print("=" * 60)
    
    # Get configuration from environment
    private_key = os.getenv("PRIVATE_KEY")
    account_address = os.getenv("DEPLOYMENT_WALLET_PUBKEY")
    
    if not private_key:
        print("❌ PRIVATE_KEY not found in environment variables!")
        print("   Please set PRIVATE_KEY in your .env file")
        return
    
    if not account_address:
        print("❌ DEPLOYMENT_WALLET_PUBKEY not found in environment variables!")
        print("   Please set DEPLOYMENT_WALLET_PUBKEY in your .env file")
        return
    
    # Network Status
    network_status = "TESTNET" if os.getenv("HYPERLIQUID_TESTNET", "true").lower() == "true" else "MAINNET"
    print(f"\n🌐 NETWORK STATUS: {network_status}")
    if network_status == "TESTNET":
        print("   ✅ Running on Hyperliquid Testnet (safe for testing)")
    else:
        print("   🚨 Running on Hyperliquid Mainnet (real funds)")
    
    try:
        # Initialize trader
        trader = HyperliquidTraderSDK(private_key, account_address)
        
        # Show account info
        trader.get_account_info()
        
        # Show all available assets
        trader.get_all_assets()
        
        while True:
            print(f"\n" + "="*60)
            print("🎯 HYPERLIQUID TRADER SDK MENU")
            print("="*60)
            print("1. Get Account Information")
            print("2. Get Market Information")
            print("3. Get Current Positions")
            print("4. Open New Position")
            print("5. Close Position")
            print("6. Get All Supported Assets")
            print("7. Exit")
            
            choice = input("\nEnter your choice (1-7): ").strip()
            
            if choice == "1":
                trader.get_account_info()
                
            elif choice == "2":
                asset = input("Enter asset (e.g., BTC): ").strip().upper()
                trader.get_market_info(asset)
                
            elif choice == "3":
                trader.get_positions()
                
            elif choice == "4":
                print(f"\n🚀 Open New Position")
                asset = input("Asset (e.g., BTC): ").strip().upper()
                side = input("Side (buy/sell): ").strip().lower()
                size_input = input("Size: ").strip()
                order_type = input("Order Type (market/limit): ").strip().lower()
                
                try:
                    size = float(size_input)
                    
                    price = None
                    if order_type == "limit":
                        price_input = input("Limit Price: ").strip()
                        price = float(price_input)
                    
                    trader.open_position(asset, side, size, order_type, price)
                    
                except ValueError:
                    print("❌ Invalid input. Please enter valid numbers.")
                
            elif choice == "5":
                print(f"\n🔒 Close Position")
                asset = input("Asset to close (e.g., BTC): ").strip().upper()
                size_input = input("Size to close (leave empty for full position): ").strip()
                
                try:
                    size = float(size_input) if size_input else None
                    trader.close_position(asset, size)
                except ValueError:
                    print("❌ Invalid size input.")
                
            elif choice == "6":
                trader.get_all_assets()
                
            elif choice == "7":
                print("👋 Goodbye!")
                break
                
            else:
                print("❌ Invalid choice. Please enter 1-7.")
                
            # Wait before showing menu again
            input("\nPress Enter to continue...")
            
    except KeyboardInterrupt:
        print("\n\n👋 Operation cancelled by user.")
    except Exception as e:
        print(f"\n💥 Script failed: {e}")
        print("\n🔧 Troubleshooting:")
        print("   1. Check your private key and account address")
        print("   2. Verify network connection")
        print("   3. Ensure sufficient balance")
        print("   4. Check SDK installation")

if __name__ == "__main__":
    main()
