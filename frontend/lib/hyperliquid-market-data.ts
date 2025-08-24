// Hyperliquid market data service
// Fetches real-time market data for trading pairs from Hyperliquid Info API

export interface MarketData {
  symbol: string
  markPrice: number
  oraclePrice?: number
  change24h: number
  change24hPercent: number
  volume24h: number
  openInterest?: number
  fundingRate?: number
  fundingCountdown?: string
  lastUpdated: number
}

export interface HyperliquidMeta {
  name: string
  szDecimals: number
  maxLeverage?: number
  onlyIsolated?: boolean
}

export interface HyperliquidCandle {
  t: number // timestamp
  o: string // open
  h: string // high  
  l: string // low
  c: string // close
  v: string // volume
}

// Hyperliquid API endpoint
const HYPERLIQUID_API_URL = 'https://api.hyperliquid.xyz/info'

// Cache for market data
const marketDataCache = new Map<string, MarketData>()
const CACHE_DURATION = 30 * 1000 // 30 seconds

// Available trading pairs on Hyperliquid
export const HYPERLIQUID_PAIRS = [
  'BTC', 'ETH', 'SOL', 'DOGE', 'WIF', 'POPCAT', 'HYPE', 'XRP', 'SUI',
  'PENGU', 'TRUMP', 'PEPE', 'BONK', 'FARTCOIN', 'PNUT', 'GOAT', 'CHILLGUY',
  'ACT', 'GRASS', 'VIRTUAL', 'AI16Z', 'ZEREBRO', 'GRIFFAIN', 'FXGUYS',
  'MOODENG', 'NEIRO', 'AIXBT', 'VADER', 'APT', 'AVAX', 'LINK', 'ADA',
  'DOT', 'UNI', 'LTC', 'BCH', 'NEAR', 'ICP', 'ATOM', 'FTM', 'ALGO',
  'VET', 'TRX', 'EOS', 'XLM', 'AXS', 'SAND', 'MANA', 'ENJ', 'CHZ',
] as const

export type HyperliquidPair = typeof HYPERLIQUID_PAIRS[number]

// Fetch perpetuals metadata
export async function fetchPerpetualsMeta(): Promise<Record<string, HyperliquidMeta> | null> {
  try {
    const response = await fetch(HYPERLIQUID_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'meta' }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    
    // Convert array to object keyed by symbol
    const metaMap: Record<string, HyperliquidMeta> = {}
    if (data?.universe) {
      data.universe.forEach((item: any) => {
        metaMap[item.name] = {
          name: item.name,
          szDecimals: item.szDecimals || 0,
          maxLeverage: item.maxLeverage,
          onlyIsolated: item.onlyIsolated
        }
      })
    }
    
    return metaMap
  } catch (error) {
    console.error('Error fetching perpetuals metadata:', error)
    return null
  }
}

// Fetch all mid prices with symbol mapping
export async function fetchAllMidPrices(): Promise<Record<string, string> | null> {
  try {
    // Fetch both meta and mids in parallel
    const [metaResponse, midsResponse] = await Promise.all([
      fetch(HYPERLIQUID_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'meta' }),
      }),
      fetch(HYPERLIQUID_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'allMids' }),
      })
    ])

    if (!metaResponse.ok || !midsResponse.ok) {
      throw new Error(`HTTP error! meta: ${metaResponse.status}, mids: ${midsResponse.status}`)
    }

    const metaData = await metaResponse.json()
    const midsData = await midsResponse.json()

    // Map indices to symbols
    const symbolPrices: Record<string, string> = {}
    
    if (metaData.universe && Array.isArray(metaData.universe)) {
      metaData.universe.forEach((item: any, index: number) => {
        const price = midsData[`@${index}`]
        if (price && item.name) {
          symbolPrices[item.name] = price
        }
      })
    }

    return symbolPrices
  } catch (error) {
    console.error('Error fetching mid prices:', error)
    return null
  }
}

// Fetch 24h price change data
export async function fetch24hPriceChange(): Promise<{ meta: any; assetCtxs: any[] } | null> {
  try {
    const response = await fetch(HYPERLIQUID_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    
    // The API returns an array [meta, assetCtxs]
    if (Array.isArray(data) && data.length >= 2) {
      return {
        meta: data[0],
        assetCtxs: data[1]
      }
    }
    
    return null
  } catch (error) {
    console.error('Error fetching 24h price change:', error)
    return null
  }
}

// Fetch candle data for volume calculation
export async function fetchCandleSnapshot(coin: string, interval: string = '1d'): Promise<HyperliquidCandle[] | null> {
  try {
    const response = await fetch(HYPERLIQUID_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        type: 'candleSnapshot',
        req: {
          coin,
          interval,
          startTime: Date.now() - 24 * 60 * 60 * 1000, // 24h ago
          endTime: Date.now()
        }
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching candle data:', error)
    return null
  }
}

// Fetch funding rate data
export async function fetchFundingRate(coin: string): Promise<{ fundingRate: number; nextFundingTime: number } | null> {
  try {
    const response = await fetch(HYPERLIQUID_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'fundingHistory', coin, startTime: Date.now() - 60 * 60 * 1000 }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    
    if (data && data.length > 0) {
      const latest = data[data.length - 1]
      // Funding occurs every 8 hours (28800000 ms)
      const nextFundingTime = Math.ceil(Date.now() / 28800000) * 28800000
      
      return {
        fundingRate: parseFloat(latest.fundingRate || '0'),
        nextFundingTime
      }
    }

    return null
  } catch (error) {
    console.error('Error fetching funding rate:', error)
    return null
  }
}

// Get comprehensive market data for a trading pair
export async function getMarketData(symbol: string): Promise<MarketData | null> {
  const now = Date.now()
  const cacheKey = symbol
  
  // Check cache first
  const cached = marketDataCache.get(cacheKey)
  if (cached && (now - cached.lastUpdated) < CACHE_DURATION) {
    return cached
  }

  try {
    // Fetch required data in parallel
    const [priceChangeData, fundingData] = await Promise.all([
      fetch24hPriceChange(),
      fetchFundingRate(symbol)
    ])

    if (!priceChangeData?.meta || !priceChangeData?.assetCtxs) {
      throw new Error('Failed to fetch market data')
    }

    // Find the symbol index in meta
    const symbolIndex = priceChangeData.meta.universe?.findIndex((item: any) => item.name === symbol)
    
    if (symbolIndex === -1 || symbolIndex >= priceChangeData.assetCtxs.length) {
      throw new Error(`No data found for ${symbol}`)
    }

    const assetCtx = priceChangeData.assetCtxs[symbolIndex]
    
    if (!assetCtx) {
      throw new Error(`No asset context found for ${symbol}`)
    }

    // Use markPx from asset context as the current price (more reliable)
    const markPrice = parseFloat(assetCtx.markPx || '0')
    if (markPrice <= 0) {
      throw new Error(`No price data found for ${symbol}`)
    }

    // Extract 24h change data
    let change24h = 0
    let change24hPercent = 0
    let volume24h = 0
    let openInterest = 0

    // Calculate 24h change
    const prevDayPx = parseFloat(assetCtx.prevDayPx || '0')
    if (prevDayPx > 0) {
      change24h = markPrice - prevDayPx
      change24hPercent = (change24h / prevDayPx) * 100
    }

    // Get volume and open interest
    volume24h = parseFloat(assetCtx.dayNtlVlm || '0')
    openInterest = parseFloat(assetCtx.openInterest || '0')

    // Format funding countdown
    let fundingCountdown = ''
    if (fundingData?.nextFundingTime) {
      const timeUntilFunding = fundingData.nextFundingTime - now
      if (timeUntilFunding > 0) {
        const hours = Math.floor(timeUntilFunding / (60 * 60 * 1000))
        const minutes = Math.floor((timeUntilFunding % (60 * 60 * 1000)) / (60 * 1000))
        const seconds = Math.floor((timeUntilFunding % (60 * 1000)) / 1000)
        fundingCountdown = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      }
    }

    const marketData: MarketData = {
      symbol,
      markPrice,
      oraclePrice: parseFloat(assetCtx.oraclePx || assetCtx.markPx || '0'), // Use oracle price from API
      change24h,
      change24hPercent,
      volume24h,
      openInterest,
      fundingRate: fundingData?.fundingRate ? fundingData.fundingRate * 100 : undefined, // Convert to percentage
      fundingCountdown,
      lastUpdated: now
    }

    // Cache the result
    marketDataCache.set(cacheKey, marketData)
    
    return marketData
  } catch (error) {
    console.error(`Error fetching market data for ${symbol}:`, error)
    return null
  }
}

// Get market data for multiple symbols
export async function getBatchMarketData(symbols: string[]): Promise<Record<string, MarketData>> {
  const results: Record<string, MarketData> = {}
  
  // Process in parallel but with some throttling
  const batchSize = 5
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize)
    
    const batchPromises = batch.map(async (symbol) => {
      const data = await getMarketData(symbol)
      return { symbol, data }
    })

    const batchResults = await Promise.all(batchPromises)
    
    batchResults.forEach(({ symbol, data }) => {
      if (data) {
        results[symbol] = data
      }
    })

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < symbols.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  return results
}

// Get available trading pairs
export function getAvailablePairs(): readonly string[] {
  return HYPERLIQUID_PAIRS
}

// Clear market data cache
export function clearMarketDataCache(): void {
  marketDataCache.clear()
}

// Format price for display
export function formatPrice(price: number, decimals: number = 2): string {
  if (price < 0.01) {
    return price.toFixed(6)
  } else if (price < 1) {
    return price.toFixed(4)
  } else if (price < 100) {
    return price.toFixed(decimals)
  } else {
    return price.toLocaleString('en-US', { 
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals 
    })
  }
}

// Format volume for display
export function formatVolume(volume: number): string {
  if (volume >= 1e9) {
    return `$${(volume / 1e9).toFixed(2)}B`
  } else if (volume >= 1e6) {
    return `$${(volume / 1e6).toFixed(2)}M`
  } else if (volume >= 1e3) {
    return `$${(volume / 1e3).toFixed(2)}K`
  } else {
    return `$${volume.toFixed(2)}`
  }
}

// Format percentage for display
export function formatPercentage(percentage: number): string {
  const sign = percentage >= 0 ? '+' : ''
  return `${sign}${percentage.toFixed(2)}%`
}
