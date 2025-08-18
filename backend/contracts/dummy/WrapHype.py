#!/usr/bin/env python3
"""
WHYPE Token Wrapper/Unwrapper Script
Interacts with the WHYPE contract to wrap native HYPE tokens to WHYPE and unwrap WHYPE back to HYPE
"""

import json
import time
from web3 import Web3
from eth_account import Account
import os

# Configuration
WHYPE_CONTRACT_ADDRESS = "0x5555555555555555555555555555555555555555"  # WHYPE on HyperEVM mainnet
HYPER_MAINNET_RPC = "https://withered-delicate-sailboat.hype-mainnet.quiknode.pro/edb38026d62fb1de9d51e057b4b720a455f8b9d8/evm"
CHAIN_ID = 999  # HyperEVM mainnet chain ID

# WHYPE Contract ABI (based on WETH9 standard)
WHYPE_ABI = [
    {
        "inputs": [],
        "name": "deposit",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [{"name": "wad", "type": "uint256"}],
        "name": "withdraw",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"name": "", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "totalSupply",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "name",
        "outputs": [{"name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "symbol",
        "outputs": [{"name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"name": "guy", "type": "address"}, {"name": "wad", "type": "uint256"}],
        "name": "approve",
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"name": "dst", "type": "address"}, {"name": "wad", "type": "uint256"}],
        "name": "transfer",
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]

class HYPEWrapper:
    def __init__(self, private_key):
        """Initialize the HYPE wrapper with a private key"""
        self.account = Account.from_key(private_key)
        self.w3 = Web3(Web3.HTTPProvider(HYPER_MAINNET_RPC))
        
        # Check connection
        if not self.w3.is_connected():
            raise Exception("Failed to connect to HyperEVM mainnet")
        
        print(f"✅ Connected to HyperEVM mainnet (Chain ID: {self.w3.eth.chain_id})")
        print(f"📱 Wallet address: {self.account.address}")
        
        # Initialize contract with checksum address
        self.contract = self.w3.eth.contract(
            address=Web3.to_checksum_address(WHYPE_CONTRACT_ADDRESS),
            abi=WHYPE_ABI
        )
        
        # Verify contract
        self._verify_contract()
    
    def _verify_contract(self):
        """Verify the contract exists and is accessible"""
        try:
            name = self.contract.functions.name().call()
            symbol = self.contract.functions.symbol().call()
            print(f"📋 Contract verified: {name} ({symbol})")
            print(f"📍 Contract address: {Web3.to_checksum_address(WHYPE_CONTRACT_ADDRESS)}")
            
            # Test if withdraw function is accessible
            try:
                # This will fail but we just want to check if the function exists in ABI
                self.contract.functions.withdraw(0).call()
            except Exception as e:
                if "execution reverted" in str(e).lower():
                    print("✅ Withdraw function accessible (execution reverted as expected for 0 amount)")
                else:
                    print(f"⚠️  Withdraw function test: {e}")
                    
        except Exception as e:
            raise Exception(f"Failed to verify contract: {e}")
    
    def get_balances(self):
        """Get current HYPE and WHYPE balances"""
        try:
            # Get native HYPE balance
            hype_balance = self.w3.eth.get_balance(self.account.address)
            hype_balance_ether = self.w3.from_wei(hype_balance, 'ether')
            
            # Get WHYPE balance
            whype_balance = self.contract.functions.balanceOf(self.account.address).call()
            whype_balance_ether = self.w3.from_wei(whype_balance, 'ether')
            
            print(f"\n💰 Current Balances:")
            print(f"   HYPE (Native): {hype_balance_ether:.6f} HYPE")
            print(f"   WHYPE (Wrapped): {whype_balance_ether:.6f} WHYPE")
            
            return hype_balance, whype_balance
            
        except Exception as e:
            print(f"❌ Error getting balances: {e}")
            return 0, 0
    
    def wrap_hype(self, amount_ether):
        """Wrap native HYPE tokens to WHYPE using deposit()"""
        try:
            # Convert ether to wei
            amount_wei = self.w3.to_wei(amount_ether, 'ether')
            
            # Check if user has enough HYPE (need extra for gas)
            hype_balance = self.w3.eth.get_balance(self.account.address)
            gas_estimate = self.contract.functions.deposit().estimate_gas({
                'from': self.account.address,
                'value': amount_wei
            })
            gas_cost = gas_estimate * self.w3.eth.gas_price
            total_needed = amount_wei + gas_cost
            
            if hype_balance < total_needed:
                raise Exception(f"Insufficient HYPE balance. Have: {self.w3.from_wei(hype_balance, 'ether'):.6f}, Need: {self.w3.from_wei(total_needed, 'ether'):.6f} (including gas)")
            
            # Add 20% buffer to gas estimate
            gas_limit = int(gas_estimate * 1.2)
            
            print(f"\n🔄 Depositing {amount_ether} HYPE to get WHYPE...")
            print(f"   Gas estimate: {gas_estimate}")
            print(f"   Gas limit: {gas_limit}")
            print(f"   Gas cost: {self.w3.from_wei(gas_cost, 'ether'):.6f} HYPE")
            
            # Build transaction
            transaction = self.contract.functions.deposit().build_transaction({
                'from': self.account.address,
                'value': amount_wei,
                'gas': gas_limit,
                'gasPrice': self.w3.eth.gas_price,
                'nonce': self.w3.eth.get_transaction_count(self.account.address),
                'chainId': CHAIN_ID
            })
            
            # Sign transaction
            signed_txn = self.w3.eth.account.sign_transaction(transaction, self.account.key)
            
            # Send transaction
            tx_hash = self.w3.eth.send_raw_transaction(signed_txn.rawTransaction)
            print(f"   Transaction hash: {tx_hash.hex()}")
            
            # Wait for confirmation
            print("   ⏳ Waiting for confirmation...")
            tx_receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            
            if tx_receipt.status == 1:
                print(f"   ✅ Successfully deposited {amount_ether} HYPE and received WHYPE!")
                print(f"   Gas used: {tx_receipt.gasUsed}")
                return tx_hash.hex()
            else:
                print(f"   ❌ Transaction failed!")
                return None
                
        except Exception as e:
            print(f"❌ Error depositing HYPE: {e}")
            return None
    
    def unwrap_hype(self, amount_ether):
        """Unwrap WHYPE tokens back to native HYPE using withdraw()"""
        try:
            # Convert ether to wei
            amount_wei = self.w3.to_wei(amount_ether, 'ether')
            
            print(f"🔍 Debug: Attempting to withdraw {amount_ether} WHYPE ({amount_wei} wei)")
            
            # Check if user has enough WHYPE
            whype_balance = self.contract.functions.balanceOf(self.account.address).call()
            print(f"🔍 Debug: Current WHYPE balance: {self.w3.from_wei(whype_balance, 'ether'):.6f} WHYPE")
            
            if whype_balance < amount_wei:
                raise Exception(f"Insufficient WHYPE balance. Have: {self.w3.from_wei(whype_balance, 'ether'):.6f}, Need: {amount_ether}")
            
            print(f"🔍 Debug: Sufficient WHYPE balance, proceeding with withdraw...")
            
            # Estimate gas
            print(f"🔍 Debug: Estimating gas for withdraw function...")
            gas_estimate = self.contract.functions.withdraw(amount_wei).estimate_gas({
                'from': self.account.address
            })
            
            # Add 20% buffer to gas estimate
            gas_limit = int(gas_estimate * 1.2)
            
            print(f"\n🔄 Withdrawing {amount_ether} WHYPE to get HYPE...")
            print(f"   Gas estimate: {gas_estimate}")
            print(f"   Gas limit: {gas_limit}")
            
            # Build transaction
            transaction = self.contract.functions.withdraw(amount_wei).build_transaction({
                'from': self.account.address,
                'gas': gas_limit,
                'gasPrice': self.w3.eth.gas_price,
                'nonce': self.w3.eth.get_transaction_count(self.account.address),
                'chainId': CHAIN_ID
            })
            
            # Sign transaction
            signed_txn = self.w3.eth.account.sign_transaction(transaction, self.account.key)
            
            # Send transaction
            tx_hash = self.w3.eth.send_raw_transaction(signed_txn.rawTransaction)
            print(f"   Transaction hash: {tx_hash.hex()}")
            
            # Wait for confirmation
            print("   ⏳ Waiting for confirmation...")
            tx_receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            
            if tx_receipt.status == 1:
                print(f"   ✅ Successfully withdrew {amount_ether} WHYPE and received HYPE!")
                print(f"   Gas used: {tx_receipt.gasUsed}")
                return tx_hash.hex()
            else:
                print(f"   ❌ Transaction failed!")
                return None
                
        except Exception as e:
            print(f"❌ Error withdrawing WHYPE: {e}")
            return None
    
    def get_contract_info(self):
        """Get contract information"""
        try:
            print(f"\n📋 Contract Information:")
            print(f"   Address: {Web3.to_checksum_address(WHYPE_CONTRACT_ADDRESS)}")
            print(f"   Name: {self.contract.functions.name().call()}")
            print(f"   Symbol: {self.contract.functions.symbol().call()}")
            
            # Get contract's total supply (total WHYPE in circulation)
            total_supply = self.contract.functions.totalSupply().call()
            total_supply_ether = self.w3.from_wei(total_supply, 'ether')
            print(f"   Total WHYPE Supply: {total_supply_ether:.6f} WHYPE")
            
            # Get contract's HYPE balance (should equal total supply)
            contract_hype_balance = self.w3.eth.get_balance(Web3.to_checksum_address(WHYPE_CONTRACT_ADDRESS))
            contract_hype_balance_ether = self.w3.from_wei(contract_hype_balance, 'ether')
            print(f"   Contract HYPE Balance: {contract_hype_balance_ether:.6f} HYPE")
            
        except Exception as e:
            print(f"❌ Error getting contract info: {e}")

def main():
    """Main function to run the HYPE wrapper/unwrapper"""
    print("🚀 HYPE ↔ WHYPE Wrapper/Unwrapper Script (MAINNET)")
    print("=" * 55)
    
    # REPLACE WITH YOUR ACTUAL MAINNET PRIVATE KEY
    # ⚠️  CRITICAL WARNING: This will interact with REAL FUNDS on MAINNET!
    MAINNET_PRIVATE_KEY = "0xe469510e586a6e0d982e137bc49d2aefef5dd76b36b8db64cb22af2ab8649eae"
    
    print("🚨 CRITICAL WARNING: MAINNET MODE ENABLED!")
    print("   This script will interact with REAL FUNDS on HyperEVM mainnet")
    print("   Make sure you have the correct private key and sufficient HYPE")
    print("   Double-check all amounts before confirming transactions!")
    print("   Never share or commit your private key!")
    
    try:
        # Initialize wrapper
        wrapper = HYPEWrapper(MAINNET_PRIVATE_KEY)
        
        # Show contract info
        wrapper.get_contract_info()
        
        # Show current balances
        wrapper.get_balances()
        
        # Safety confirmation for mainnet
        print("\n🚨 MAINNET SAFETY CHECK:")
        print("   You are about to interact with REAL FUNDS on HyperEVM mainnet!")
        print("   Make sure you understand what you're doing.")
        
        safety_confirm = input("\nType 'I UNDERSTAND' to continue: ").strip()
        if safety_confirm != "I UNDERSTAND":
            print("❌ Safety confirmation failed. Exiting for your protection.")
            return
        
        # Ask user what they want to do
        print("\n🎯 Choose an action:")
        print("   1. Deposit HYPE to get WHYPE (wrap)")
        print("   2. Withdraw WHYPE to get HYPE (unwrap)")
        
        try:
            choice = input("Enter your choice (1 or 2): ").strip()
            
            if choice == "1":
                # Deposit HYPE to get WHYPE
                try:
                    wrap_amount = float(input("\n🎯 Enter amount of HYPE to deposit: "))
                    if wrap_amount <= 0:
                        print("❌ Amount must be greater than 0")
                        return
                except ValueError:
                    print("❌ Invalid amount. Please enter a number.")
                    return
                
                # Check if user has enough HYPE
                hype_balance, _ = wrapper.get_balances()
                hype_balance_ether = wrapper.w3.from_wei(hype_balance, 'ether')
                
                if hype_balance_ether < wrap_amount:
                    print(f"❌ Insufficient HYPE balance!")
                    print(f"   You have: {hype_balance_ether:.6f} HYPE")
                    print(f"   You need: {wrap_amount} HYPE")
                    return
                
                print(f"🎯 Attempting to deposit {wrap_amount} HYPE...")
                
                tx_hash = wrapper.wrap_hype(wrap_amount)
                
                if tx_hash:
                    # Wait a bit and show updated balances
                    print("\n⏳ Waiting 5 seconds for blockchain update...")
                    time.sleep(5)
                    
                    print("\n📊 Updated Balances:")
                    wrapper.get_balances()
                    
                    print(f"\n🎉 Deposit completed successfully!")
                    print(f"   Transaction: {tx_hash}")
                else:
                    print("\n❌ Deposit failed!")
                    
            elif choice == "2":
                # Withdraw WHYPE to get HYPE
                try:
                    unwrap_amount = float(input("\n🎯 Enter amount of WHYPE to withdraw: "))
                    if unwrap_amount <= 0:
                        print("❌ Amount must be greater than 0")
                        return
                except ValueError:
                    print("❌ Invalid amount. Please enter a number.")
                    return
                
                # Check if user has enough WHYPE
                _, whype_balance = wrapper.get_balances()
                whype_balance_ether = wrapper.w3.from_wei(whype_balance, 'ether')
                
                if whype_balance_ether < unwrap_amount:
                    print(f"❌ Insufficient WHYPE balance!")
                    print(f"   You have: {whype_balance_ether:.6f} WHYPE")
                    print(f"   You need: {unwrap_amount} WHYPE")
                    return
                
                print(f"🎯 Attempting to withdraw {unwrap_amount} WHYPE...")
                
                tx_hash = wrapper.unwrap_hype(unwrap_amount)
                
                if tx_hash:
                    # Wait a bit and show updated balances
                    print("\n⏳ Waiting 5 seconds for blockchain update...")
                    time.sleep(5)
                    
                    print("\n📊 Updated Balances:")
                    wrapper.get_balances()
                    
                    print(f"\n🎉 Withdrawal completed successfully!")
                    print(f"   Transaction: {tx_hash}")
                else:
                    print("\n❌ Withdrawal failed!")
                    
            else:
                print("❌ Invalid choice. Please enter 1 or 2.")
                return
                
        except KeyboardInterrupt:
            print("\n\n👋 Operation cancelled by user.")
            return
        
    except Exception as e:
        print(f"\n💥 Script failed: {e}")
        print("\n🔧 Troubleshooting:")
        print("   1. Check your private key")
        print("   2. Ensure you have HYPE tokens")
        print("   3. Verify network connection")
        print("   4. Check contract address")

if __name__ == "__main__":
    main()
