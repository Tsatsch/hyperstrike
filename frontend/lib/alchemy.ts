// Alchemy API integration for real-time token data
const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
const ALCHEMY_BASE_URL = 'https://eth-mainnet.g.alchemy.com/v2'

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

// Fetch token metadata from Alchemy
export async function getTokenMetadata(contractAddress: string): Promise<TokenMetadata | null> {
  try {
    if (!ALCHEMY_API_KEY) {
      console.warn('Alchemy API key not found - skipping metadata fetch')
      return null
    }

    // Use Alchemy's getTokenMetadata endpoint
    const response = await fetch(`${ALCHEMY_BASE_URL}/${ALCHEMY_API_KEY}/getTokenMetadata?contractAddress=${contractAddress}`)
    
    if (!response.ok) {
      if (response.status === 403) {
        console.warn('Alchemy API key invalid or missing permissions - skipping metadata fetch')
      } else {
        console.warn(`Alchemy API returned ${response.status} - skipping metadata fetch`)
      }
      return null
    }

    const data = await response.json()
    
    return {
      name: data.name || 'Unknown Token',
      symbol: data.symbol || 'UNKNOWN',
      decimals: data.decimals || 18,
      logo: data.logo,
      totalSupply: data.totalSupply
    }
  } catch (error) {
    console.warn('Error fetching token metadata from Alchemy:', error)
    return null
  }
}

// Fetch token price data from CoinGecko (as fallback since Alchemy doesn't provide price data)
export async function getTokenPriceData(contractAddress: string): Promise<TokenMarketData | null> {
  try {
    // Use CoinGecko API as Alchemy doesn't provide price data
    const response = await fetch(`https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=${contractAddress}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`)
    
    if (!response.ok) {
      console.warn(`CoinGecko API returned ${response.status} - skipping price data fetch`)
      return null
    }

    const data = await response.json()
    const tokenData = data[contractAddress.toLowerCase()]
    
    if (!tokenData) {
      console.warn(`No price data found for token ${contractAddress}`)
      return null
    }

    return {
      price: tokenData.usd || 0,
      change24h: tokenData.usd_24h_change || 0,
      volume24h: tokenData.usd_24h_vol || 0,
      marketCap: tokenData.usd_market_cap || 0,
      lastUpdated: new Date().toISOString()
    }
  } catch (error) {
    console.warn('Error fetching token price data from CoinGecko:', error)
    return null
  }
}

// Get comprehensive token data (metadata + price)
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
