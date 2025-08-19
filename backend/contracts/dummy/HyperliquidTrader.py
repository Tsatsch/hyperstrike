#!/usr/bin/env python3
"""
Hyperliquid Trader Script
Opens positions on Hyperliquid using an agent wallet with API access
"""

import os
import json
import time
import requests
from web3 import Web3
from eth_account import Account
from dotenv import load_dotenv
from typing import Dict, Optional, Tuple

# Load environment variables
load_dotenv('.env')

class HyperliquidTrader:
    def __init__(self, private_key: str, api_key: Optional[str] = None):
        """
        Initialize Hyperliquid Trader
        
        Args:
            private_key: Private key for the agent wallet
            api_key: Optional API key for enhanced rate limits
        """
        self.private_key = private_key
        self.account = Account.from_key(private_key)
        self.api_key = api_key
        
        # Hyperliquid API endpoints
        self.base_url = "https://api.hyperliquid.xyz"
        self.testnet_url = "https://api.hyperliquid-testnet.xyz"
        
        # Use testnet for development, mainnet for production
        self.is_testnet = os.getenv("HYPERLIQUID_TESTNET", "true").lower() == "true"
        self.api_url = self.testnet_url if self.is_testnet else self.base_url
        
        # Available assets for trading
        self.available_assets = {
            "BTC-PERP": {"id": 0, "decimals": 8, "min_size": 0.001},
            "ETH-PERP": {"id": 1, "decimals": 8, "min_size": 0.01},
            "SOL-PERP": {"id": 2, "decimals": 8, "min_size": 0.1},
            "MATIC-PERP": {"id": 3, "decimals": 8, "min_size": 1.0},
            "AVAX-PERP": {"id": 4, "decimals": 8, "min_size": 0.1},
            "ARB-PERP": {"id": 5, "decimals": 8, "min_size": 1.0},
            "SUI-PERP": {"id": 6, "decimals": 8, "min_size": 1.0},
            "APT-PERP": {"id": 7, "decimals": 8, "min_size": 0.1},
            "OP-PERP": {"id": 8, "decimals": 8, "min_size": 0.1},
            "INJ-PERP": {"id": 9, "decimals": 8, "min_size": 0.1}
        }
        
        print(f"🚀 Hyperliquid Trader Initialized")
        print(f"📱 Wallet: {self.account.address}")
        print(f"🌐 Network: {'Testnet' if self.is_testnet else 'Mainnet'}")
        print(f"🔗 API URL: {self.api_url}")
    
    def get_headers(self) -> Dict[str, str]:
        """Get API headers with optional authentication"""
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "HyperTrade-Bot/1.0"
        }
        
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        
        return headers
    
    def get_account_info(self) -> Dict:
        """Get account information and balances"""
        try:
            url = f"{self.api_url}/account/{self.account.address}"
            response = requests.get(url, headers=self.get_headers())
            response.raise_for_status()
            
            account_data = response.json()
            print(f"\n📊 Account Information:")
            print(f"   Address: {self.account.address}")
            print(f"   Total Value: ${account_data.get('totalValue', 0):.2f}")
            print(f"   Available Balance: ${account_data.get('availableBalance', 0):.2f}")
            
            return account_data
            
        except requests.exceptions.RequestException as e:
            print(f"❌ Error getting account info: {e}")
            return {}
    
    def get_market_info(self, asset: str) -> Dict:
        """Get market information for a specific asset"""
        try:
            if asset not in self.available_assets:
                print(f"❌ Asset {asset} not supported")
                return {}
            
            url = f"{self.api_url}/market/{asset}"
            response = requests.get(url, headers=self.get_headers())
            response.raise_for_status()
            
            market_data = response.json()
            print(f"\n📈 Market Information for {asset}:")
            print(f"   Current Price: ${market_data.get('markPrice', 0):.6f}")
            print(f"   24h Change: {market_data.get('24hChange', 0):.2f}%")
            print(f"   24h Volume: ${market_data.get('24hVolume', 0):,.0f}")
            print(f"   Open Interest: ${market_data.get('openInterest', 0):,.0f}")
            
            return market_data
            
        except requests.exceptions.RequestException as e:
            print(f"❌ Error getting market info: {e}")
            return {}
    
    def get_positions(self) -> Dict:
        """Get current open positions"""
        try:
            url = f"{self.api_url}/positions/{self.account.address}"
            response = requests.get(url, headers=self.get_headers())
            response.raise_for_status()
            
            positions = response.json()
            
            if not positions:
                print(f"\n📋 No open positions")
                return {}
            
            print(f"\n📋 Open Positions:")
            for pos in positions:
                asset = pos.get('asset', 'Unknown')
                size = pos.get('size', 0)
                entry_price = pos.get('entryPrice', 0)
                unrealized_pnl = pos.get('unrealizedPnl', 0)
                margin = pos.get('margin', 0)
                
                print(f"   {asset}: {size:.4f} @ ${entry_price:.4f}")
                print(f"     PnL: ${unrealized_pnl:.2f} | Margin: ${margin:.2f}")
            
            return positions
            
        except requests.exceptions.RequestException as e:
            print(f"❌ Error getting positions: {e}")
            return {}
    
    def calculate_position_size(self, usdc_amount: float, asset: str, leverage: float = 1.0) -> float:
        """Calculate position size based on USDC amount and leverage"""
        try:
            # Get current market price
            market_info = self.get_market_info(asset)
            if not market_info:
                return 0
            
            mark_price = market_info.get('markPrice', 0)
            if mark_price == 0:
                print(f"❌ Cannot get market price for {asset}")
                return 0
            
            # Calculate position size
            # Position Size = (USDC Amount × Leverage) ÷ Mark Price
            position_size = (usdc_amount * leverage) / mark_price
            
            # Check minimum size requirement
            min_size = self.available_assets[asset]["min_size"]
            if position_size < min_size:
                print(f"❌ Position size {position_size:.6f} below minimum {min_size}")
                return 0
            
            print(f"\n🧮 Position Calculation:")
            print(f"   USDC Amount: ${usdc_amount:.2f}")
            print(f"   Leverage: {leverage}x")
            print(f"   Market Price: ${mark_price:.6f}")
            print(f"   Position Size: {position_size:.6f} {asset}")
            
            return position_size
            
        except Exception as e:
            print(f"❌ Error calculating position size: {e}")
            return 0
    
    def open_position(self, asset: str, direction: str, size: float, 
                     order_type: str = "market", price: Optional[float] = None,
                     leverage: float = 1.0) -> Dict:
        """
        Open a new position on Hyperliquid
        
        Args:
            asset: Trading asset (e.g., "BTC-PERP")
            direction: "long" or "short"
            size: Position size in base units
            order_type: "market" or "limit"
            price: Limit price (required for limit orders)
            leverage: Leverage multiplier
        
        Returns:
            Order result dictionary
        """
        try:
            if asset not in self.available_assets:
                print(f"❌ Asset {asset} not supported")
                return {}
            
            if direction not in ["long", "short"]:
                print(f"❌ Direction must be 'long' or 'short', got '{direction}'")
                return {}
            
            if order_type == "limit" and price is None:
                print(f"❌ Price required for limit orders")
                return {}
            
            if size <= 0:
                print(f"❌ Position size must be positive")
                return {}
            
            # Validate minimum size
            min_size = self.available_assets[asset]["min_size"]
            if size < min_size:
                print(f"❌ Position size {size:.6f} below minimum {min_size}")
                return {}
            
            print(f"\n🚀 Opening Position:")
            print(f"   Asset: {asset}")
            print(f"   Direction: {direction.upper()}")
            print(f"   Size: {size:.6f}")
            print(f"   Order Type: {order_type.upper()}")
            if price:
                print(f"   Price: ${price:.6f}")
            print(f"   Leverage: {leverage}x")
            
            # Prepare order data
            order_data = {
                "asset": asset,
                "isBuy": direction == "long",
                "sz": size,
                "reduceOnly": False,
                "tif": "GTC",  # Good Till Cancelled
                "cloid": f"ht_{int(time.time())}_{self.account.address[:8]}",  # Unique client order ID
                "leverage": leverage
            }
            
            # Add order type specific data
            if order_type == "market":
                order_data["orderType"] = "market"
            elif order_type == "limit":
                order_data["orderType"] = "limit"
                order_data["limitPx"] = price
            
            # Send order via API
            url = f"{self.api_url}/order"
            response = requests.post(
                url, 
                json=order_data, 
                headers=self.get_headers()
            )
            response.raise_for_status()
            
            order_result = response.json()
            
            if order_result.get("success"):
                print(f"✅ Position opened successfully!")
                print(f"   Order ID: {order_result.get('orderId', 'N/A')}")
                print(f"   Status: {order_result.get('status', 'N/A')}")
                
                # Wait a moment and check position
                time.sleep(2)
                self.get_positions()
                
            else:
                print(f"❌ Failed to open position: {order_result.get('error', 'Unknown error')}")
            
            return order_result
            
        except requests.exceptions.RequestException as e:
            print(f"❌ API Error: {e}")
            return {}
        except Exception as e:
            print(f"❌ Error opening position: {e}")
            return {}
    
    def close_position(self, asset: str, size: Optional[float] = None) -> Dict:
        """
        Close a position (or reduce it)
        
        Args:
            asset: Trading asset to close
            size: Amount to close (None = close entire position)
        
        Returns:
            Order result dictionary
        """
        try:
            # Get current positions
            positions = self.get_positions()
            if not positions:
                print(f"❌ No open positions to close")
                return {}
            
            # Find the specific asset position
            asset_position = None
            for pos in positions:
                if pos.get('asset') == asset:
                    asset_position = pos
                    break
            
            if not asset_position:
                print(f"❌ No open position for {asset}")
                return {}
            
            current_size = asset_position.get('size', 0)
            if current_size == 0:
                print(f"❌ Position size is 0 for {asset}")
                return {}
            
            # Determine close size
            close_size = size if size is not None else current_size
            if close_size > current_size:
                print(f"❌ Cannot close more than current position size {current_size}")
                return {}
            
            print(f"\n🔒 Closing Position:")
            print(f"   Asset: {asset}")
            print(f"   Current Size: {current_size:.6f}")
            print(f"   Close Size: {close_size:.6f}")
            
            # Prepare close order (opposite direction)
            is_long = asset_position.get('isLong', False)
            close_direction = "short" if is_long else "long"
            
            order_data = {
                "asset": asset,
                "isBuy": close_direction == "long",
                "sz": close_size,
                "reduceOnly": True,  # This ensures we're reducing position
                "tif": "GTC",
                "cloid": f"close_{int(time.time())}_{self.account.address[:8]}",
                "orderType": "market"  # Market order for immediate execution
            }
            
            # Send close order
            url = f"{self.api_url}/order"
            response = requests.post(
                url, 
                json=order_data, 
                headers=self.get_headers()
            )
            response.raise_for_status()
            
            order_result = response.json()
            
            if order_result.get("success"):
                print(f"✅ Position closed successfully!")
                print(f"   Order ID: {order_result.get('orderId', 'N/A')}")
                
                # Wait and check updated positions
                time.sleep(2)
                self.get_positions()
                
            else:
                print(f"❌ Failed to close position: {order_result.get('error', 'Unknown error')}")
            
            return order_result
            
        except Exception as e:
            print(f"❌ Error closing position: {e}")
            return {}
    
    def get_order_history(self, limit: int = 10) -> Dict:
        """Get order history for the account"""
        try:
            url = f"{self.api_url}/orders/{self.account.address}?limit={limit}"
            response = requests.get(url, headers=self.get_headers())
            response.raise_for_status()
            
            orders = response.json()
            
            if not orders:
                print(f"\n📜 No order history")
                return {}
            
            print(f"\n📜 Recent Orders (Last {len(orders)}):")
            for order in orders[:limit]:
                asset = order.get('asset', 'Unknown')
                side = "BUY" if order.get('isBuy') else "SELL"
                size = order.get('sz', 0)
                status = order.get('status', 'Unknown')
                timestamp = order.get('timestamp', 0)
                
                print(f"   {asset}: {side} {size:.6f} - {status}")
                if timestamp:
                    print(f"     Time: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(timestamp))}")
            
            return orders
            
        except Exception as e:
            print(f"❌ Error getting order history: {e}")
            return {}

def main():
    """Main function to run the Hyperliquid Trader"""
    print("🚀 Hyperliquid Trader Script")
    print("=" * 50)
    
    # Get configuration from environment
    private_key = os.getenv("PRIVATE_KEY")
    api_key = os.getenv("HYPERLIQUID_API_KEY")
    
    if not private_key:
        print("❌ PRIVATE_KEY not found in environment variables!")
        print("   Please set PRIVATE_KEY in your .env file")
        return
    
    # Safety confirmation
    print("\n🚨 SAFETY WARNING:")
    print("   This script will interact with REAL FUNDS on Hyperliquid!")
    print("   Make sure you understand what you're doing.")
    
    safety_confirm = input("\nType 'I UNDERSTAND' to continue: ").strip()
    if safety_confirm != "I UNDERSTAND":
        print("❌ Safety confirmation failed. Exiting for your protection.")
        return
    
    try:
        # Initialize trader
        trader = HyperliquidTrader(private_key, api_key)
        
        # Show account info
        trader.get_account_info()
        
        # Show available assets
        print(f"\n📊 Available Assets:")
        for asset, info in trader.available_assets.items():
            print(f"   {asset}: Min size {info['min_size']}")
        
        while True:
            print(f"\n" + "="*50)
            print("🎯 HYPERLIQUID TRADER MENU")
            print("="*50)
            print("1. Get Account Information")
            print("2. Get Market Information")
            print("3. Get Current Positions")
            print("4. Open New Position")
            print("5. Close Position")
            print("6. Get Order History")
            print("7. Exit")
            
            choice = input("\nEnter your choice (1-7): ").strip()
            
            if choice == "1":
                trader.get_account_info()
                
            elif choice == "2":
                asset = input("Enter asset (e.g., BTC-PERP): ").strip().upper()
                trader.get_market_info(asset)
                
            elif choice == "3":
                trader.get_positions()
                
            elif choice == "4":
                print(f"\n🚀 Open New Position")
                asset = input("Asset (e.g., BTC-PERP): ").strip().upper()
                direction = input("Direction (long/short): ").strip().lower()
                size_input = input("Size (in base units): ").strip()
                order_type = input("Order Type (market/limit): ").strip().lower()
                
                try:
                    size = float(size_input)
                    
                    price = None
                    if order_type == "limit":
                        price_input = input("Limit Price: ").strip()
                        price = float(price_input)
                    
                    leverage = float(input("Leverage (default 1.0): ").strip() or "1.0")
                    
                    trader.open_position(asset, direction, size, order_type, price, leverage)
                    
                except ValueError:
                    print("❌ Invalid input. Please enter valid numbers.")
                
            elif choice == "5":
                print(f"\n🔒 Close Position")
                asset = input("Asset to close (e.g., BTC-PERP): ").strip().upper()
                size_input = input("Size to close (leave empty for full position): ").strip()
                
                try:
                    size = float(size_input) if size_input else None
                    trader.close_position(asset, size)
                except ValueError:
                    print("❌ Invalid size input.")
                
            elif choice == "6":
                limit_input = input("Number of orders to show (default 10): ").strip()
                limit = int(limit_input) if limit_input else 10
                trader.get_order_history(limit)
                
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
        print("   1. Check your private key")
        print("   2. Verify network connection")
        print("   3. Ensure sufficient balance")
        print("   4. Check API endpoints")

if __name__ == "__main__":
    main()
