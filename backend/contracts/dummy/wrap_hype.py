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
WHYPE_CONTRACT_ADDRESS = "0x62832DAA7B3E925e0bDCEcE457a665878FD3BF36"
HYPER_TESTNET_RPC = "https://hyperliquid-testnet.core.chainstack.com/f3ce6117a8d9cc6b9908d471f15d1686/evm"
CHAIN_ID = 998

# WHYPE Contract ABI (complete for wrap/unwrap functions)
WHYPE_ABI = [
    {
        "inputs": [],
        "name": "wrap",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [{"type": "uint256"}],
        "name": "unwrap",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getHYPEBalance",
        "outputs": [{"type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
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

class HYPEWrapper:
    def __init__(self, private_key):
        """Initialize the HYPE wrapper with a private key"""
        self.account = Account.from_key(private_key)
        self.w3 = Web3(Web3.HTTPProvider(HYPER_TESTNET_RPC))
        
        # Check connection
        if not self.w3.is_connected():
            raise Exception("Failed to connect to HyperEVM testnet")
        
        print(f"✅ Connected to HyperEVM testnet (Chain ID: {self.w3.eth.chain_id})")
        print(f"📱 Wallet address: {self.account.address}")
        
        # Initialize contract
        self.contract = self.w3.eth.contract(
            address=WHYPE_CONTRACT_ADDRESS,
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
            print(f"📍 Contract address: {WHYPE_CONTRACT_ADDRESS}")
            
            # Test if unwrap function is accessible
            try:
                # This will fail but we just want to check if the function exists in ABI
                self.contract.functions.unwrap(0).call()
            except Exception as e:
                if "execution reverted" in str(e).lower():
                    print("✅ Unwrap function accessible (execution reverted as expected for 0 amount)")
                else:
                    print(f"⚠️  Unwrap function test: {e}")
                    
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
        """Wrap native HYPE tokens to WHYPE"""
        try:
            # Convert ether to wei
            amount_wei = self.w3.to_wei(amount_ether, 'ether')
            
            # Check if user has enough HYPE
            hype_balance = self.w3.eth.get_balance(self.account.address)
            if hype_balance < amount_wei:
                raise Exception(f"Insufficient HYPE balance. Have: {self.w3.from_wei(hype_balance, 'ether'):.6f}, Need: {amount_ether}")
            
            # Estimate gas
            gas_estimate = self.contract.functions.wrap().estimate_gas({
                'from': self.account.address,
                'value': amount_wei
            })
            
            # Add 20% buffer to gas estimate
            gas_limit = int(gas_estimate * 1.2)
            
            print(f"\n🔄 Wrapping {amount_ether} HYPE to WHYPE...")
            print(f"   Gas estimate: {gas_estimate}")
            print(f"   Gas limit: {gas_limit}")
            
            # Build transaction
            transaction = self.contract.functions.wrap().build_transaction({
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
                print(f"   ✅ Successfully wrapped {amount_ether} HYPE to WHYPE!")
                print(f"   Gas used: {tx_receipt.gasUsed}")
                return tx_hash.hex()
            else:
                print(f"   ❌ Transaction failed!")
                return None
                
        except Exception as e:
            print(f"❌ Error wrapping HYPE: {e}")
            return None
    
    def unwrap_hype(self, amount_ether):
        """Unwrap WHYPE tokens back to native HYPE"""
        try:
            # Convert ether to wei
            amount_wei = self.w3.to_wei(amount_ether, 'ether')
            
            print(f"🔍 Debug: Attempting to unwrap {amount_ether} HYPE ({amount_wei} wei)")
            
            # Check if user has enough WHYPE
            whype_balance = self.contract.functions.balanceOf(self.account.address).call()
            print(f"🔍 Debug: Current WHYPE balance: {self.w3.from_wei(whype_balance, 'ether'):.6f} WHYPE")
            
            if whype_balance < amount_wei:
                raise Exception(f"Insufficient WHYPE balance. Have: {self.w3.from_wei(whype_balance, 'ether'):.6f}, Need: {amount_ether}")
            
            print(f"🔍 Debug: Sufficient WHYPE balance, proceeding with unwrap...")
            
            # Estimate gas
            print(f"🔍 Debug: Estimating gas for unwrap function...")
            gas_estimate = self.contract.functions.unwrap(amount_wei).estimate_gas({
                'from': self.account.address
            })
            
            # Add 20% buffer to gas estimate
            gas_limit = int(gas_estimate * 1.2)
            
            print(f"\n🔄 Unwrapping {amount_ether} WHYPE to HYPE...")
            print(f"   Gas estimate: {gas_estimate}")
            print(f"   Gas limit: {gas_limit}")
            
            # Build transaction
            transaction = self.contract.functions.unwrap(amount_wei).build_transaction({
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
                print(f"   ✅ Successfully unwrapped {amount_ether} WHYPE to HYPE!")
                print(f"   Gas used: {tx_receipt.gasUsed}")
                return tx_hash.hex()
            else:
                print(f"   ❌ Transaction failed!")
                return None
                
        except Exception as e:
            print(f"❌ Error unwrapping WHYPE: {e}")
            return None
    
    def get_contract_info(self):
        """Get contract information"""
        try:
            print(f"\n📋 Contract Information:")
            print(f"   Address: {WHYPE_CONTRACT_ADDRESS}")
            print(f"   Name: {self.contract.functions.name().call()}")
            print(f"   Symbol: {self.contract.functions.symbol().call()}")
            
            # Get contract's HYPE balance
            contract_hype_balance = self.contract.functions.getHYPEBalance().call()
            contract_hype_balance_ether = self.w3.from_wei(contract_hype_balance, 'ether')
            print(f"   Contract HYPE Balance: {contract_hype_balance_ether:.6f} HYPE")
            
        except Exception as e:
            print(f"❌ Error getting contract info: {e}")

def main():
    """Main function to run the HYPE wrapper/unwrapper"""
    print("🚀 HYPE ↔ WHYPE Wrapper/Unwrapper Script")
    print("=" * 50)
    
    # Dummy private key (REPLACE WITH YOUR ACTUAL PRIVATE KEY)
    # WARNING: Never share or commit your private key!
    DUMMY_PRIVATE_KEY = "0x6552964994ea750d3e04dfc6da73d7594f86c1ad78067082fc0f2e19394473bd"
    
    print("⚠️  WARNING: Using dummy private key!")
    print("   Replace DUMMY_PRIVATE_KEY with your actual private key")
    print("   Never share or commit your private key!")
    
    try:
        # Initialize wrapper
        wrapper = HYPEWrapper(DUMMY_PRIVATE_KEY)
        
        # Show contract info
        wrapper.get_contract_info()
        
        # Show current balances
        wrapper.get_balances()
        
        # Ask user what they want to do
        print("\n🎯 Choose an action:")
        print("   1. Wrap HYPE to WHYPE")
        print("   2. Unwrap WHYPE to HYPE")
        
        try:
            choice = input("Enter your choice (1 or 2): ").strip()
            
            if choice == "1":
                # Wrap HYPE to WHYPE
                try:
                    wrap_amount = float(input("\n🎯 Enter amount of HYPE to wrap: "))
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
                
                print(f"🎯 Attempting to wrap {wrap_amount} HYPE...")
                
                tx_hash = wrapper.wrap_hype(wrap_amount)
                
                if tx_hash:
                    # Wait a bit and show updated balances
                    print("\n⏳ Waiting 5 seconds for blockchain update...")
                    time.sleep(5)
                    
                    print("\n📊 Updated Balances:")
                    wrapper.get_balances()
                    
                    print(f"\n🎉 Wrapping completed successfully!")
                    print(f"   Transaction: {tx_hash}")
                else:
                    print("\n❌ Wrapping failed!")
                    
            elif choice == "2":
                # Unwrap WHYPE to HYPE
                try:
                    unwrap_amount = float(input("\n🎯 Enter amount of WHYPE to unwrap: "))
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
                
                print(f"🎯 Attempting to unwrap {unwrap_amount} WHYPE...")
                
                tx_hash = wrapper.unwrap_hype(unwrap_amount)
                
                if tx_hash:
                    # Wait a bit and show updated balances
                    print("\n⏳ Waiting 5 seconds for blockchain update...")
                    time.sleep(5)
                    
                    print("\n📊 Updated Balances:")
                    wrapper.get_balances()
                    
                    print(f"\n🎉 Unwrapping completed successfully!")
                    print(f"   Transaction: {tx_hash}")
                else:
                    print("\n❌ Unwrapping failed!")
                    
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
