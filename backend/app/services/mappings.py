from hyperliquid.info import Info
from hyperliquid.utils import constants
import asyncio
import json
import time


#general convention: for different pairs of the same token: hype/usdc and hype/usdt: they are registed as: "hype_1" for /usdc, and "hype_2" for /usdt




async def get_name_coin_mapping(info: Info = None):
    """Generate a mapping between token names and their coin symbols"""
    spot_meta = info.spot_meta_and_asset_ctxs()
    universe = spot_meta[0]['universe']
    tokens = spot_meta[0]['tokens']
    market_data = spot_meta[1]
    
    # First pass: collect all data and count occurrences
    token_data = []
    name_counts = {}
    
    for i in range(len(universe)):
        token_metadata = tokens[universe[i]['tokens'][0]]
        market_info = market_data[universe[i]['index']]
        
        token_name = token_metadata['name']
        coin_symbol = market_info['coin']
        
        token_data.append((token_name, coin_symbol))
        name_counts[token_name] = name_counts.get(token_name, 0) + 1
    
    # Second pass: create mapping with appropriate names
    name_to_coin = {}
    name_counters = {}
    
    for token_name, coin_symbol in token_data:
        if name_counts[token_name] == 1:
            # Single occurrence - use original name
            unique_name = token_name
        else:
            # Multiple occurrences - add suffix
            if token_name not in name_counters:
                name_counters[token_name] = 0
            name_counters[token_name] += 1
            unique_name = f"{token_name}_{name_counters[token_name]}"
        
        name_to_coin[unique_name] = coin_symbol
    
    return name_to_coin

if __name__ == "__main__":
    exec = Info(base_url=constants.MAINNET_API_URL, skip_ws=True)
    current_time = time.time()
    
    # Generate the mapping
    mapping = asyncio.run(get_name_coin_mapping(exec))
    
    print(f"Execution time: {time.time() - current_time:.2f} seconds")
    print("Generated mapping:")
    print(json.dumps(mapping, indent=2))
    
    # Save to file
    with open('app/utils/name_coin_mapping.json', 'w') as f:
        json.dump(mapping, f, indent=2)
    
    print(f"\nMapping saved to 'backend/app/utils/name_coin_mapping.json'")
    print(f"Total mappings: {len(mapping)}")