// Token data API integration for Hyperliquid
// Note: Alchemy metadata API only works for Ethereum mainnet, not Hyperliquid
// For Hyperliquid tokens, we'll need to use on-chain data or Hyperliquid's API

export interface TokenMetadata {
  name: string
  symbol: string
  decimals: number
  logo?: string
  totalSupply?: string
}

export interface TokenPrice {
  usd: number
  usd_24h_change: number
  usd_24h_vol: number
  usd_market_cap: number
}

export interface TokenMarketData {
  price: number
  change24h: number
  volume24h: number
  marketCap: number
  fullyDilutedValuation?: number
  totalVolume?: number
  high24h?: number
  low24h?: number
  priceChange24h?: number
  priceChangePercentage24h?: number
  marketCapChange24h?: number
  marketCapRank?: number
  circulatingSupply?: number
  totalSupply?: number
  maxSupply?: number
  ath?: number
  athChangePercentage?: number
  athDate?: string
  atl?: number
  atlChangePercentage?: number
  atlDate?: string
  roi?: any
  lastUpdated?: string
}

// Fetch token metadata for Hyperliquid tokens
export async function getTokenMetadata(contractAddress: string): Promise<TokenMetadata | null> {
  try {
    // For Hyperliquid, we'll need to use on-chain calls or Hyperliquid's API
    // Alchemy's metadata API doesn't support Hyperliquid tokens
    console.warn('Token metadata API not implemented for Hyperliquid tokens')
    
    // Return default metadata for now
    return {
      name: 'Unknown Token',
      symbol: 'UNKNOWN',
      decimals: 18,
      logo: undefined,
      totalSupply: undefined
    }
  } catch (error) {
    console.warn('Error fetching token metadata:', error)
    return null
  }
}

// Fetch token price data for Hyperliquid tokens
export async function getTokenPriceData(contractAddress: string): Promise<TokenMarketData | null> {
  try {
    // For Hyperliquid tokens, we'll need to use Hyperliquid's API or on-chain data
    // CoinGecko doesn't have Hyperliquid token prices
    console.warn('Token price API not implemented for Hyperliquid tokens')
    
    // Return default price data for now
    return {
      price: 0,
      change24h: 0,
      volume24h: 0,
      marketCap: 0,
      lastUpdated: new Date().toISOString()
    }
  } catch (error) {
    console.warn('Error fetching token price data:', error)
    return null
  }
}

// Get comprehensive token data (metadata + price) for Hyperliquid tokens
export async function getTokenData(contractAddress: string): Promise<{
  metadata: TokenMetadata | null
  marketData: TokenMarketData | null
} | null> {
  try {
    const [metadata, marketData] = await Promise.all([
      getTokenMetadata(contractAddress),
      getTokenPriceData(contractAddress)
    ])

    return {
      metadata,
      marketData
    }
  } catch (error) {
    console.error('Error fetching token data:', error)
    return null
  }
}

// Batch fetch multiple tokens
export async function getBatchTokenData(contractAddresses: string[]): Promise<Record<string, {
  metadata: TokenMetadata | null
  marketData: TokenMarketData | null
}>> {
  const results: Record<string, {
    metadata: TokenMetadata | null
    marketData: TokenMarketData | null
  }> = {}

  // Process in batches to avoid rate limiting
  const batchSize = 5
  for (let i = 0; i < contractAddresses.length; i += batchSize) {
    const batch = contractAddresses.slice(i, i + batchSize)
    
    const batchPromises = batch.map(async (address) => {
      const data = await getTokenData(address)
      return { address, data }
    })

    const batchResults = await Promise.all(batchPromises)
    
    batchResults.forEach(({ address, data }) => {
      if (data) {
        results[address] = data
      }
    })

    // Add delay between batches to respect rate limits
    if (i + batchSize < contractAddresses.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  return results
}
