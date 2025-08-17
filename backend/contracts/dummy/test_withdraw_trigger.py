#!/usr/bin/env python3
"""
Test Withdraw Trigger Script
Tests the withdrawOnTrigger function on PriceTriggerSwapV2 contract
"""

import json
import time
from web3 import Web3
from eth_account import Account

# Configuration
PRICE_TRIGGER_CONTRACT_ADDRESS = "0x665D96a9737C4C06f9e885FC6fC03dFB97FB0FCB"  # Your deployed contract
WHYPE_CONTRACT_ADDRESS = "0x3990eeF326Bfa1084bAE56D8607Aa76966F1ea28"  # Your deployed WHYPE
HYPER_TESTNET_RPC = "https://hyperliquid-testnet.core.chainstack.com/f3ce6117a8d9cc6b9908d471f15d1686/evm"
CHAIN_ID = 998
WITHDRAWAL_WALLET = "0x9E02783Ad42C5A94a0De60394f2996E44458B782"

# PriceTriggerSwapV2 Contract ABI (minimal for testing)
PRICE_TRIGGER_ABI = [
    {
        "inputs": [{"type": "address"}, {"type": "address"}, {"type": "uint256"}],
        "name": "withdrawOnTrigger",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"type": "address"}, {"type": "address"}],
        "name": "getApprovedAmount",
        "outputs": [{"type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "owner",
        "outputs": [{"type": "address"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "WITHDRAWAL_WALLET",
        "outputs": [{"type": "address"}],
        "stateMutability": "view",
        "type": "function"
    }
]

# WHYPE Contract ABI (minimal for testing)
WHYPE_ABI = [
    {
        "inputs": [{"type": "address"}],
        "name": "balanceOf",
        "outputs": [{"type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "name",
        "outputs": [{"type": "string"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "symbol",
        "outputs": [{"type": "string"}],
        "stateMutability": "view",
        "type": "function"
    }
]

class WithdrawTriggerTester:
    def __init__(self, private_key):
        """Initialize the withdraw trigger tester with a private key"""
        self.account = Account.from_key(private_key)
        self.w3 = Web3(Web3.HTTPProvider(HYPER_TESTNET_RPC))
        
        # Check connection
        if not self.w3.is_connected():
            raise Exception("Failed to connect to HyperEVM testnet")
        
        print(f"✅ Connected to HyperEVM testnet (Chain ID: {self.w3.eth.chain_id})")
        print(f"📱 Wallet address: {self.account.address}")
        
        # Initialize contracts
        self.price_trigger_contract = self.w3.eth.contract(
            address=PRICE_TRIGGER_CONTRACT_ADDRESS,
            abi=PRICE_TRIGGER_ABI
        )
        
        self.whype_contract = self.w3.eth.contract(
            address=WHYPE_CONTRACT_ADDRESS,
            abi=WHYPE_ABI
        )
        
        # Verify contracts
        self._verify_contracts()
    
    def _verify_contracts(self):
        """Verify the contracts exist and are accessible"""
        try:
            # Verify PriceTriggerSwapV2 contract
            owner = self.price_trigger_contract.functions.owner().call()
            withdrawal_wallet = self.price_trigger_contract.functions.WITHDRAWAL_WALLET().call()
            print(f"📋 PriceTriggerSwapV2 contract verified")
            print(f"📍 Contract address: {PRICE_TRIGGER_CONTRACT_ADDRESS}")
            print(f"👑 Owner: {owner}")
            print(f"💰 Withdrawal wallet: {withdrawal_wallet}")
            
            # Verify WHYPE contract
            name = self.whype_contract.functions.name().call()
            symbol = self.whype_contract.functions.symbol().call()
            print(f"📋 WHYPE contract verified: {name} ({symbol})")
            print(f"📍 Contract address: {WHYPE_CONTRACT_ADDRESS}")
            
        except Exception as e:
            print(f"❌ Contract verification failed: {e}")
            raise
    
    def get_balances(self):
        """Get current balances"""
        try:
            # Get HYPE balance
            hype_balance = self.w3.eth.get_balance(self.account.address)
            hype_balance_eth = self.w3.from_wei(hype_balance, 'ether')
            
            # Get WHYPE balance
            whype_balance = self.whype_contract.functions.balanceOf(self.account.address).call()
            whype_balance_eth = self.w3.from_wei(whype_balance, 'ether')
            
            # Get withdrawal wallet WHYPE balance
            withdrawal_wallet_balance = self.whype_contract.functions.balanceOf(WITHDRAWAL_WALLET).call()
            withdrawal_wallet_balance_eth = self.w3.from_wei(withdrawal_wallet_balance, 'ether')
            
            print(f"\n💰 Current Balances:")
            print(f"   Your HYPE: {hype_balance_eth:.6f} HYPE")
            print(f"   Your WHYPE: {whype_balance_eth:.6f} WHYPE")
            print(f"   Withdrawal Wallet WHYPE: {withdrawal_wallet_balance_eth:.6f} WHYPE")
            
            return hype_balance, whype_balance, withdrawal_wallet_balance
            
        except Exception as e:
            print(f"❌ Failed to get balances: {e}")
            return 0, 0, 0
    
    def check_allowance(self, user_address):
        """Check current allowance for a user"""
        try:
            allowance = self.price_trigger_contract.functions.getApprovedAmount(
                user_address, 
                WHYPE_CONTRACT_ADDRESS
            ).call()
            
            allowance_eth = self.w3.from_wei(allowance, 'ether')
            print(f"🔐 Allowance for {user_address}: {allowance_eth:.6f} WHYPE")
            
            return allowance
            
        except Exception as e:
            print(f"❌ Failed to check allowance: {e}")
            return 0
    
    def trigger_withdrawal(self, user_address, amount_whype):
        """Trigger the withdrawOnTrigger function"""
        try:
            print(f"\n🚀 Triggering withdrawal...")
            print(f"   User: {user_address}")
            print(f"   Amount: {self.w3.from_wei(amount_whype, 'ether')} WHYPE")
            
            # Check if we're the owner
            owner = self.price_trigger_contract.functions.owner().call()
            if self.account.address.lower() != owner.lower():
                print(f"❌ Only contract owner can call withdrawOnTrigger")
                print(f"   Current owner: {owner}")
                print(f"   Your address: {self.account.address}")
                return False
            
            # Check user allowance
            allowance = self.check_allowance(user_address)
            if allowance < amount_whype:
                print(f"❌ Insufficient allowance: {self.w3.from_wei(allowance, 'ether')} WHYPE")
                return False
            
            # Check user balance
            user_balance = self.whype_contract.functions.balanceOf(user_address).call()
            if user_balance < amount_whype:
                print(f"❌ Insufficient user balance: {self.w3.from_wei(user_balance, 'ether')} WHYPE")
                return False
            
            print(f"✅ All checks passed - proceeding with withdrawal")
            
            # Build transaction
            withdraw_txn = self.price_trigger_contract.functions.withdrawOnTrigger(
                user_address,
                WHYPE_CONTRACT_ADDRESS,
                amount_whype
            ).build_transaction({
                'from': self.account.address,
                'gas': 300000,
                'gasPrice': self.w3.eth.gas_price,
                'nonce': self.w3.eth.get_transaction_count(self.account.address),
            })
            
            # Sign and send transaction
            signed_txn = self.w3.eth.account.sign_transaction(withdraw_txn, self.account.key)
            tx_hash = self.w3.eth.send_raw_transaction(signed_txn.rawTransaction)
            
            print(f"📤 Withdrawal transaction sent: {tx_hash.hex()}")
            
            # Wait for confirmation
            print("⏳ Waiting for transaction confirmation...")
            tx_receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
            
            if tx_receipt.status == 1:
                print("✅ Withdrawal successful!")
                
                # Show updated balances
                print(f"\n💰 Updated Balances:")
                new_user_balance = self.whype_contract.functions.balanceOf(user_address).call()
                new_withdrawal_wallet_balance = self.whype_contract.functions.balanceOf(WITHDRAWAL_WALLET).call()
                
                print(f"   User WHYPE: {self.w3.from_wei(new_user_balance, 'ether')} WHYPE")
                print(f"   Withdrawal Wallet WHYPE: {self.w3.from_wei(new_withdrawal_wallet_balance, 'ether')} WHYPE")
                
                # Calculate fee
                protocol_fee = (amount_whype * 50) // 10000  # 0.5% fee
                actual_transfer = amount_whype - protocol_fee
                
                print(f"\n📊 Transfer Summary:")
                print(f"   Amount withdrawn: {self.w3.from_wei(amount_whype, 'ether')} WHYPE")
                print(f"   Protocol fee (0.5%): {self.w3.from_wei(protocol_fee, 'ether')} WHYPE")
                print(f"   Net transfer: {self.w3.from_wei(actual_transfer, 'ether')} WHYPE")
                
                return True
            else:
                print("❌ Withdrawal failed!")
                return False
                
        except Exception as e:
            print(f"❌ Withdrawal failed: {e}")
            return False

def main():
    """Main function"""
    print("🚀 PriceTriggerSwapV2 Withdraw Trigger Tester")
    print("=" * 50)
    
    # Get private key from user input
    private_key = input("🔑 Enter your private key (without 0x prefix): ").strip()
    if not private_key:
        print("❌ Private key is required")
        return
    
    # Remove '0x' prefix if present
    if private_key.startswith('0x'):
        private_key = private_key[2:]
    
    try:
        # Initialize tester
        tester = WithdrawTriggerTester(private_key)
        
        # Get current balances
        tester.get_balances()
        
        # Get user address to test with (you can modify this)
        user_address = input("\n🔍 Enter user address to test withdrawal for (or press Enter to use your address): ").strip()
        if not user_address:
            user_address = tester.account.address
            print(f"Using your address: {user_address}")
        
        # Check allowance for the user
        allowance = tester.check_allowance(user_address)
        
        if allowance == 0:
            print(f"❌ No allowance found for {user_address}")
            print("Please approve tokens first using your approval script")
            return
        
        # Get amount to withdraw
        amount_input = input(f"\n💰 Enter amount to withdraw (in WHYPE, max {tester.w3.from_wei(allowance, 'ether'):.6f}): ").strip()
        if not amount_input:
            # Use 90% of allowance as default
            amount_whype = (allowance * 90) // 100
            print(f"Using 90% of allowance: {tester.w3.from_wei(amount_whype, 'ether')} WHYPE")
        else:
            try:
                amount_whype = tester.w3.to_wei(float(amount_input), 'ether')
                if amount_whype > allowance:
                    print(f"❌ Amount exceeds allowance. Using maximum: {tester.w3.from_wei(allowance, 'ether')} WHYPE")
                    amount_whype = allowance
            except ValueError:
                print("❌ Invalid amount. Using 0.1 WHYPE as default")
                amount_whype = tester.w3.to_wei(0.1, 'ether')
        
        # Trigger withdrawal
        success = tester.trigger_withdrawal(user_address, amount_whype)
        
        if success:
            print(f"\n🎉 Withdrawal completed successfully!")
            print(f"Check the withdrawal wallet {WITHDRAWAL_WALLET} for the funds.")
        else:
            print(f"\n❌ Withdrawal failed. Check the output above for details.")
            
    except Exception as e:
        print(f"❌ Test failed with error: {e}")

if __name__ == "__main__":
    main()
