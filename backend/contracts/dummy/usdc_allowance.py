#!/usr/bin/env python3
"""
USDC Allowance Script for PriceTriggerSwap Contract
This script gives allowance for USDC (PURR token) to the PriceTriggerSwap contract
and checks if the allowance is properly set.
"""

import os
import sys
from web3 import Web3
from eth_account import Account
from eth_account.signers.local import LocalAccount

# Configuration
HYPER_EVM_TESTNET_RPC = "https://hyperliquid-testnet.core.chainstack.com/f3ce6117a8d9cc6b9908d471f15d1686/evm"
PURR_TOKEN_ADDRESS = "0xa9056c15938f9aff34cd497c722ce33db0c2fd57"  # USDC (PURR) on HyperEVM testnet
PRICE_TRIGGER_SWAP_ADDRESS = "0x665D96a9737C4C06f9e885FC6fC03dFB97FB0FCB"  # Replace with actual deployed address

# Dummy private key (REPLACE WITH YOUR ACTUAL PRIVATE KEY)
DUMMY_PRIVATE_KEY = "0xe469510e586a6e0d982e137bc49d2aefef5dd76b36b8db64cb22af2ab8649eae"

# USDC (PURR) Token ABI - Minimal ABI for allowance operations
PURR_ABI = [
    {
        "constant": True,
        "inputs": [
            {"name": "_owner", "type": "address"},
            {"name": "_spender", "type": "address"}
        ],
        "name": "allowance",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function"
    },
    {
        "constant": False,
        "inputs": [
            {"name": "_spender", "type": "address"},
            {"name": "_value", "type": "uint256"}
        ],
        "name": "approve",
        "outputs": [{"name": "", "type": "bool"}],
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [],
        "name": "symbol",
        "outputs": [{"name": "", "type": "string"}],
        "type": "function"
    }
]

# PriceTriggerSwap Contract ABI - Minimal ABI for allowance operations
PRICE_TRIGGER_SWAP_ABI = [
    {
        "constant": True,
        "inputs": [
            {"name": "user", "type": "address"},
            {"name": "token", "type": "address"}
        ],
        "name": "getApprovedAmount",
        "outputs": [{"name": "amount", "type": "uint256"}],
        "type": "function"
    },
    {
        "constant": False,
        "inputs": [
            {"name": "token", "type": "address"},
            {"name": "amount", "type": "uint256"}
        ],
        "name": "approveTokens",
        "outputs": [],
        "type": "function"
    }
]

class USDCAllowanceManager:
    def __init__(self, private_key: str):
        """Initialize the USDC Allowance Manager"""
        self.private_key = private_key
        self.account: LocalAccount = Account.from_key(private_key)
        self.w3 = Web3(Web3.HTTPProvider(HYPER_EVM_TESTNET_RPC))
        
        # Check connection
        if not self.w3.is_connected():
            raise Exception("Failed to connect to HyperEVM testnet")
        
        print(f"✅ Connected to HyperEVM testnet")
        print(f"📱 Wallet address: {self.account.address}")
        print(f"🔗 RPC URL: {HYPER_EVM_TESTNET_RPC}")
        
        # Initialize contracts with checksum addresses
        self.purr_contract = self.w3.eth.contract(
            address=Web3.to_checksum_address(PURR_TOKEN_ADDRESS),
            abi=PURR_ABI
        )
        
        # Note: PriceTriggerSwap contract needs to be deployed first
        if PRICE_TRIGGER_SWAP_ADDRESS != "0x0000000000000000000000000000000000000000":
            self.price_trigger_swap_contract = self.w3.eth.contract(
                address=Web3.to_checksum_address(PRICE_TRIGGER_SWAP_ADDRESS),
                abi=PRICE_TRIGGER_SWAP_ABI
            )
        else:
            self.price_trigger_swap_contract = None
            print("⚠️  PriceTriggerSwap contract not deployed yet - set PRICE_TRIGGER_SWAP_ADDRESS")
    
    def get_purr_info(self):
        """Get PURR token information"""
        try:
            symbol = self.purr_contract.functions.symbol().call()
            decimals = self.purr_contract.functions.decimals().call()
            balance = self.purr_contract.functions.balanceOf(self.account.address).call()
            
            print(f"\n📊 PURR Token Info:")
            print(f"   Symbol: {symbol}")
            print(f"   Decimals: {decimals}")
            print(f"   Balance: {balance / (10 ** decimals):.6f} {symbol}")
            
            return symbol, decimals, balance
        except Exception as e:
            print(f"❌ Error getting PURR info: {e}")
            return None, None, None
    
    def check_current_allowance(self, spender_address: str):
        """Check current allowance for a spender"""
        try:
            # Convert to checksum address
            spender_checksum = Web3.to_checksum_address(spender_address)
            allowance = self.purr_contract.functions.allowance(
                self.account.address,
                spender_checksum
            ).call()
            
            decimals = self.purr_contract.functions.decimals().call()
            formatted_allowance = allowance / (10 ** decimals)
            
            print(f"\n🔍 Current Allowance:")
            print(f"   Spender: {spender_address}")
            print(f"   Amount: {formatted_allowance:.6f} PURR")
            print(f"   Raw Amount: {allowance}")
            
            return allowance
        except Exception as e:
            print(f"❌ Error checking allowance: {e}")
            return 0
    
    def give_allowance(self, spender_address: str, amount: int):
        """Give allowance to a spender"""
        try:
            # Convert to checksum address
            spender_checksum = Web3.to_checksum_address(spender_address)
            print(f"\n🚀 Giving allowance...")
            print(f"   Spender: {spender_checksum}")
            print(f"   Amount: {amount}")
            
            # Build approve transaction
            approve_txn = self.purr_contract.functions.approve(
                spender_checksum,
                amount
            ).build_transaction({
                'from': self.account.address,
                'nonce': self.w3.eth.get_transaction_count(self.account.address),
                'gas': 100000,  # Standard gas limit for approve
                'gasPrice': self.w3.eth.gas_price
            })
            
            # Sign and send transaction
            signed_txn = self.w3.eth.account.sign_transaction(approve_txn, self.private_key)
            tx_hash = self.w3.eth.send_raw_transaction(signed_txn.rawTransaction)
            
            print(f"   Transaction hash: {tx_hash.hex()}")
            print(f"   Waiting for confirmation...")
            
            # Wait for confirmation
            tx_receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
            
            if tx_receipt.status == 1:
                print(f"   ✅ Allowance granted successfully!")
                return True
            else:
                print(f"   ❌ Transaction failed!")
                return False
                
        except Exception as e:
            print(f"❌ Error giving allowance: {e}")
            return False
    
    def check_price_trigger_swap_allowance(self):
        """Check allowance specifically for PriceTriggerSwap contract"""
        if not self.price_trigger_swap_contract:
            print("\n⚠️  Cannot check PriceTriggerSwap allowance - contract not deployed")
            return
        
        try:
            # Check allowance through PriceTriggerSwap contract
            allowance = self.price_trigger_swap_contract.functions.getApprovedAmount(
                self.account.address,
                Web3.to_checksum_address(PURR_TOKEN_ADDRESS)
            ).call()
            
            decimals = self.purr_contract.functions.decimals().call()
            formatted_allowance = allowance / (10 ** decimals)
            
            print(f"\n🔍 PriceTriggerSwap Contract Allowance:")
            print(f"   Amount: {formatted_allowance:.6f} PURR")
            print(f"   Raw Amount: {allowance}")
            
            return allowance
        except Exception as e:
            print(f"❌ Error checking PriceTriggerSwap allowance: {e}")
            return 0
    
    def approve_tokens_for_price_trigger_swap(self, amount: int):
        """Approve tokens specifically for PriceTriggerSwap contract"""
        if not self.price_trigger_swap_contract:
            print("\n⚠️  Cannot approve for PriceTriggerSwap - contract not deployed")
            return False
        
        try:
            print(f"\n🚀 Approving tokens for PriceTriggerSwap contract...")
            print(f"   Amount: {amount}")
            
            # Build approveTokens transaction
            approve_txn = self.price_trigger_swap_contract.functions.approveTokens(
                Web3.to_checksum_address(PURR_TOKEN_ADDRESS),
                amount
            ).build_transaction({
                'from': self.account.address,
                'nonce': self.w3.eth.get_transaction_count(self.account.address),
                'gas': 150000,  # Higher gas limit for contract interaction
                'gasPrice': self.w3.eth.gas_price
            })
            
            # Sign and send transaction
            signed_txn = self.w3.eth.account.sign_transaction(approve_txn, self.private_key)
            tx_hash = self.w3.eth.send_raw_transaction(signed_txn.rawTransaction)
            
            print(f"   Transaction hash: {tx_hash.hex()}")
            print(f"   Waiting for confirmation...")
            
            # Wait for confirmation
            tx_receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
            
            if tx_receipt.status == 1:
                print(f"   ✅ Tokens approved for PriceTriggerSwap successfully!")
                return True
            else:
                print(f"   ❌ Transaction failed!")
                return False
                
        except Exception as e:
            print(f"❌ Error approving tokens: {e}")
            return False

def main():
    """Main function to run the USDC allowance script"""
    print("🚀 USDC Allowance Script for PriceTriggerSwap")
    print("=" * 50)
    
    # Check if PriceTriggerSwap address is set
    if PRICE_TRIGGER_SWAP_ADDRESS == "0x0000000000000000000000000000000000000000":
        print("\n⚠️  IMPORTANT: Set PRICE_TRIGGER_SWAP_ADDRESS in the script first!")
        print("   Deploy PriceTriggerSwap contract and update the address")
        return
    
    try:
        # Initialize manager
        manager = USDCAllowanceManager(DUMMY_PRIVATE_KEY)
        
        # Get PURR token info
        symbol, decimals, balance = manager.get_purr_info()
        if not symbol:
            return
        
        # Check current allowance for PriceTriggerSwap
        print(f"\n" + "="*50)
        print("🔍 CHECKING CURRENT ALLOWANCE")
        print("="*50)
        
        current_allowance = manager.check_current_allowance(PRICE_TRIGGER_SWAP_ADDRESS)
        manager.check_price_trigger_swap_allowance()
        
        # Ask user what to do
        print(f"\n" + "="*50)
        print("🎯 WHAT WOULD YOU LIKE TO DO?")
        print("="*50)
        print("1. Give standard ERC20 allowance to PriceTriggerSwap")
        print("2. Use PriceTriggerSwap's approveTokens function")
        print("3. Check allowance status only")
        
        choice = input("\nEnter your choice (1-3): ").strip()
        
        if choice == "1":
            # Standard ERC20 allowance
            amount_input = input(f"\nEnter amount of {symbol} to approve (e.g., 100): ").strip()
            try:
                amount = int(float(amount_input) * (10 ** decimals))
                manager.give_allowance(PRICE_TRIGGER_SWAP_ADDRESS, amount)
                
                # Check new allowance
                print(f"\n" + "="*50)
                print("✅ CHECKING NEW ALLOWANCE")
                print("="*50)
                manager.check_current_allowance(PRICE_TRIGGER_SWAP_ADDRESS)
                
            except ValueError:
                print("❌ Invalid amount entered")
                
        elif choice == "2":
            # PriceTriggerSwap approveTokens
            amount_input = input(f"\nEnter amount of {symbol} to approve (e.g., 100): ").strip()
            try:
                amount = int(float(amount_input) * (10 ** decimals))
                manager.approve_tokens_for_price_trigger_swap(amount)
                
                # Check new allowance
                print(f"\n" + "="*50)
                print("✅ CHECKING NEW ALLOWANCE")
                print("="*50)
                manager.check_price_trigger_swap_allowance()
                
            except ValueError:
                print("❌ Invalid amount entered")
                
        elif choice == "3":
            print("\n✅ Allowance check completed")
            
        else:
            print("❌ Invalid choice")
            
    except Exception as e:
        print(f"\n❌ Script failed: {e}")
        print(f"   Make sure you have the correct private key and network connection")

if __name__ == "__main__":
    main()
