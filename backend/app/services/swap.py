from typing import List
import logging
import os
import sys
import httpx


# Add the project root to Python path to make imports work from any directory
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(os.path.dirname(current_dir))

if backend_dir not in sys.path:
    sys.path.append(backend_dir)

from app.models.order import OrderOut, SwapData, OrderData, ActualOutput, OrderCreateRequest, OrderTriggeredRequest, UpdateOrderStateRequest, OutputSplit
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
import asyncio
swap_requests_queue = asyncio.Queue()
from app.services.gluex import Gluex

from dotenv import load_dotenv
from web3 import Web3
import json
print(os.getcwd())
if os.path.exists("backend/app/utils/ERC20.json"):
    ERC20_ABI = json.load(open("backend/app/utils/ERC20.json"))
    CONTRACT_ABI = json.load(open("backend/app/utils/CONTRACT.json"))
else:
    ERC20_ABI = json.load(open("app/utils/ERC20.json"))
    CONTRACT_ABI = json.load(open("app/utils/CONTRACT.json"))
load_dotenv()





w3 = Web3(Web3.HTTPProvider(os.getenv("ETH_RPC_URL") or "https://rpc.hyperliquid.xyz/evm"))
INTERMEDIATE_WALLET_ADDRESS = w3.to_checksum_address(os.getenv("INTERMEDIATE_WALLET_PUBLIC_KEY") or "0xBf879877e05430aC14fcEF6fE102DF29e264b114")
INTERMEDIATE_WALLET_PRIVATE_KEY = os.getenv("INTERMEDIATE_WALLET_PRIVATE_KEY") or "0x27215d451527c7353189c48c37cb6bae2f77db2ec7e2304595b1183ac62b13b"
CONTRACT_OWNER_ADDRESS = w3.to_checksum_address(os.getenv("CONTRACT_OWNER_PUBLIC_KEY") or "0x215adf3fb222206abcb35bfd105a10666741cb84")
CONTRACT_OWNER_PRIVATE_KEY = os.getenv("CONTRACT_OWNER_PRIVATE_KEY") or "0xdfa2173b303670f9277583c421483d26e00c493cfb61cd3f64722fa7d50cfa3d"
CONTRACT_ADDRESS = w3.to_checksum_address(os.getenv("CONTRACT_ADDRESS") or "0x07389a7F85B8F5d9a509ef4f607eFd41FEc8b129")
PROTOCOL_FEE_PERCENTAGE = float(os.getenv("PROTOCOL_FEE_PERCENTAGE", "0.005"))  # 0.5%
GLUEX_ADDRESS = w3.to_checksum_address(os.getenv("GLUEX_ADDRESS") or "0xe95F6EAeaE1E4d650576Af600b33D9F7e5f9f7fd")
BACKEND_JWT = os.getenv("BACKEND_JWT") or ""

##orderOut has input amount in ether!




async def register_swap(order: OrderOut) -> OrderOut:
    logger.info(f"Registering instant swap for order: {order}")
    
    # For instant swaps, process immediately and return the updated order
    if order.order_data.type == "instant_swap":
        logger.info(f"Processing instant swap for order: {order}")
        try:
            output_results = await swap(order)
            logger.info(json.dumps(output_results, indent=4))
            
            # Store the full output data in actual_outputs for frontend display
            # We'll store the raw output data instead of converting to ActualOutput
            actual_outputs = output_results
            
            # Create a new OrderOut with the actual_outputs populated
            updated_order = order.model_copy()
            updated_order.actual_outputs = actual_outputs
            updated_order.state = "done_successful"
            updated_order.termination_message = "Instant swap completed"
            
            return updated_order
            
        except Exception as e:
            logger.error(f"Error processing instant swap: {e}")
            # Return the original order with error state
            error_order = order.model_copy()
            error_order.state = "done_failed"
            error_order.termination_message = f"Instant swap failed: {str(e)}"
            return error_order
    else:
        # For conditional swaps, use the queue as before
        await swap_requests_queue.put(order)
        return order

async def process_swaps():
    try:
        while True:
            order = await swap_requests_queue.get()
            logger.info(f"Processing instant swap for order: {order}")
            try:
                output_results = await swap(order)
                logger.info(json.dumps(output_results, indent=4))
            except Exception as e:
                logger.error(f"Error processing swap: {e}")
            finally:
                swap_requests_queue.task_done()
    except asyncio.CancelledError:
        logger.info("Process swaps task cancelled")
        return


async def order_triggered(triggered_order: OrderTriggeredRequest):
 
    async with httpx.AsyncClient() as client:
        await client.post(f"{os.getenv('BACKEND_URL')}/api/order/triggered", json=triggered_order.model_dump(), headers={"Authorization": f"Bearer {BACKEND_JWT}"})
    
    

async def swap(order: OrderOut):
    """Process an instant swap order and return the results"""
    logger.info(f"Starting swap processing for order {order.id}")
    
    # try:
    #     # For now, return a simulated successful swap result
    #     # This simulates what would happen in a real swap
    #     simulated_outputs = []
        
    #     for output_split in order.swap_data.outputs:
    #         # Simulate successful swap for each output token
    #         simulated_output = {
    #             'input_token': order.swap_data.input_token,
    #             'percentage': output_split.percentage,
    #             'output_received': int(1000000000000000000),  # 1 token in wei (18 decimals)
    #             'input_amount_wei': int(order.swap_data.input_amount * (10 ** 18)),  # Convert to wei
    #             'input_amount_usd': str(order.swap_data.input_amount * 0.05),  # Simulated USD value
    #             'input_amount': order.swap_data.input_amount,
    #             'output_received_usd': str(0.05),  # Simulated output USD value
    #             'output_token': output_split.token,
    #             'gas_used': 200000,  # Simulated gas
    #             'txn_hash': f"0x{'0' * 64}",  # Simulated transaction hash
    #             'gas_price': 10000000000  # 10 gwei
    #         }
    #         simulated_outputs.append(simulated_output)
        
    #     logger.info(f"Swap simulation completed for order {order.id}")
    #     return simulated_outputs
        
    # except Exception as e:
    #     logger.error(f"Error in swap function: {e}")
    #     raise
    try:
        order_data = order.order_data
        user_address = w3.to_checksum_address(order.wallet)
        input_amount = order.swap_data.input_amount
        input_token = w3.to_checksum_address(order.swap_data.input_token)
        output_tokens:List[OutputSplit] = order.swap_data.outputs
        
        # Convert output token addresses to checksum format
        for output_split in output_tokens:
            output_split.token = w3.to_checksum_address(output_split.token)
        
        input_token_decimals = await get_token_decimals(input_token)
        input_amount_wei = int(input_amount * (10 ** input_token_decimals))



        user_balance = await get_token_balance(input_token, user_address)
        if user_balance < input_amount_wei:
            logger.error(f"Insufficient balance for {input_token} for user {user_address}, balance: {user_balance}, required: {input_amount_wei}")
            ##update order status as failed or similar
            return
        logger.info(f"User balance is sufficient for {input_token} for user {user_address}, balance: {user_balance}, required: {input_amount_wei}")
        # check if allowance is given
        allowance = await checkAllowance(input_token, user_address)
        if allowance < input_amount_wei:
            logger.error(f"Insufficient allowance for {input_token} for user {user_address}, allowance: {allowance}, required: {input_amount_wei}")
            ##update order status as failed or similar
            return
        logger.info(f"Allowance is sufficient for {input_token} for user {user_address}, allowance: {allowance}, required: {input_amount_wei}")
        
        withdrew_amount = await withdraw_from_user(user_address, input_token, input_amount_wei)
        if withdrew_amount == 0:
            logger.error(f"Withdrawal failed for {input_token} for user {user_address}")
            ##update order status as failed or similar
            return
        
    
        avlbl = withdrew_amount
        #avlbl = input_amount_wei
        output_results = []  
        user_gluex_object = Gluex(
            user_address=INTERMEDIATE_WALLET_ADDRESS,
        )
        
        #check gluex's allowance for input token
        gluex_allowance = await checkAllowance(input_token, INTERMEDIATE_WALLET_ADDRESS, contract_address = GLUEX_ADDRESS)
        if gluex_allowance < input_amount_wei:
            tx = await set_allowance(input_token, INTERMEDIATE_WALLET_ADDRESS, contract_address = GLUEX_ADDRESS)
            if tx is None:
                logger.error(f"Transaction failed for {input_token} to GLUEX_ADDRESS")
                ##update order status as failed or similar
                return
            else:
                logger.info(f"Successfully set allowance for {input_token} to GLUEX_ADDRESS")
                
        logger.info(f"Allowance is sufficient for {input_token} to GLUEX_ADDRESS, allowance: {gluex_allowance}, required: {input_amount_wei}")


        
        # Step 1: Prepare token amounts for direct quote fetching
        token_amounts = []
        remaining_balance = avlbl
        
        for output_token in output_tokens:
            amount_to_swap = int(remaining_balance * output_token.percentage / 100)  # Convert percentage to decimal
            remaining_balance = remaining_balance - amount_to_swap
            token_amounts.append({
                "token": output_token,
                "amount_to_swap": amount_to_swap
            })
        
        # Step 2: Get quotes directly for all tokens concurrently
        logger.info("🔄 Getting quotes directly for all tokens...")
        quote_tasks = []
        for token_info in token_amounts:
            quote_task = user_gluex_object.get_quote(
                input_token,
                token_info["token"].token,
                token_info["amount_to_swap"],
                user_address
            )
            quote_tasks.append(quote_task)
        
        quote_results = await asyncio.gather(*quote_tasks, return_exceptions=True)
        
        # Step 3: Process each quote result
        for i, (token_info, quote_result) in enumerate(zip(token_amounts, quote_results)):
            output_token = token_info["token"]
            amount_to_swap = token_info["amount_to_swap"]
            
            if isinstance(quote_result, Exception):
                logger.error(f"❌ Quote request failed for {input_token} to {output_token.token}: {quote_result}")
                continue
                
            if quote_result is None or quote_result.get("statusCode") != 200:
                logger.error(f"❌ Quote for {input_token} to {output_token.token} with amount {amount_to_swap} failed")
                continue
                
            logger.info(f"✅ Quote for {input_token} to {output_token.token} with amount {amount_to_swap} succeeded")
            
            # Validate quote result
            if "result" not in quote_result:
                logger.error(f"❌ Invalid quote result structure for {input_token} to {output_token.token}")
                continue
                
            calldata = quote_result["result"].get("calldata")
            revert = quote_result["result"].get("revert", False)
            lowBalance = quote_result["result"].get("lowBalance", False)
            
            if revert or lowBalance:
                logger.error(f"❌ Revert or low balance for {input_token} to {output_token.token} with amount {amount_to_swap}")
                continue
                
            logger.info(f"✅ Quote validation passed for {input_token} to {output_token.token}")
            
            # Simulate transaction
            simulation_success, output_amount, gas_price = await user_gluex_object.simulate_transaction(quote_result)
            if not simulation_success:
                logger.error(f"❌ Simulation failed for {input_token} to {output_token.token} with amount {amount_to_swap}")
                continue
                
            logger.info(f"✅ Simulation successful for {input_token} to {output_token.token} with amount {amount_to_swap}")
            
            # Send transaction
            txn_hash, gas_used, gas_price = await user_gluex_object.send_transaction(quote_result, gas_price)
            if txn_hash is None:
                logger.error(f"❌ Transaction failed for {input_token} to {output_token.token} with amount {amount_to_swap}")
                continue
                
            logger.info(f"✅ Transaction successful for {input_token} to {output_token.token} with amount {amount_to_swap}")
        
            # Create output result with simulated data for now
            output_dict = {
                "token": output_token.token,
                "percentage": output_token.percentage,
                "output_received": output_amount if output_amount else int(1000000000000000000),  # 1 token in wei (18 decimals)
                "input_amount_wei": amount_to_swap,
                "input_amount_usd": str(amount_to_swap / (10 ** input_token_decimals) * 0.05),  # Simulated USD value
                "input_amount": amount_to_swap / (10 ** input_token_decimals),
                "output_received_usd": str(0.05),  # Simulated output USD value
                "input_token": input_token,
                "output_token": output_token.token,
                "gas_used": gas_used if gas_used else 200000,  # Simulated gas
                "txn_hash": txn_hash, # Simulated transaction hash
                "gas_price": gas_price if gas_price else 10000000000  # 10 gwei
            }
            output_results.append(output_dict)

        return output_results
    except Exception as e:
        logger.error(f"Error in swap function: {e}")
        raise 



async def checkAllowance(tokenAddress: str, userAddress: str, contract_address: str = CONTRACT_ADDRESS):
    logger.info(f"Checking allowance for {tokenAddress} for {userAddress} in {contract_address}")
    #check if the user has enough allowance to swap the token
    token = w3.eth.contract(address=tokenAddress, abi=ERC20_ABI)
    allowance = token.functions.allowance(
        w3.to_checksum_address(userAddress),
        w3.to_checksum_address(contract_address)).call()
    return allowance



async def set_allowance(token_address: str, user_address: str, contract_address: str = CONTRACT_ADDRESS, amount= 115792089237316195423570985008687907853269984665640564039457584007913129):
    """
    Sets the allowance (approve) for a spender from the owner's wallet.
    :param web3: Web3 instance
    :param token_address: ERC-20 token contract
    :param owner_private_key: Private key of the owner
    :param spender: Address to approve
    :param amount: Allowance amount (in token's base units)
    :return: Transaction hash
    """
    acct = w3.eth.account.from_key(INTERMEDIATE_WALLET_ADDRESS)
    token = w3.eth.contract(address=w3.to_checksum_address(token_address), abi=ERC20_ABI)
    tx = token.functions.approve(w3.to_checksum_address(user_address), amount).build_transaction({
        "from": acct.address,
        "nonce": w3.eth.get_transaction_count(acct.address),
        "gas": 1000000,
        "gasPrice": w3.eth.gas_price*2,
    })

    signed = acct.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    decode_tx = w3.eth.wait_for_transaction_receipt(tx_hash)
    if decode_tx.status == 0:
        logger.error(f"Transaction failed: {decode_tx}")
        return None
    logger.info(f"Transaction receipt: {decode_tx}")
    return tx_hash

async def get_token_decimals(tokenAddress: str):
    token = w3.eth.contract(address=tokenAddress, abi=ERC20_ABI)
    decimals = token.functions.decimals().call()
    return decimals

async def get_token_balance(tokenAddress: str, userAddress: str):
    """
    input: tokenAddress, userAddress
    output: balance in wei
    """
    token = w3.eth.contract(address=tokenAddress, abi=ERC20_ABI)
    balance = token.functions.balanceOf(w3.to_checksum_address(userAddress)).call()
    return balance
async def withdraw_from_user(user_address, tokenAdress, amount_tokens):
        """Trigger the withdrawOnTrigger function
        input: user_address, amount_tokens in wei
        output: amount_tokens in wei
        """
        try:
            contract = w3.eth.contract(address=w3.to_checksum_address(CONTRACT_ADDRESS), abi=CONTRACT_ABI)
            owner = contract.functions.owner().call()
            if w3.to_checksum_address(CONTRACT_OWNER_ADDRESS) != owner:
                logger.error(f"Contract owner is {owner}, expected {CONTRACT_OWNER_ADDRESS}")
                logger.error(f"Only contract owner can call withdrawOnTrigger")
                return 0
            logger.info(f"Withdrawing from user: {user_address} amount: {amount_tokens}")
            # Check user balance
            checksum_user_address = w3.to_checksum_address(user_address)
            
            # Build transaction
            checksum_contract_owner = w3.to_checksum_address(CONTRACT_OWNER_ADDRESS)

            withdraw_txn = contract.functions.withdrawOnTrigger(
                checksum_user_address,
                w3.to_checksum_address(tokenAdress),
                amount_tokens
            ).build_transaction({
                'from': checksum_contract_owner,
                'gas': 300000,
                'gasPrice': max(w3.eth.gas_price, 10000000000),
                'nonce': w3.eth.get_transaction_count(checksum_contract_owner),
            })
            logger.info(f"Gas price: {w3.eth.gas_price}, max gas price: {max(w3.eth.gas_price, 10000000000)}")
            # Sign and send transaction
            
            signed_txn = w3.eth.account.sign_transaction(withdraw_txn, CONTRACT_OWNER_PRIVATE_KEY)
            tx_hash = w3.eth.send_raw_transaction(signed_txn.raw_transaction)
            
            logger.info(f"📤 Withdrawal transaction sent: {tx_hash.hex()}")
            
            # Wait for confirmation
            logger.info("⏳ Waiting for transaction confirmation...")
            tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
            print("hash: ", tx_hash.hex())
            
            if tx_receipt.status == 1:
                logger.info("✅ Withdrawal successful!")
                
                # Show updated balances         
                intermediate_wallet_balance = await get_token_balance(w3.to_checksum_address(tokenAdress), INTERMEDIATE_WALLET_ADDRESS)
                
                fee_in_tokens = int (amount_tokens * PROTOCOL_FEE_PERCENTAGE)
                usable_balance = int(min(intermediate_wallet_balance - fee_in_tokens, amount_tokens - fee_in_tokens))
                return usable_balance
            else:
                logger.error("❌ Withdrawal failed!")
                return 0
                
        except Exception as e:
            logger.error(f"❌ Withdrawal failed: {e}")
            return 0


import time
async def test_swap():


    order = OrderOut(
        id=1,
        user_id=1,
        wallet="0x6eDb432621208Ac44C9CcB3f19B36872f019F848",
        platform="hyperevm",
        swap_data=SwapData(
            input_token="0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb",
            input_amount=0.1,
            outputs=[OutputSplit(token="0xbe6727b535545c67d5caa73dea54865b92cf7907", percentage=0.5), OutputSplit(token="0x9fdbda0a5e284c32744d2f17ee5c74b284993463", percentage=0.5)]
        ),
        order_data = OrderData(
            type="instant_swap",
        ),
        time=int(time.time()),
        state="open"
    )
    result = await swap(order)
    
    return result

if __name__ == "__main__":
    timenow = int(time.time())
    result = asyncio.run(test_swap())
    print("Time taken:", int(time.time()) - timenow)
    print("Swap result:", result)