// Hyperliquid price fetching service
// Uses the official Hyperliquid API to get real-time token prices

export interface HyperliquidMidPrice {
  [asset: string]: string; // asset name -> mid price as string
}

export interface HyperliquidTokenInfo {
  name: string;
  szDecimals: number;
  index: number;
}

export interface HyperliquidSpotMeta {
  tokens: HyperliquidTokenInfo[];
  universe: Array<{
    name: string;
    tokens: number[];
    index: number;
  }>;
}

interface PriceData {
  price: number;
  change24h: number;
  lastUpdated: number;
}

// Cache for token prices
const priceCache = new Map<string, PriceData>();
const CACHE_DURATION = 30 * 1000; // 30 seconds

// Hyperliquid API endpoint
const HYPERLIQUID_API_URL = 'https://api.hyperliquid.xyz/info';

// Fetch all mid prices from Hyperliquid
export async function fetchHyperliquidMidPrices(): Promise<HyperliquidMidPrice | null> {
  try {
    const response = await fetch(HYPERLIQUID_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'allMids' }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching Hyperliquid mid prices:', error);
    return null;
  }
}

// Fetch spot metadata to get token information
export async function fetchHyperliquidSpotMeta(): Promise<HyperliquidSpotMeta | null> {
  try {
    const response = await fetch(HYPERLIQUID_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'spotMeta' }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching Hyperliquid spot metadata:', error);
    return null;
  }
}

// Get cached price or fetch if expired
export async function getTokenPrice(symbol: string): Promise<number | null> {
  const now = Date.now();
  const cached = priceCache.get(symbol);
  
  if (cached && (now - cached.lastUpdated) < CACHE_DURATION) {
    return cached.price;
  }
  
  // Need to refresh - this will be handled by the batch update
  return null;
}

// Convert Hyperliquid Core/Info symbols to our internal symbols for pricing
const HYPERLIQUID_TO_INTERNAL_SYMBOL: Record<string, string> = {
  'USDT': 'USDT',
  'USDC': 'USDC',
  'ETH': 'UETH',
  'BTC': 'UBTC', 
  'SOL': 'USOL',
  'USDe': 'USDE',
  'HYPE': 'HYPE',
  'FART': 'UFART',
  'JEFF': 'JEFF',
  'HFUN': 'HFUN',
  'PURR': 'PURR'
};

// Update all token prices from Hyperliquid
export async function updateAllTokenPrices(): Promise<Record<string, { price: number; change24h: number }> | null> {
  try {
    const midPrices = await fetchHyperliquidMidPrices();
    if (!midPrices) {
      throw new Error('Failed to fetch mid prices');
    }

    const now = Date.now();
    const updatedPrices: Record<string, { price: number; change24h: number }> = {};

    // Process each price from Hyperliquid
    for (const [hyperliquidSymbol, priceStr] of Object.entries(midPrices)) {
      const price = parseFloat(priceStr);
      if (isNaN(price) || price <= 0) continue;

      // Convert to our internal symbol
      const internalSymbol = HYPERLIQUID_TO_INTERNAL_SYMBOL[hyperliquidSymbol] || hyperliquidSymbol;
      
      // Get previous price for change calculation
      const previousData = priceCache.get(internalSymbol);
      let change24h = 0;
      
      if (previousData) {
        change24h = ((price - previousData.price) / previousData.price) * 100;
      }

      // Update cache
      priceCache.set(internalSymbol, {
        price,
        change24h,
        lastUpdated: now
      });

      // Add to return object
      updatedPrices[internalSymbol] = { price, change24h };
    }
    
    // Ensure WHYPE always has the same price as HYPE
    if (updatedPrices['HYPE']) {
      const hypeData = updatedPrices['HYPE'];
      updatedPrices['WHYPE'] = {
        price: hypeData.price,
        change24h: hypeData.change24h
      };
      
      // Also update the cache for WHYPE
      priceCache.set('WHYPE', {
        price: hypeData.price,
        change24h: hypeData.change24h,
        lastUpdated: now
      });
    }

    console.log(`Updated ${Object.keys(updatedPrices).length} token prices from Hyperliquid`);
    return updatedPrices;
    
  } catch (error) {
    console.error('Error updating token prices from Hyperliquid:', error);
    return null;
  }
}

// Clear price cache (useful for testing or manual refresh)
export function clearPriceCache(): void {
  priceCache.clear();
}

// Get all cached prices
export function getAllCachedPrices(): Record<string, { price: number; change24h: number }> {
  const prices: Record<string, { price: number; change24h: number }> = {};
  
  for (const [symbol, data] of priceCache.entries()) {
    prices[symbol] = {
      price: data.price,
      change24h: data.change24h
    };
  }
  
  return prices;
}
