// Centralized token configuration for Hyperliquid
// This ensures consistency across all pages

export interface TokenConfig {
  symbol: string
  name: string
  address: string
  decimals: number
  icon: string
  isNative?: boolean // true for HYPE
}

// Official Hyperliquid token addresses
export const HYPERLIQUID_TOKENS: TokenConfig[] = [
  {
    symbol: "HYPE",
    name: "Hyperliquid",
    address: "0x2222222222222222222222222222222222222222", // Special address for native token
    decimals: 18,
    icon: "https://app.hyperliquid.xyz/coins/HYPE_USDC.svg",
    isNative: true
  },
  {
    symbol: "USDT",
    name: "Tether",
    address: "0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb",
    decimals: 6,
    icon: "https://app.hyperliquid.xyz/coins/USDT_USDC.svg"
  },
  {
    symbol: "UETH",
    name: "Unit Ethereum",
    address: "0xbe6727b535545c67d5caa73dea54865b92cf7907",
    decimals: 18,
    icon: "https://app.hyperliquid.xyz/coins/ETH_USDC.svg"
  },
  {
    symbol: "UBTC",
    name: "Unit Bitcoin",
    address: "0x9fdbda0a5e284c32744d2f17ee5c74b284993463",
    decimals: 8,
    icon: "https://app.hyperliquid.xyz/coins/BTC_USDC.svg"
  },
  {
    symbol: "USOL",
    name: "Unit Solana",
    address: "0x068f321fa8fb9f0d135f290ef6a3e2813e1c8a29",
    decimals: 9,
    icon: "https://app.hyperliquid.xyz/coins/SOL_USDC.svg"
  },
  {
    symbol: "USDE",
    name: "USD.e",
    address: "0x5d3a1ff2b6bab83b63cd9ad0787074081a52ef34",
    decimals: 18,
    icon: "https://app.hyperliquid.xyz/coins/USDE_USDC.svg"
  },
  // meme tokens
  {
    symbol: "UFART",
    name: "Unit Fartcoin",
    address: "0x3b4575e689ded21caad31d64c4df1f10f3b2cedf",
    decimals: 18,
    icon: "/coins-logos/ufart.jpg"
  },
  {
    symbol: "JEFF",
    name: "JEFF",
    address: "0x52e444545fbe9e5972a7a371299522f7871aec1f",
    decimals: 18,
    icon: "https://app.hyperliquid.xyz/coins/JEFF_USDC.svg"
  },
  {
    symbol: "HFUN",
    name: "HFUN",
    address: "0xa320d9f65ec992eff38622c63627856382db726c",
    decimals: 18,
    icon: "https://app.hyperliquid.xyz/coins/HFUN_USDC.svg"
  },
  {
    symbol: "PURR",
    name: "PURR",
    address: "0x9b498c3c8a0b8cd8ba1d9851d40d186f1872b44e",
    decimals: 18,
    icon: "https://app.hyperliquid.xyz/coins/PURR_USDC.svg"
  }
]

// Helper functions
export const getTokenByAddress = (address: string): TokenConfig | undefined => {
  return HYPERLIQUID_TOKENS.find(token => 
    token.address.toLowerCase() === address.toLowerCase()
  )
}

export const getTokenBySymbol = (symbol: string): TokenConfig | undefined => {
  return HYPERLIQUID_TOKENS.find(token => 
    token.symbol.toLowerCase() === symbol.toLowerCase()
  )
}

export const getERC20Tokens = (): TokenConfig[] => {
  return HYPERLIQUID_TOKENS.filter(token => !token.isNative)
}

export const getNativeToken = (): TokenConfig => {
  return HYPERLIQUID_TOKENS.find(token => token.isNative)!
}

// Create address-to-token mapping
export const ADDRESS_TO_TOKEN: Record<string, TokenConfig> = {}
HYPERLIQUID_TOKENS.forEach(token => {
  ADDRESS_TO_TOKEN[token.address.toLowerCase()] = token
})

// Default fallback prices (in USD)
export const DEFAULT_TOKEN_PRICES: Record<string, { price: number; change24h: number }> = {
  "HYPE": { price: 39.0, change24h: 3.2 },
  "USDT": { price: 1.0, change24h: 0.0 },
  "UETH": { price: 3500.0, change24h: 2.4 },
  "UBTC": { price: 118000.0, change24h: -1.2 },
  "USOL": { price: 166.0, change24h: 5.8 },
  "USDE": { price: 1.0, change24h: 0.1 },
  "UFART": { price: 0.001, change24h: 15.5 },
  "JEFF": { price: 0.05, change24h: -2.1 },
  "HFUN": { price: 0.02, change24h: 8.3 },
  "PURR": { price: 0.003, change24h: -5.2 }
}
