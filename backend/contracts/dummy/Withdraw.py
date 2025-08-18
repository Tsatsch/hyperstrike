#!/usr/bin/env python3
"""
Test Withdraw Trigger Script
Tests the withdrawOnTrigger function on PriceTriggerSwapV2 contract
"""

import json
import time
from web3 import Web3
from eth_account import Account

# ============================================================================
# CONFIGURATION - CHANGE THESE VARIABLES AS NEEDED
# ============================================================================

# Contract addresses
PRICE_TRIGGER_CONTRACT_ADDRESS = "0xe11B7Cd241c5371B459C5820360A1F585e3B71c4"  # Your deployed contract
WHYPE_CONTRACT_ADDRESS = "0x5a1a1339ad9e52b7a4df78452d5c18e8690746f3"  # Your deployed WHYPE

# Network configuration
HYPER_TESTNET_RPC = "https://hyperliquid-testnet.core.chainstack.com/f3ce6117a8d9cc6b9908d471f15d1686/evm"
CHAIN_ID = 998

# Wallet addresses
WITHDRAWAL_WALLET = "0x9E02783Ad42C5A94a0De60394f2996E44458B782"
YOUR_PRIVATE_KEY = "0xe469510e586a6e0d982e137bc49d2aefef5dd76b36b8db64cb22af2ab8649eae"  # Replace with your actual private key
USER_ADDRESS_TO_TEST = "0x7F752d65B046EAaa335dc1dB55F3DEf2A419f694"  # Address to test withdrawal for

# Test configuration
TOKEN_TO_TEST = WHYPE_CONTRACT_ADDRESS  # Change this to test different tokens
AMOUNT_TO_WITHDRAW = 0.00001  # Amount in tokens (will be converted to wei)

# ============================================================================
# CONTRACT ABIs
# ============================================================================

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

# Generic ERC20 Contract ABI (minimal for testing)
ERC20_ABI = [
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
    },
    {
        "inputs": [],
        "name": "decimals",
        "outputs": [{"type": "uint8"}],
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
            address=Web3.to_checksum_address(PRICE_TRIGGER_CONTRACT_ADDRESS),
            abi=PRICE_TRIGGER_ABI
        )
        
        self.token_contract = self.w3.eth.contract(
            address=Web3.to_checksum_address(TOKEN_TO_TEST),
            abi=ERC20_ABI
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
            
            # Verify token contract
            name = self.token_contract.functions.name().call()
            symbol = self.token_contract.functions.symbol().call()
            decimals = self.token_contract.functions.decimals().call()
            print(f"📋 Token contract verified: {name} ({symbol})")
            print(f"📍 Contract address: {TOKEN_TO_TEST}")
            print(f"🔢 Decimals: {decimals}")
            
            self.token_decimals = decimals
            
        except Exception as e:
            print(f"❌ Contract verification failed: {e}")
            raise
    
    def get_balances(self):
        """Get current balances"""
        try:
            # Get HYPE balance
            hype_balance = self.w3.eth.get_balance(self.account.address)
            hype_balance_eth = self.w3.from_wei(hype_balance, 'ether')
            
            # Get token balance
            token_balance = self.token_contract.functions.balanceOf(self.account.address).call()
            token_balance_formatted = token_balance / (10 ** self.token_decimals)
            
            # Get withdrawal wallet token balance
            withdrawal_wallet_balance = self.token_contract.functions.balanceOf(
                Web3.to_checksum_address(WITHDRAWAL_WALLET)
            ).call()
            withdrawal_wallet_balance_formatted = withdrawal_wallet_balance / (10 ** self.token_decimals)
            
            print(f"\n💰 Current Balances:")
            print(f"   Your HYPE: {hype_balance_eth:.6f} HYPE")
            print(f"   Your {self.token_contract.functions.symbol().call()}: {token_balance_formatted:.6f}")
            print(f"   Withdrawal Wallet {self.token_contract.functions.symbol().call()}: {withdrawal_wallet_balance_formatted:.6f}")
            
            return hype_balance, token_balance, withdrawal_wallet_balance
            
        except Exception as e:
            print(f"❌ Failed to get balances: {e}")
            return 0, 0, 0
    
    def check_allowance(self, user_address):
        """Check current allowance for a user"""
        try:
            # Convert address to checksum format
            checksum_user_address = Web3.to_checksum_address(user_address)
            
            allowance = self.price_trigger_contract.functions.getApprovedAmount(
                checksum_user_address, 
                Web3.to_checksum_address(TOKEN_TO_TEST)
            ).call()
            
            allowance_formatted = allowance / (10 ** self.token_decimals)
            print(f"🔐 Allowance for {user_address}: {allowance_formatted:.6f} {self.token_contract.functions.symbol().call()}")
            
            return allowance
            
        except Exception as e:
            print(f"❌ Failed to check allowance: {e}")
            return 0
    
    def trigger_withdrawal(self, user_address, amount_tokens):
        """Trigger the withdrawOnTrigger function"""
        try:
            print(f"\n🚀 Triggering withdrawal...")
            print(f"   User: {user_address}")
            print(f"   Amount: {amount_tokens} {self.token_contract.functions.symbol().call()}")
            
            # Convert amount to wei
            amount_wei = int(amount_tokens * (10 ** self.token_decimals))
            
            # Check if we're the owner
            owner = self.price_trigger_contract.functions.owner().call()
            if self.account.address.lower() != owner.lower():
                print(f"❌ Only contract owner can call withdrawOnTrigger")
                print(f"   Current owner: {owner}")
                print(f"   Your address: {self.account.address}")
                return False
            
            # Check user allowance
            allowance = self.check_allowance(user_address)
            if allowance < amount_wei:
                allowance_formatted = allowance / (10 ** self.token_decimals)
                print(f"❌ Insufficient allowance: {allowance_formatted:.6f} {self.token_contract.functions.symbol().call()}")
                return False
            
            # Check user balance
            checksum_user_address = Web3.to_checksum_address(user_address)
            user_balance = self.token_contract.functions.balanceOf(checksum_user_address).call()
            if user_balance < amount_wei:
                user_balance_formatted = user_balance / (10 ** self.token_decimals)
                print(f"❌ Insufficient user balance: {user_balance_formatted:.6f} {self.token_contract.functions.symbol().call()}")
                return False
            
            print(f"✅ All checks passed - proceeding with withdrawal")
            
            # Build transaction
            withdraw_txn = self.price_trigger_contract.functions.withdrawOnTrigger(
                checksum_user_address,
                Web3.to_checksum_address(TOKEN_TO_TEST),
                amount_wei
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
                new_user_balance = self.token_contract.functions.balanceOf(checksum_user_address).call()
                new_withdrawal_wallet_balance = self.token_contract.functions.balanceOf(
                    Web3.to_checksum_address(WITHDRAWAL_WALLET)
                ).call()
                
                print(f"   User {self.token_contract.functions.symbol().call()}: {new_user_balance / (10 ** self.token_decimals):.6f}")
                print(f"   Withdrawal Wallet {self.token_contract.functions.symbol().call()}: {new_withdrawal_wallet_balance / (10 ** self.token_decimals):.6f}")
                
                # Calculate fee
                protocol_fee = (amount_wei * 50) // 10000  # 0.5% fee
                actual_transfer = amount_wei - protocol_fee
                
                print(f"\n📊 Transfer Summary:")
                print(f"   Amount withdrawn: {amount_tokens} {self.token_contract.functions.symbol().call()}")
                print(f"   Protocol fee (0.5%): {protocol_fee / (10 ** self.token_decimals):.6f} {self.token_contract.functions.symbol().call()}")
                print(f"   Net transfer: {actual_transfer / (10 ** self.token_decimals):.6f} {self.token_contract.functions.symbol().call()}")
                
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
    
    # Check if private key is set
    if YOUR_PRIVATE_KEY == "your_private_key_here":
        print("❌ Please set YOUR_PRIVATE_KEY variable in the script")
        return
    
    # Remove '0x' prefix if present
    private_key = YOUR_PRIVATE_KEY
    if private_key.startswith('0x'):
        private_key = private_key[2:]
    
    try:
        # Initialize tester
        tester = WithdrawTriggerTester(private_key)
        
        # Get current balances
        tester.get_balances()
        
        # Check allowance for the user
        allowance = tester.check_allowance(USER_ADDRESS_TO_TEST)
        
        if allowance == 0:
            print(f"❌ No allowance found for {USER_ADDRESS_TO_TEST}")
            print("Please approve tokens first using your approval script")
            return
        
        # Convert allowance to readable format
        allowance_formatted = allowance / (10 ** tester.token_decimals)
        print(f"✅ Allowance found: {allowance_formatted:.6f} {tester.token_contract.functions.symbol().call()}")
        
        # Check if amount exceeds allowance
        if AMOUNT_TO_WITHDRAW > allowance_formatted:
            print(f"⚠️  Amount {AMOUNT_TO_WITHDRAW} exceeds allowance {allowance_formatted:.6f}")
            print(f"Using maximum available: {allowance_formatted:.6f}")
            amount_to_withdraw = allowance_formatted
        else:
            amount_to_withdraw = AMOUNT_TO_WITHDRAW
        
        print(f"\n🚀 Starting withdrawal of {amount_to_withdraw} {tester.token_contract.functions.symbol().call()}")
        print(f"   From: {USER_ADDRESS_TO_TEST}")
        print(f"   To: {WITHDRAWAL_WALLET}")
        
        # Trigger withdrawal
        success = tester.trigger_withdrawal(USER_ADDRESS_TO_TEST, amount_to_withdraw)
        
        if success:
            print(f"\n🎉 Withdrawal completed successfully!")
            print(f"Check the withdrawal wallet {WITHDRAWAL_WALLET} for the funds.")
        else:
            print(f"\n❌ Withdrawal failed. Check the output above for details.")
            
    except Exception as e:
        print(f"❌ Test failed with error: {e}")

if __name__ == "__main__":
    main()
