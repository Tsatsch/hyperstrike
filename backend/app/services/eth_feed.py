import asyncio
import websockets
import json

ALCHEMY_WS_URL = "wss://hyperliquid-mainnet.g.alchemy.com/v2/PrrJZ4YFV-5kCuHSOV3O4"
WATCH_ADDRESS = "0xB55c5B2d4D4524292F337619d7db58112d111ca0".lower()

# ERC-20 Transfer event signature hash (keccak256 of Transfer(address,address,uint256))
TRANSFER_EVENT_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

# Token contract address you want to monitor
TOKEN_CONTRACT_ADDRESS = "0x068f321Fa8Fb9f0D135f290Ef6a3e2813e1c8A29"  # Replace with real token

async def subscribe():
    async with websockets.connect(ALCHEMY_WS_URL) as ws:
        # 1. Subscribe to minedTransactions
        mined_tx_sub = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "eth_subscribe",
            "params": [
                "alchemy_minedTransactions",
                {
                    "addresses": [
                        {"from": WATCH_ADDRESS},
                        {"to": WATCH_ADDRESS}
                    ],
                    "includeRemoved": False,
                    "hashesOnly": False
                }
            ]
        }

        # 2. Subscribe to logs for Transfer events to WATCH_ADDRESS
        logs_sub = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "eth_subscribe",
            "params": [
                "logs",
                {
                    "address": TOKEN_CONTRACT_ADDRESS,
                    "topics": [
                        TRANSFER_EVENT_TOPIC,
                        None,
                        "0x000000000000000000000000" + WATCH_ADDRESS[2:]
                    ]
                }
            ]
        }

        await ws.send(json.dumps(mined_tx_sub))
        await ws.send(json.dumps(logs_sub))
        print(f"Subscribed to both mined txs and ERC20 incoming transfers for {WATCH_ADDRESS}")

        subs = {}

        while True:
            response = await ws.recv()
            data = json.loads(response)

            # Subscription ID mapping
            if "result" in data and "id" in data:
                if data["id"] == 1:
                    subs["mined"] = data["result"]
                elif data["id"] == 2:
                    subs["erc20"] = data["result"]
                continue

            # Route subscription messages
            if "params" in data:
                sub_id = data["params"]["subscription"]
                result = data["params"]["result"]

                if sub_id == subs.get("mined"):
                    tx = result["transaction"]
                    print(f"\n🚀 Mined TX involving {WATCH_ADDRESS}:")
                    print(f"  From:  {tx['from']}")
                    print(f"  To:    {tx.get('to')}")
                    print(f"  Hash:  {tx['hash']}")
                    print(f"  Value: {int(tx['value'], 16)} wei")

                elif sub_id == subs.get("erc20"):
                    print(f"\n📥 Incoming ERC-20 Transfer to {WATCH_ADDRESS}:")
                    print(f"  Log: {json.dumps(result, indent=2)}")

asyncio.run(subscribe())
