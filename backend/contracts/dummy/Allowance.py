#!/usr/bin/env python3
"""
WHYPE Allowance Script for Main Contract (MAINNET)
This script checks and sets both internal and ERC20 allowances for the Main contract on HyperEVM mainnet.
"""

import os
import sys
from web3 import Web3
from eth_account import Account
from eth_account.signers.local import LocalAccount

# Configuration
HYPER_MAINNET_RPC = "https://withered-delicate-sailboat.hype-mainnet.quiknode.pro/edb38026d62fb1de9d51e057b4b720a455f8b9d8/evm"
WHYPE_TOKEN_ADDRESS = "0x5555555555555555555555555555555555555555"  # WHYPE on HyperEVM mainnet
MAIN_CONTRACT_ADDRESS = "0x745b14228103d18AdC394a4688fA1628614b91CA"  # Your deployed Main contract on mainnet

# REPLACE WITH YOUR ACTUAL MAINNET PRIVATE KEY
# ⚠️  CRITICAL WARNING: This will interact with REAL FUNDS on MAINNET!
MAINNET_PRIVATE_KEY = "0xe469510e586a6e0d982e137bc49d2aefef5dd76b36b8db64cb22af2ab8649eae"

# WHYPE Token ABI - Minimal ABI for allowance operations
WHYPE_ABI = [
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

# Main Contract ABI - Simplified
MAIN_CONTRACT_ABI = [
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
    },
    {
        "constant": True,
        "inputs": [
            {"name": "user", "type": "address"},
            {"name": "token", "type": "address"}
        ],
        "name": "getERC20Allowance",
        "outputs": [{"name": "amount", "type": "uint256"}],
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [
            {"name": "user", "type": "address"},
            {"name": "token", "type": "address"}
        ],
        "name": "checkAllowanceStatus",
        "outputs": [
            {"name": "internalAmount", "type": "uint256"},
            {"name": "erc20Amount", "type": "uint256"},
            {"name": "isReady", "type": "bool"}
        ],
        "type": "function"
    }
]

class WHYPEAllowanceManager:
    def __init__(self, private_key: str):
        """Initialize the WHYPE Allowance Manager"""
        self.private_key = private_key
        self.account: LocalAccount = Account.from_key(private_key)
        self.w3 = Web3(Web3.HTTPProvider(HYPER_MAINNET_RPC))
        
        # Check connection
        if not self.w3.is_connected():
            raise Exception("Failed to connect to HyperEVM mainnet")
        
        print(f"✅ Connected to HyperEVM mainnet")
        print(f"📱 Wallet address: {self.account.address}")
        print(f"🔗 RPC URL: {HYPER_MAINNET_RPC}")
        
        # Initialize contracts with checksum addresses
        self.whype_contract = self.w3.eth.contract(
            address=Web3.to_checksum_address(WHYPE_TOKEN_ADDRESS),
            abi=WHYPE_ABI
        )
        
        # Note: Main contract needs to be deployed first
        if MAIN_CONTRACT_ADDRESS != "0x0000000000000000000000000000000000000000":
            self.main_contract = self.w3.eth.contract(
                address=Web3.to_checksum_address(MAIN_CONTRACT_ADDRESS),
                abi=MAIN_CONTRACT_ABI
            )
        else:
            self.main_contract = None
            print("⚠️  Main contract not deployed yet - set MAIN_CONTRACT_ADDRESS")
    
    def get_whype_info(self):
        """Get WHYPE token information"""
        try:
            symbol = self.whype_contract.functions.symbol().call()
            decimals = self.whype_contract.functions.decimals().call()
            balance = self.whype_contract.functions.balanceOf(self.account.address).call()
            
            print(f"\n📊 WHYPE Token Info:")
            print(f"   Symbol: {symbol}")
            print(f"   Decimals: {decimals}")
            print(f"   Balance: {balance / (10 ** decimals):.6f} {symbol}")
            
            return symbol, decimals, balance
        except Exception as e:
            print(f"❌ Error getting WHYPE info: {e}")
            return None, None, None
    
    def check_both_allowances(self):
        """Check both internal and ERC20 allowances"""
        if not self.main_contract:
            print("\n⚠️  Cannot check allowances - Main contract not deployed")
            return None, None, None
        
        try:
            # Check internal allowance
            internal_allowance = self.main_contract.functions.getApprovedAmount(
                self.account.address,
                Web3.to_checksum_address(WHYPE_TOKEN_ADDRESS)
            ).call()
            
            # Check ERC20 allowance
            erc20_allowance = self.main_contract.functions.getERC20Allowance(
                self.account.address,
                Web3.to_checksum_address(WHYPE_TOKEN_ADDRESS)
            ).call()
            
            # Get token decimals for formatting
            decimals = self.whype_contract.functions.decimals().call()
            
            print(f"\n🔍 Current Allowance Status:")
            print(f"   Internal Allowance: {internal_allowance / (10 ** decimals):.6f} WHYPE")
            print(f"   ERC20 Allowance: {erc20_allowance / (10 ** decimals):.6f} WHYPE")
            
            # Check if both are ready
            is_ready = (internal_allowance > 0 and erc20_allowance > 0)
            print(f"   Status: {'✅ Ready for withdrawal' if is_ready else '❌ Not ready'}")
            
            return internal_allowance, erc20_allowance, decimals
            
        except Exception as e:
            print(f"❌ Error checking allowances: {e}")
            return None, None, None
    
    def set_internal_allowance(self, amount: int):
        """Set internal allowance using approveTokens function"""
        if not self.main_contract:
            print("\n⚠️  Cannot set internal allowance - contract not deployed")
            return False
        
        try:
            print(f"\n🚀 Setting internal allowance...")
            print(f"   Amount: {amount}")
            
            # Build approveTokens transaction
            approve_txn = self.main_contract.functions.approveTokens(
                Web3.to_checksum_address(WHYPE_TOKEN_ADDRESS),
                amount
            ).build_transaction({
                'from': self.account.address,
                'nonce': self.w3.eth.get_transaction_count(self.account.address),
                'gas': 150000,
                'gasPrice': self.w3.eth.gas_price
            })
            
            # Sign and send transaction
            signed_txn = self.w3.eth.account.sign_transaction(approve_txn, self.private_key)
            tx_hash = self.w3.eth.send_raw_transaction(signed_txn.rawTransaction)
            
            print(f"   Transaction hash: {tx_hash.hex()}")
            print(f"   Waiting for confirmation...")
            print(f"   ⏳ Waiting for confirmation...")
            
            # Wait for confirmation
            tx_receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
            
            if tx_receipt.status == 1:
                print(f"   ✅ Internal allowance set successfully!")
                return True
            else:
                print(f"   ❌ Transaction failed!")
                return False
                
        except Exception as e:
            print(f"❌ Error setting internal allowance: {e}")
            return False
    
    def set_erc20_allowance(self, amount: int):
        """Set ERC20 allowance using standard ERC20 approve function"""
        try:
            print(f"\n🚀 Setting ERC20 allowance...")
            print(f"   Amount: {amount}")
            
            # Build standard ERC20 approve transaction directly on token contract
            approve_txn = self.whype_contract.functions.approve(
                Web3.to_checksum_address(MAIN_CONTRACT_ADDRESS),
                amount
            ).build_transaction({
                'from': self.account.address,
                'nonce': self.w3.eth.get_transaction_count(self.account.address),
                'gas': 100000,  # Standard gas for ERC20 approve
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
                print(f"   ✅ ERC20 allowance set successfully!")
                return True
            else:
                print(f"   ❌ Transaction failed!")
                return False
                
        except Exception as e:
            print(f"❌ Error setting ERC20 allowance: {e}")
            return False
    
    def setup_allowances(self, amount: int):
        """Check and setup both allowances if needed"""
        print(f"\n🔍 Checking current allowance status...")
        
        # Check current allowances
        internal_allowance, erc20_allowance, decimals = self.check_both_allowances()
        
        if internal_allowance is None:
            return False
        
        # Convert amount to wei if needed
        if decimals:
            amount_wei = amount if amount > 1000000 else int(amount * (10 ** decimals))
        else:
            amount_wei = amount
        
        print(f"\n🎯 Setting up allowances for {amount_wei / (10 ** decimals):.6f} WHYPE...")
        
        # Check and set internal allowance if needed
        if internal_allowance < amount_wei:
            print(f"   ⚠️  Internal allowance insufficient ({internal_allowance / (10 ** decimals):.6f} < {amount_wei / (10 ** decimals):.6f})")
            if not self.set_internal_allowance(amount_wei):
                return False
        else:
            print(f"   ✅ Internal allowance sufficient ({internal_allowance / (10 ** decimals):.6f} >= {amount_wei / (10 ** decimals):.6f})")
        
        # Check and set ERC20 allowance if needed
        if erc20_allowance < amount_wei:
            print(f"   ⚠️  ERC20 allowance insufficient ({erc20_allowance / (10 ** decimals):.6f} < {amount_wei / (10 ** decimals):.6f})")
            if not self.set_erc20_allowance(amount_wei):
                return False
        else:
            print(f"   ✅ ERC20 allowance sufficient ({erc20_allowance / (10 ** decimals):.6f} >= {amount_wei / (10 ** decimals):.6f})")
        
        # Final check
        print(f"\n🔍 Final allowance status:")
        final_internal, final_erc20, _ = self.check_both_allowances()
        
        if final_internal >= amount_wei and final_erc20 >= amount_wei:
            print(f"🎉 All allowances set successfully! Ready for withdrawal.")
            return True
        else:
            print(f"❌ Failed to set all required allowances.")
            return False

def main():
    """Main function to run the WHYPE allowance script"""
    print("🚀 WHYPE Allowance Script for Main Contract (MAINNET)")
    print("=" * 60)
    
    # Safety confirmation for mainnet
    print("\n🚨 MAINNET SAFETY CHECK:")
    print("   You are about to interact with REAL FUNDS on HyperEVM mainnet!")
    print("   Make sure you understand what you're doing.")
    
    safety_confirm = input("\nType 'I UNDERSTAND' to continue: ").strip()
    if safety_confirm != "I UNDERSTAND":
        print("❌ Safety confirmation failed. Exiting for your protection.")
        return
    
    # Check if Main contract address is set
    if MAIN_CONTRACT_ADDRESS == "0x0000000000000000000000000000000000000000":
        print("\n⚠️  IMPORTANT: Set MAIN_CONTRACT_ADDRESS in the script first!")
        print("   Deploy Main contract and update the address")
        return
    
    try:
        # Initialize manager
        manager = WHYPEAllowanceManager(MAINNET_PRIVATE_KEY)
        
        # Get WHYPE token info
        symbol, decimals, balance = manager.get_whype_info()
        if not symbol:
            return
        
        # Ask user for amount
        print(f"\n" + "="*50)
        print("🎯 SETUP ALLOWANCES")
        print("="*50)
        
        amount_input = input(f"\nEnter amount of {symbol} to approve (e.g., 1.0): ").strip()
        try:
            amount = float(amount_input)
            print(f"\n🚀 Setting up allowances for {amount} {symbol}...")
            
            # Setup both allowances
            success = manager.setup_allowances(amount)
            
            if success:
                print(f"\n✅ Allowance setup completed successfully!")
                print(f"   You can now use the withdrawal script.")
            else:
                print(f"\n❌ Allowance setup failed. Check the output above for details.")
                
        except ValueError:
            print("❌ Invalid amount entered")
            
    except Exception as e:
        print(f"\n❌ Script failed: {e}")
        print(f"   Make sure you have the correct private key and network connection")

if __name__ == "__main__":
    main()
