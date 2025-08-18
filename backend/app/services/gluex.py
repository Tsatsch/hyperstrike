import os
import requests
import dotenv
import json
from web3 import Web3
from eth_abi import decode

dotenv.load_dotenv()
GLUEX_API_KEY = os.getenv("NEXT_PUBLIC_GLUEX_API_KEY")
GLUEX_PID = os.getenv("NEXT_PUBLIC_GLUEX_PID")
GLUEX_URL = "https://router.gluex.xyz"
RPC_URL = os.getenv("NEXT_ETH_RPC_URL") or "https://rpc.hyperliquid.xyz/evm"
PRIVATE_KEY = os.getenv("PRIVATE_KEY")
PUBLIC_KEY = os.getenv("PUBLIC_KEY")
web3 = Web3(Web3.HTTPProvider(RPC_URL))
NATIVE_TOKEN_ADDRESS = "0x2222222222222222222222222222222222222222"

class Gluex:
    def __init__(self, user_address, chain_id="hyperevm"):
        if not GLUEX_API_KEY or not GLUEX_PID:
            raise RuntimeError("Missing GlueX API key or PID")

        self.chain_id = chain_id
        self.api_key = GLUEX_API_KEY
        self.unique_pid = GLUEX_PID
        self.user_address = user_address

    def _headers(self):
        return {
            "x-api-key": self.api_key,
            "Content-Type": "application/json",
        }

    def _build_payload(self, input_token, output_token, input_amount, output_receiver):
        return {
            "chainID": self.chain_id,
            "inputToken": input_token,
            "outputToken": output_token,
            "inputAmount": str(input_amount),
            "userAddress": self.user_address,
            "outputReceiver": output_receiver or self.user_address,
            "uniquePID": self.unique_pid
        }

    def get_price(self, input_token, output_token, input_amount, output_receiver=None):
        """
        Get a price from GlueX
        """
        payload = self._build_payload(input_token, output_token, input_amount, output_receiver)
        try:
            response = requests.post(
                f"{GLUEX_URL}/v1/price",
                headers=self._headers(),
                json=payload,
                timeout=10
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            raise RuntimeError(f"Failed to fetch price: {e}")

    def get_quote(self, input_token, output_token, input_amount, output_receiver=None):
        """
        Get a quote from GlueX
        """
        payload = self._build_payload(input_token, output_token, input_amount, output_receiver)
        try:
            response = requests.post(
                f"{GLUEX_URL}/v1/quote",
                headers=self._headers(),
                json=payload,
                timeout=10
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            raise RuntimeError(f"Failed to fetch quote: {e}")
        
    def simulate_transaction(quote):
        """
        Simulate a transaction
        Args:
            quote: The quote from GlueX
        Returns:
            output_amount: The output amount
            gas_price: The gas price
        """
        if not quote or quote.get("statusCode") != 200:
            print("Failed to fetch quote")
            return None, None

        result = quote["result"]
        calldata = result["calldata"]
        router = Web3.to_checksum_address(result["router"])
        value = int(result.get("value", 0))
        gas_price = int(web3.eth.gas_price * 2)

        tx = {
            "from": web3.eth.account.from_key(PRIVATE_KEY).address,
            "to": router,
            "data": calldata,
            "value": value,
            "gas": 1_000_000,
            "gasPrice": gas_price,
        }

        try:
            raw = web3.eth.call(tx, block_identifier="latest")
            output_amount = decode(['uint256'], raw)[0]
            return output_amount, gas_price
        except Exception as e:
            print(f"Simulation failed: {e}")
            return None, gas_price

        
    def send_transaction(quote, gas_price):
        """
        Send a transaction
        Args:
            quote: The quote from GlueX
            calldata: The calldata for the transaction
            gas_price: The gas price for the transaction
        Returns:
            tx_hash: The transaction hash
        """
        if not quote or quote.get("statusCode") != 200:
            print("Failed to fetch quote")
            return None
        calldata = quote["result"]["calldata"]
        account = web3.eth.account.from_key(PRIVATE_KEY)
        nonce = web3.eth.get_transaction_count(account.address, 'pending')
        router = Web3.to_checksum_address(quote["result"]["router"])
        value = int(quote["result"].get("inputAmount", 0)) if quote["result"]["inputToken"] == NATIVE_TOKEN_ADDRESS else 0
        tx = {
            "from": account.address,
            "to": router,
            "data": calldata,
            "gas": 1_000_000,
            "gasPrice": gas_price,
            "nonce": nonce,
            "value": value
        }
        signed = web3.eth.account.sign_transaction(tx, account.key)
        tx_hash = web3.eth.send_raw_transaction(signed.raw_transaction)
        return web3.eth.wait_for_transaction_receipt(tx_hash)



if __name__ == "__main__":
    user = "0x3CffeF055725974e32a660a617FC999b67E9196E" ## to be repalced with the central wallet
    receiver = "0x3CffeF055725974e32a660a617FC999b67E9196E"## to be replaced with the user address

    gluex = Gluex(user_address=user)

    price = gluex.get_price(
        input_token="0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34",
        output_token="0xBe6727B535545C67d5cAa73dEa54865B92CF7907",
        input_amount=1_000_000_000,
        output_receiver=receiver
    )
    print(json.dumps(price, indent=4))

    quote = gluex.get_quote(
        input_token="0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34",
        output_token="0xBe6727B535545C67d5cAa73dEa54865B92CF7907",
        input_amount=1_000_000_000,
        output_receiver=receiver
    )
    print(json.dumps(quote, indent=4))

    print(Gluex.simulate_transaction(quote))
