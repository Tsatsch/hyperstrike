"use client"

import { useState, useEffect } from "react"
import { usePrivy } from '@privy-io/react-auth'
import { getBackendJwt, exchangePrivyForBackendJwt } from '@/lib/api'
import { getUserIdFromWallet } from '@/lib/wallet-utils'
import { fetchTokenBalances, fetchHYPEBalance } from '@/lib/token-balances'
import { getBatchTokenData, TokenMetadata, TokenMarketData } from '@/lib/alchemy'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArrowRight, Search, TrendingUp, Users, Clock, Target, Wallet, BarChart3, ArrowUpDown, Activity, Bell, Settings, User, Copy, ExternalLink, X } from "lucide-react"
import { WalletButton } from "@/components/WalletButton"
import { ThemeToggle } from "@/components/theme-toggle"
import { Footer } from "@/components/footer"
import { Logo } from "@/components/Logo"

interface Token {
  symbol: string
  name: string
  price: number
  change24h: number
  address?: string
  balance: number
  icon: string
  metadata?: TokenMetadata | null
  marketData?: TokenMarketData | null
  lastUpdated?: string
}

// Initial token configuration with contract addresses (no hardcoded prices)
const initialTokens: Token[] = [
  { symbol: "USDT", name: "Tether", price: 0, change24h: 0, address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", balance: 0, icon: "/coins-logos/usdt.svg" },
  { symbol: "UETH", name: "Unit Ethereum", price: 0, change24h: 0, address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", balance: 0, icon: "/coins-logos/eth.svg" },
  { symbol: "UBTC", name: "Unit Bitcoin", price: 0, change24h: 0, address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", balance: 0, icon: "/coins-logos/btc.svg" },
  { symbol: "USOL", name: "Unit Solana", price: 0, change24h: 0, address: "0xD31a59c85aE9D8edEFeC411D448f90841571b89c", balance: 0, icon: "/coins-logos/sol.svg" },
  { symbol: "USDE", name: "USD.e", price: 0, change24h: 0, address: "0x5d3a1ff2b6bab83b63cd9ad0787074081a52ef34", balance: 0, icon: "/coins-logos/usde.svg" },
  { symbol: "HYPE", name: "Hype", price: 0, change24h: 0, address: "0x2222222222222222222222222222222222222222", balance: 0, icon: "/coins-logos/hyperliquid.svg" },
  { symbol: "UFART", name: "Unit Fartcoin", price: 0, change24h: 0, address: "0x3b4575e689ded21caad31d64c4df1f10f3b2cedf", balance: 0, icon: "/coins-logos/ufart.jpg" },
  { symbol: "JEFF", name: "JEFF", price: 0, change24h: 0, address: "0x52e444545fbe9e5972a7a371299522f7871aec1f", balance: 0, icon: "https://app.hyperliquid.xyz/coins/JEFF_USDC.svg" },
  { symbol: "HFART", name: "HFUN", price: 0, change24h: 0, address: "0xa320d9f65ec992eff38622c63627856382db726c", balance: 0, icon: "https://app.hyperliquid.xyz/coins/HFUN_USDC.svg" },
]

const conditionTypes = [
  {
    id: "ohlcvn",
    name: "OHLCV",
    description: "Execute based on OHLCV data of a token",
    icon: TrendingUp,
    popular: true,
  },
  {
    id: "wallet_activity",
    name: "Wallet Activity",
    description: "Execute based on specific wallet transactions",
    icon: Wallet,
    popular: true,
  },
  {
    id: "time_based",
    name: "Time Based",
    description: "Execute at a specific time or interval",
    icon: Clock,
    popular: false,
  },
  {
    id: "volume_trigger",
    name: "Volume Trigger",
    description: "Execute when trading volume reaches threshold",
    icon: BarChart3,
    popular: false,
  },
  {
    id: "multi_token",
    name: "Multi-Token Condition",
    description: "Execute based on multiple token price movements",
    icon: Target,
    popular: false,
  },
  {
    id: "social_sentiment",
    name: "Social Sentiment",
    description: "Execute based on social media sentiment analysis",
    icon: Users,
    popular: false,
  },
]

export default function TradingPlatform() {
  const { authenticated, login, user, getAccessToken } = usePrivy();
  const [currentStep, setCurrentStep] = useState(1)
  const [showWalletPrompt, setShowWalletPrompt] = useState(false)
  const [pendingPlatform, setPendingPlatform] = useState<"hyperevm" | "hypercore" | null>(null)
  const [tokens, setTokens] = useState<Token[]>(initialTokens)
  const [fromToken, setFromToken] = useState<Token | null>(initialTokens.find(t => t.symbol === "USDT") || null)
  const [toTokens, setToTokens] = useState<Token[]>([])
  const [tokenBalances, setTokenBalances] = useState<Record<string, string>>({})
  const [conditionType, setConditionType] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedPlatform, setSelectedPlatform] = useState<"hyperevm" | "hypercore" | null>(null)
  const [tokenSearchTerm, setTokenSearchTerm] = useState("")
  const [customTokenAddress, setCustomTokenAddress] = useState("")
  const [showCustomTokenInput, setShowCustomTokenInput] = useState(false)
  const [showFromTokenModal, setShowFromTokenModal] = useState(false)
  const [showToTokenModal, setShowToTokenModal] = useState(false)
  const [fromAmount, setFromAmount] = useState("")
  const [toPercentages, setToPercentages] = useState<Record<string, string>>({})
  const [triggerToken, setTriggerToken] = useState<string>("");
  const [timeframe, setTimeframe] = useState<string>("");
  const [condition, setCondition] = useState<string>("");
  const [triggerWhen, setTriggerWhen] = useState<string>("above");
  const [targetValue, setTargetValue] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [showSuccessPage, setShowSuccessPage] = useState(false);
  const [isLoadingPrices, setIsLoadingPrices] = useState(true);
  const [priceCache, setPriceCache] = useState<Record<string, { price: number; change24h: number }>>({});

  // Mapping from contract address to tokens
  const contractAddressToToken: { [key: string]: Token | undefined } = {
    "0x2222222222222222222222222222222222222222": tokens.find(t => t.symbol === "HYPE"),
    "0xdAC17F958D2ee523a2206206994597C13D831ec7": tokens.find(t => t.symbol === "USDT"),
    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2": tokens.find(t => t.symbol === "UETH"),
    "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599": tokens.find(t => t.symbol === "UBTC"),
    "0xD31a59c85aE9D8edEFeC411D448f90841571b89c": tokens.find(t => t.symbol === "USOL"),
    "0x5d3a1ff2b6bab83b63cd9ad0787074081a52ef34": tokens.find(t => t.symbol === "USDE"),
    // Additional token mappings
    "0x9b498c3c8a0b8cd8ba1d9851d40d186f1872b44e": { symbol: "PURR", name: "PURR", price: 0, change24h: 0, balance: 0, icon: "/coins-logos/unknown.jpg" },
    "0xa320d9f65ec992eff38622c63627856382db726c": { symbol: "HFUN", name: "HFUN", price: 0, change24h: 0, balance: 0, icon: "/coins-logos/unknown.jpg" },
    "0x52e444545fbe9e5972a7a371299522f7871aec1f": { symbol: "JEFF", name: "JEFF", price: 0, change24h: 0, balance: 0, icon: "/coins-logos/unknown.jpg" },
    "0xb09158c8297acee00b900dc1f8715df46b7246a6": { symbol: "VEGAS", name: "VEGAS", price: 0, change24h: 0, balance: 0, icon: "/coins-logos/unknown.jpg" },
    "0xe3d5f45d97fee83b48c85e00c8359a2e07d68fee": { symbol: "ADHD", name: "ADHD", price: 0, change24h: 0, balance: 0, icon: "/coins-logos/unknown.jpg" },
    "0x11735dbd0b97cfa7accf47d005673ba185f7fd49": { symbol: "CATBAL", name: "CATBAL", price: 0, change24h: 0, balance: 0, icon: "/coins-logos/unknown.jpg" },
    "0x45ec8f63fe934c0213476cfb5870835e61dd11fa": { symbol: "OMNIX", name: "OMNIX", price: 0, change24h: 0, balance: 0, icon: "/coins-logos/unknown.jpg" },
    "0xd2fe47eed2d52725d9e3ae6df45593837f57c1a2": { symbol: "SPH", name: "SPH", price: 0, change24h: 0, balance: 0, icon: "/coins-logos/unknown.jpg" },
    "0x1bee6762f0b522c606dc2ffb106c0bb391b2e309": { symbol: "PIP", name: "PIP", price: 0, change24h: 0, balance: 0, icon: "/coins-logos/unknown.jpg" },
    "0x7280cc1f369ab574c35cb8a8d0885e9486e3b733": { symbol: "YEETI", name: "YEETI", price: 0, change24h: 0, balance: 0, icon: "/coins-logos/unknown.jpg" },
    "0xc1631903081b19f0b7117f34192c7db48960989c": { symbol: "NIGGO", name: "NIGGO", price: 0, change24h: 0, balance: 0, icon: "/coins-logos/unknown.jpg" },
    "0x6f7e96c0267cd22fe04346af21f8c6ff54372939": { symbol: "GENESY", name: "GENESY", price: 0, change24h: 0, balance: 0, icon: "/coins-logos/unknown.jpg" },
    "0x04d02cb2e963b4490ee02b1925223d04f9d83fc6": { symbol: "CAT", name: "CAT", price: 0, change24h: 0, balance: 0, icon: "/coins-logos/unknown.jpg" },
    "0x710a6c044d23949ba3b98ce13d762503c9708ba3": { symbol: "BEATS", name: "BEATS", price: 0, change24h: 0, balance: 0, icon: "/coins-logos/unknown.jpg" },
    "0x1ecd15865d7f8019d546f76d095d9c93cc34edfa": { symbol: "LIQD", name: "LIQD", price: 0, change24h: 0, balance: 0, icon: "/coins-logos/unknown.jpg" },
    "0x78c3791ea49a7c6f41e87ba96c7d09a493febb1e": { symbol: "H", name: "H", price: 0, change24h: 0, balance: 0, icon: "/coins-logos/unknown.jpg" },
    "0x3f244819a8359145a8e7cf0272955e4918a50627": { symbol: "FLY", name: "FLY", price: 0, change24h: 0, balance: 0, icon: "/coins-logos/unknown.jpg" },
    "0x266a2491f782eb03b369760889fff8785efb3e46": { symbol: "TIME", name: "TIME", price: 0, change24h: 0, balance: 0, icon: "/coins-logos/unknown.jpg" },
    "0x5804bf271d9e691611eea1267b24c1f3d0723639": { symbol: "HWTR", name: "HWTR", price: 0, change24h: 0, balance: 0, icon: "/coins-logos/unknown.jpg" },
    "0x9fdbda0a5e284c32744d2f17ee5c74b284993463": { symbol: "UBTC", name: "UBTC", price: 0, change24h: 0, balance: 0, icon: "/coins-logos/unknown.jpg" },
    "0xc12b4dd5268322ddbe3d6f65ebb1ce37a9951315": { symbol: "VORTX", name: "VORTX", price: 0, change24h: 0, balance: 0, icon: "/coins-logos/unknown.jpg" },
    "0xc11579f984d07af75b0164ac458583a0d39d619a": { symbol: "JPEG", name: "JPEG", price: 0, change24h: 0, balance: 0, icon: "/coins-logos/unknown.jpg" },
    "0xbe6727b535545c67d5caa73dea54865b92cf7907": { symbol: "UETH", name: "UETH", price: 0, change24h: 0, balance: 0, icon: "/coins-logos/unknown.jpg" },
    "0xca79db4b49f608ef54a5cb813fbed3a6387bc645": { symbol: "USDXL", name: "USDXL", price: 0, change24h: 0, balance: 0, icon: "/coins-logos/unknown.jpg" },
    "0x02c6a2fa58cc01a18b8d9e00ea48d65e4df26c70": { symbol: "FEUSD", name: "FEUSD", price: 0, change24h: 0, balance: 0, icon: "/coins-logos/unknown.jpg" },
    "0x068f321fa8fb9f0d135f290ef6a3e2813e1c8a29": { symbol: "USOL", name: "USOL", price: 0, change24h: 0, balance: 0, icon: "/coins-logos/unknown.jpg" },
    "0x47bb061c0204af921f43dc73c7d7768d2672ddee": { symbol: "BUDDY", name: "BUDDY", price: 0, change24h: 0, balance: 0, icon: "/coins-logos/unknown.jpg" },
    "0x3b4575e689ded21caad31d64c4df1f10f3b2cedf": { symbol: "UFART", name: "UFART", price: 0, change24h: 0, balance: 0, icon: "/coins-logos/unknown.jpg" },
    "0xf0c82d188ee54958813e7ac650e119135fc35e94": { symbol: "PENIS", name: "PENIS", price: 0, change24h: 0, balance: 0, icon: "/coins-logos/unknown.jpg" },
    "0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb": { symbol: "USDT0", name: "USDT0", price: 0, change24h: 0, balance: 0, icon: "/coins-logos/unknown.jpg" },
    "0x28245ab01298eaef7933bc90d35bd9dbca5c89db": { symbol: "PEG", name: "PEG", price: 0, change24h: 0, balance: 0, icon: "/coins-logos/unknown.jpg" },
    "0x8ff0dd9f9c40a0d76ef1bcfaf5f98c1610c74bd8": { symbol: "USH", name: "USH", price: 0, change24h: 0, balance: 0, icon: "/coins-logos/unknown.jpg" },
    "0x7dcffcb06b40344eeced2d1cbf096b299fe4b405": { symbol: "RUB", name: "RUB", price: 0, change24h: 0, balance: 0, icon: "/coins-logos/unknown.jpg" },
    "0xd2567ee20d75e8b74b44875173054365f6eb5052": { symbol: "PERP", name: "PERP", price: 0, change24h: 0, balance: 0, icon: "/coins-logos/unknown.jpg" },
    "0x0ad339d66bf4aed5ce31c64bc37b3244b6394a77": { symbol: "USR", name: "USR", price: 0, change24h: 0, balance: 0, icon: "/coins-logos/unknown.jpg" },
    "0xb50a96253abdf803d85efcdce07ad8becbc52bd5": { symbol: "USDHL", name: "USDHL", price: 0, change24h: 0, balance: 0, icon: "/coins-logos/unknown.jpg" },
    "0xf4d9235269a96aadafc9adae454a0618ebe37949": { symbol: "XAUT0", name: "XAUT0", price: 0, change24h: 0, balance: 0, icon: "/coins-logos/unknown.jpg" },
    "0x27ec642013bcb3d80ca3706599d3cda04f6f4452": { symbol: "UPUMP", name: "UPUMP", price: 0, change24h: 0, balance: 0, icon: "/coins-logos/unknown.jpg" },
    "0x502ee789b448aa692901fe27ab03174c90f07dd1": { symbol: "STLOOP", name: "STLOOP", price: 0, change24h: 0, balance: 0, icon: "/coins-logos/unknown.jpg" },
    "0xe7eaa46c2ac8470d622ada1538fede6242cebe53": { symbol: "LATINA", name: "LATINA", price: 0, change24h: 0, balance: 0, icon: "/coins-logos/unknown.jpg" },
  };

  useEffect(() => {
    if (showFromTokenModal || showToTokenModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [showFromTokenModal, showToTokenModal]);

  const filteredTokens = tokens.filter(
    (token) =>
      token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      token.name.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const filteredTokenSearch = (() => {
    // Start with tokens that match search term by symbol, name, or address
    let filtered = tokens.filter(
      (token) =>
        token.symbol.toLowerCase().includes(tokenSearchTerm.toLowerCase()) ||
        token.name.toLowerCase().includes(tokenSearchTerm.toLowerCase()) ||
        (token.address && token.address.toLowerCase().includes(tokenSearchTerm.toLowerCase())),
    )

    // If search term looks like a contract address (starts with 0x and is 42 chars), 
    // check if it exists in our contract mapping
    if (tokenSearchTerm.startsWith('0x') && tokenSearchTerm.length === 42) {
      const addressLower = tokenSearchTerm.toLowerCase()
      const tokenFromMapping = contractAddressToToken[addressLower]
      
      if (tokenFromMapping && !filtered.find(t => t.symbol === tokenFromMapping.symbol)) {
        // Add the token from mapping if it's not already in the filtered results
        filtered.push({
          ...tokenFromMapping,
          address: addressLower
        })
      }
    }

    return filtered
  })()

  // Filter out the sell token from the buy token list
  const availableBuyTokens = filteredTokenSearch.filter(token => 
    !fromToken || token.symbol !== fromToken.symbol
  )

  const handleSwapTokens = () => {
    const temp = fromToken
    const tempAmount = fromAmount
    setFromToken(toTokens[0] || null)
    setToTokens(fromToken ? [fromToken] : [])
    setFromAmount(toPercentages[toTokens[0]?.symbol || ''] || '')
    setToPercentages(fromToken ? { [fromToken.symbol]: tempAmount } : {})
  }

  // Function to fetch balance for a specific token
  const fetchTokenBalance = async (token: Token) => {
    if (!authenticated || !user?.wallet?.address || !token.address) {
      return
    }

    try {
      console.log(`🔍 Fetching balance for ${token.symbol} at ${token.address}`)
      
      if (token.address === "0x2222222222222222222222222222222222222222") {
        // Handle HYPE token separately
        const balance = await fetchHYPEBalance(user.wallet.address)
        setTokenBalances(prev => ({
          ...prev,
          [token.address!]: balance
        }))
        console.log(`💰 Fetched ${token.symbol} balance:`, balance)
      } else {
        // Handle ERC20 token
        const balances = await fetchTokenBalances(user.wallet.address, [token.address])
        setTokenBalances(prev => ({
          ...prev,
          ...balances
        }))
        console.log(`💰 Fetched ${token.symbol} balance:`, balances[token.address])
      }
    } catch (error) {
      console.error(`❌ Error fetching balance for ${token.symbol}:`, error)
    }
  }

  const handleTokenSelect = (token: Token, isFrom: boolean) => {
    // Check if this token is from contract mapping (not in initialTokens)
    const isFromContractMapping = !tokens.find(t => t.symbol === token.symbol && t.address === token.address)
    
    if (isFrom) {
      setFromToken(token)
      setShowFromTokenModal(false)
      // Clear toTokens if they contain the same token as the new fromToken
      setToTokens(prev => prev.filter(t => t.symbol !== token.symbol))
      const newToPercentages = { ...toPercentages }
      delete newToPercentages[token.symbol]
      setToPercentages(newToPercentages)
    } else {
      // Add token to toTokens array if not already present
      setToTokens(prev => {
        if (prev.find(t => t.symbol === token.symbol)) {
          return prev // Token already exists
        }
        return [...prev, token]
      })
      setShowToTokenModal(false)
    }

    // Fetch balance if token is from contract mapping and we don't have its balance yet
    if (isFromContractMapping && token.address && !tokenBalances[token.address]) {
      fetchTokenBalance(token)
    }

    setTokenSearchTerm("")
    setShowCustomTokenInput(false)
  }

  const handleCustomTokenAddress = (address: string, isFrom: boolean) => {
    const token = contractAddressToToken[address] || {
      symbol: "CUSTOM",
      name: "Custom Token",
      price: 0,
      change24h: 0,
      address: address,
      balance: 0,
      icon: '/coins-logos/unknown.jpg'
    }
    
    const tokenWithIcon = {...token, icon: token.icon || '/coins-logos/unknown.jpg'}
    
    if (isFrom) {
      setFromToken(tokenWithIcon) 
      setShowFromTokenModal(false)
      // Clear toTokens if they contain the same token as the new fromToken
      setToTokens(prev => prev.filter(t => t.symbol !== token.symbol))
      const newToPercentages = { ...toPercentages }
      delete newToPercentages[token.symbol]
      setToPercentages(newToPercentages)
    } else {
      setToTokens(prev => {
        if (prev.find(t => t.symbol === token.symbol)) {
          return prev // Token already exists
        }
        return [...prev, tokenWithIcon]
      })
      setShowToTokenModal(false)
    }

    // Fetch balance for the custom token if we don't have it yet
    if (token.address && !tokenBalances[token.address]) {
      fetchTokenBalance(tokenWithIcon)
    }

    setCustomTokenAddress("")
    setShowCustomTokenInput(false)
  }

  // Helper function to get cached price
  const getCachedPrice = (tokenSymbol: string): number => {
    return priceCache[tokenSymbol]?.price || 0
  }

  // Helper function to get cached price change
  const getCachedPriceChange = (tokenSymbol: string): number => {
    return priceCache[tokenSymbol]?.change24h || 0
  }

  // Calculate fiat values with loading state handling
  const fromFiatValue = fromToken && fromAmount ? 
    (isLoadingPrices ? "Loading..." : (parseFloat(fromAmount) * getCachedPrice(fromToken.symbol)).toFixed(2)) : 
    "0"
  
  const toFiatValue = toTokens.reduce((total, token) => {
    const percentage = toPercentages[token.symbol] || "0"
    if (isLoadingPrices || !fromAmount) {
      return total + 0 // Don't calculate during loading or without input amount
    }
    // Calculate the actual token amount based on percentage of input
    const tokenAmount = (parseFloat(percentage) / 100) * parseFloat(fromAmount)
    return total + (tokenAmount * getCachedPrice(token.symbol))
  }, 0).toFixed(2)

  // Validation: Check if output value exceeds input value
  const isOutputExceedingInput = !isLoadingPrices && 
    fromFiatValue !== "Loading..." && 
    toFiatValue !== "Loading..." && 
    parseFloat(toFiatValue) > parseFloat(fromFiatValue)
  const isInputValid = fromAmount && parseFloat(fromAmount) > 0
  const isOutputValid = toTokens.length > 0 && toTokens.every(token => {
    const percentage = toPercentages[token.symbol] || "0"
    return percentage && parseFloat(percentage) > 0
  })
  
  // Calculate total percentage
  const totalPercentage = toTokens.reduce((total, token) => {
    const percentage = toPercentages[token.symbol] || "0"
    return total + parseFloat(percentage)
  }, 0)
  
  const isPercentageExceeding = totalPercentage > 100

  // Helper function to remove a token from toTokens
  const removeToToken = (tokenSymbol: string) => {
    setToTokens(prev => prev.filter(t => t.symbol !== tokenSymbol))
    const newToPercentages = { ...toPercentages }
    delete newToPercentages[tokenSymbol]
    setToPercentages(newToPercentages)
  }

  // Helper function to update percentage for a specific token
  const updateToTokenPercentage = (tokenSymbol: string, percentage: string) => {
    setToPercentages(prev => ({
      ...prev,
      [tokenSymbol]: percentage
    }))
  }

  // Helper function to get real balance or fallback to placeholder
  const getTokenBalance = (token: Token | null): string => {
    if (!token) return "99999999999"
    if (authenticated && token.address && tokenBalances[token.address]) {
      const balance = parseFloat(tokenBalances[token.address])
      console.log(`🔍 Token ${token.symbol} balance found: ${balance}`)
      return balance.toFixed(6)
    }
    console.log(`🔍 No balance found for ${token.symbol}, using placeholder`)
    return token.balance.toString()
  }

  // Helper function to display price with loading state
  const getTokenPrice = (token: Token | null): string => {
    if (!token) return "0"
    if (isLoadingPrices) return "Loading..."
    const price = getCachedPrice(token.symbol)
    if (price === 0) return "N/A"
    return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  // Helper function to display price change with loading state
  const getTokenPriceChange = (token: Token | null): string => {
    if (!token) return "0%"
    if (isLoadingPrices) return "Loading..."
    const change = getCachedPriceChange(token.symbol)
    if (change === 0) return "0%"
    const sign = change > 0 ? "+" : ""
    return `${sign}${change.toFixed(2)}%`
  }

  // TradingView widget initialization function (only used in OHLCV config)
  const initTradingView = (containerId: string) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Clear any existing content
    container.innerHTML = '';

    if ((window as any).TradingView) {
      new (window as any).TradingView.widget({
        autosize: true,
        symbol: "BYBIT:HYPEUSDT",
        interval: "1H",
        timezone: "Etc/UTC",
        theme: "dark",
        style: "1",
        locale: "en",
        toolbar_bg: "#f1f3f6",
        enable_publishing: false,
        allow_symbol_change: true,
        container_id: containerId,
        width: "120%",
        height: "400"
      });
    }
  };

  // Load TradingView script only when needed (in OHLCV config)
  const loadTradingViewScript = (containerId: string) => {
    // Check if TradingView is already loaded
    if ((window as any).TradingView) {
      initTradingView(containerId);
      return;
    }

    // Load TradingView script
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => initTradingView(containerId);
    script.onerror = () => {
      console.error('Failed to load TradingView script');
    };
    
    document.head.appendChild(script);
  };

  // Auto-proceed to step 2 when wallet gets connected after platform selection
  useEffect(() => {
    if (authenticated && pendingPlatform && currentStep === 1) {
      setSelectedPlatform(pendingPlatform)
      setCurrentStep(2)
      setPendingPlatform(null)
      setShowWalletPrompt(false)
    }
  }, [authenticated, pendingPlatform, currentStep]);

  // Fetch all token prices once when page loads
  useEffect(() => {
    const fetchAllPrices = async () => {
      setIsLoadingPrices(true)
      try {
        console.log('🔍 Fetching all token prices...')
        
        // Get all token addresses with valid addresses
        const tokenAddresses = tokens
          .filter(token => token.address && token.address !== "0x2222222222222222222222222222222222222222") // Exclude HYPE for now
          .map(token => token.address!)

        if (tokenAddresses.length === 0) {
          console.log('No valid token addresses to fetch')
          setIsLoadingPrices(false)
          return
        }

        console.log('📋 Fetching prices for addresses:', tokenAddresses)
        
        // Fetch real-time data
        const tokenData = await getBatchTokenData(tokenAddresses)
        
        console.log('📊 Received token data:', tokenData)
        
        // Build price cache from API data
        const newPriceCache: Record<string, { price: number; change24h: number }> = {}
        
        tokens.forEach(token => {
          if (token.address && tokenData[token.address]) {
            const { marketData } = tokenData[token.address]
            if (marketData?.price) {
              newPriceCache[token.symbol] = {
                price: marketData.price,
                change24h: marketData.change24h || 0
              }
              console.log(`✅ Cached ${token.symbol}: price=${marketData.price}, change24h=${marketData.change24h}`)
            }
          }
        })
        
        // Add fallback prices for tokens without API data
        const fallbackPrices = {
          "USDT": { price: 1.0, change24h: 0.0 },
          "UETH": { price: 3500.0, change24h: 2.4 },
          "UBTC": { price: 118000.0, change24h: -1.2 },
          "USOL": { price: 166.0, change24h: 5.8 },
          "USDE": { price: 1.0, change24h: 3.2 },
          "HYPE": { price: 39.0, change24h: 3.2 }
        }
        
        // Merge API data with fallbacks
        const finalPriceCache = { ...fallbackPrices, ...newPriceCache }
        setPriceCache(finalPriceCache)
        
        console.log('✅ Price cache built successfully:', finalPriceCache)
        
      } catch (error) {
        console.warn('⚠️ Error fetching token prices - using fallback data:', error)
        // Use fallback prices if API fails
        const fallbackPrices = {
          "USDT": { price: 1.0, change24h: 0.0 },
          "UETH": { price: 3500.0, change24h: 2.4 },
          "UBTC": { price: 118000.0, change24h: -1.2 },
          "USOL": { price: 166.0, change24h: 5.8 },
          "USDE": { price: 1.0, change24h: 3.2 },
          "HYPE": { price: 39.0, change24h: 3.2 }
        }
        setPriceCache(fallbackPrices)
      } finally {
        setIsLoadingPrices(false)
      }
    }

    fetchAllPrices()
  }, [])

  // Fetch token balances when wallet is connected
  useEffect(() => {
    const fetchBalances = async () => {
      if (authenticated && user?.wallet?.address) {
        console.log('🔍 Fetching balances for wallet:', user.wallet.address)
        try {
          // Get all token addresses from the tokens array
          const tokenAddresses = tokens
            .filter(token => token.address) // Include all tokens with addresses
            .map(token => token.address!)

          console.log('📋 Token addresses to fetch:', tokenAddresses)

          // Fetch ERC20 token balances and HYPE balance
          // exclude HYPE from the fetchTokenBalances function
          const tokenAddressesWithoutHYPE = tokenAddresses.filter(address => address !== "0x2222222222222222222222222222222222222222")
          console.log('🔍 ERC20 addresses (without HYPE):', tokenAddressesWithoutHYPE)
          console.log('🔍 Fetching HYPE balance separately...')
          
          const [erc20Balances, ethBalance] = await Promise.all([
            fetchTokenBalances(user.wallet.address, tokenAddressesWithoutHYPE),
            fetchHYPEBalance(user.wallet.address)
          ])

          console.log('💰 Fetched ERC20 balances:', erc20Balances)
          console.log('💰 Fetched HYPE balance:', ethBalance)

                    // Combine all balances - use the token addresses as keys
          const allBalances = {
            ...erc20Balances,
            "0x2222222222222222222222222222222222222222": ethBalance, // Special case for native HYPE token
          }
           
          console.log('✅ All balances combined:', allBalances)
          console.log('🔍 HYPE balance in combined:', allBalances["0x2222222222222222222222222222222222222222"])
          console.log('🔍 All balance keys:', Object.keys(allBalances))
          setTokenBalances(allBalances)
        } catch (error) {
          console.error('❌ Error fetching token balances:', error)
        }
      }
    }

    fetchBalances()
  }, [authenticated, user?.wallet?.address, tokens]);

  // Load TradingView widget when OHLCV configuration step is reached
  useEffect(() => {
    if (currentStep === 4 && conditionType === "ohlcvn") {
      loadTradingViewScript("ohlcv_tradingview_chart");
    }
    
    // Cleanup when leaving the OHLCV step
    return () => {
      const container = document.getElementById('ohlcv_tradingview_chart');
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [currentStep, conditionType]);

  // Handle creating conditional swap
  const handleCreateSwap = async () => {
    setIsCreating(true);

    // Check if wallet is connected
    if (!authenticated || !user?.wallet?.address) {
      console.error('Wallet not connected');
      setIsCreating(false);
      return;
    }

    try {
      // Ensure we have a backend JWT for authorized requests
      let backendJwt = getBackendJwt();
      if (!backendJwt && authenticated && user?.wallet?.address) {
        backendJwt = await exchangePrivyForBackendJwt(getAccessToken, user.wallet.address) || null;
      }
      if (!backendJwt) {
        console.error('Missing backend JWT. Please reconnect wallet.');
        setIsCreating(false);
        return;
      }

      // Build Order payload and call /api/order
      const inputAmountNum = Number(fromAmount);
      
      // For multiple tokens, we'll create multiple orders or modify the payload structure
      // For now, we'll use the first token as the primary output
      const primaryOutputToken = toTokens[0];
      const primaryOutputPercentage = Number(toPercentages[primaryOutputToken?.symbol || '']);
      const primaryOutputAmount = (primaryOutputPercentage / 100) * inputAmountNum;
      
      const orderPayload = {
        platform: (selectedPlatform as 'hyperevm' | 'hypercore') || 'hyperevm',
        wallet: '0x0000000000000000000000000000000000000000',
        swapData: {
          inputToken: fromToken?.address || '0x0000000000000000000000000000000000000000',
          inputAmount: isFinite(inputAmountNum) ? inputAmountNum : 0,
          outputToken: primaryOutputToken?.address || '0x0000000000000000000000000000000000000000',
          outputAmount: isFinite(primaryOutputAmount) ? primaryOutputAmount : 0,
          // Add additional output tokens if needed
          additionalOutputs: toTokens.slice(1).map(token => {
            const percentage = Number(toPercentages[token.symbol] || '0');
            const amount = (percentage / 100) * inputAmountNum;
            return {
              token: token.address || '0x0000000000000000000000000000000000000000',
              amount: isFinite(amount) ? amount : 0
            };
          })
        },
        orderData: {
          type: 'ohlcvTrigger',
          ohlcvTrigger: {
            pair: triggerToken || 'HYPE',
            timeframe: timeframe || '1h',
            source: condition || 'close',
            trigger: triggerWhen || 'above',
            triggerValue: targetValue || '0',
          },
          walletActivity: null,
        },
        signature: null,
        time: Date.now(),
      };

      const response = await fetch('http://localhost:8000/api/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${backendJwt}`,
        },
        body: JSON.stringify(orderPayload),
      });

      if (response.ok) {
        // Success - show success page
        setShowSuccessPage(true);
      } else {
        // Handle error
        console.log(response);
        console.error('Failed to create conditional swap');
        // You can add error handling here (e.g., show error message)
      }
    } catch (error) {
      console.error('Error creating conditional swap:', error);
      // You can add error handling here
    } finally {
      setIsCreating(false);
    }
  };



  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="flex h-16 items-center px-6">
          <div className="flex items-center space-x-4">
            <a href="/" className="flex items-center space-x-1 hover:opacity-80 transition-opacity">
              <Logo width={24} height={24} />
              <span className="text-xl font-bold">Hyperstrike</span>
            </a>
            <nav className="hidden md:flex items-center space-x-6 text-sm">
              <a href="/trade" className="font-medium text-primary">
                Trade
              </a>
              <a href="/portfolio" className="text-muted-foreground hover:text-foreground transition-colors">
                Portfolio
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                Markets
              </a>
              <a href="/xp" className="text-muted-foreground hover:text-foreground transition-colors">
                XP
              </a>
            </nav>
          </div>
          <div className="ml-auto flex items-center space-x-4">
            <ThemeToggle />
            <Button variant="ghost" size="icon">
              <Bell className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
            <WalletButton />
            <Button variant="ghost" size="icon">
              <User className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 container mx-auto px-4 py-8">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-4">
            {[
              { step: 1, title: "Platform" },
              { step: 2, title: "Swap Pair" },
              { step: 3, title: "Condition Type" },
              { step: 4, title: "Configure" },
              { step: 5, title: "Review" },
            ].map((item, index) => (
              <div key={item.step} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-all ${
                    currentStep >= item.step 
                      ? "bg-primary text-primary-foreground shadow-lg" 
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {item.step}
                </div>
                <span
                  className={`ml-2 text-sm font-medium transition-colors ${
                    currentStep >= item.step ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {item.title}
                </span>
                {index < 4 && <ArrowRight className="w-4 h-4 mx-4 text-muted-foreground" />}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Choose Platform */}
        {currentStep === 1 && (
          <Card className="max-w-4xl mx-auto border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="text-foreground">Choose Platform</CardTitle>
              <CardDescription>Select the platform you want to use for your conditional swap</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* HyperEVM Block */}
                <div
                  className={`p-6 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                    selectedPlatform === "hyperevm"
                      ? "border-primary bg-primary/10 shadow-lg"
                      : "border-border/50 hover:border-primary/30 hover:bg-accent/50"
                  }`}
                  onClick={() => setSelectedPlatform("hyperevm")}
                >
                  <div className="flex items-center space-x-4">
                    <div
                      className={`p-3 rounded-lg transition-colors ${
                        selectedPlatform === "hyperevm" 
                          ? "bg-primary text-primary-foreground" 
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Activity className="w-6 h-6" />
                          </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-foreground mb-2">HyperEVM</h3>
                      <p className="text-sm text-muted-foreground">
                        Advanced EVM-based trading with Uniswap-like interface and comprehensive token support
                      </p>
                      <div className="mt-3 flex items-center space-x-2">
                        <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 border-green-200">
                          Available
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          EVM Compatible
                        </Badge>
                            </div>
                          </div>
                  </div>
                </div>

                {/* HyperCore Block */}
                <div
                  className={`p-6 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                    selectedPlatform === "hypercore"
                      ? "border-primary bg-primary/10 shadow-lg"
                      : "border-border/50 hover:border-primary/30 hover:bg-accent/50"
                  }`}
                  onClick={() => setSelectedPlatform("hypercore")}
                >
                  <div className="flex items-center space-x-4">
                    <div
                      className={`p-3 rounded-lg transition-colors ${
                        selectedPlatform === "hypercore" 
                          ? "bg-primary text-primary-foreground" 
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Target className="w-6 h-6" />
                          </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-foreground mb-2">HyperCore</h3>
                      <p className="text-sm text-muted-foreground">
                        Core trading platform with advanced features and enhanced security
                      </p>
                      <div className="mt-3 flex items-center space-x-2">
                        <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800 border-yellow-200">
                          Coming Soon
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Core Platform
                        </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                  </div>

              <div className="flex justify-end mt-6">
                <Button 
                  onClick={() => {
                    if (!authenticated) {
                      setPendingPlatform(selectedPlatform)
                      setShowWalletPrompt(true)
                      return
                    }
                    setCurrentStep(2)
                  }} 
                  disabled={!selectedPlatform}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg cursor-pointer"
                >
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Swap Pair */}
        {currentStep === 2 && selectedPlatform === "hyperevm" && (
          <Card className="max-w-md mx-auto border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="text-foreground">Swap Pair</CardTitle>
              <CardDescription>Choose the tokens you want to trade and configure amounts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                  
                  {/* From Token (Sell) */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">Sell</Label>
                    <div className="flex items-center space-x-3 p-4 bg-card border border-border/50 rounded-lg">
                  <div className="flex-1">
                    <Input
                      type="number"
                      placeholder="0"
                      value={fromAmount}
                      onChange={(e) => setFromAmount(e.target.value)}
                      className="text-2xl font-medium border-0 bg-transparent p-0 focus:ring-0 text-foreground pl-2"
                    />
                    <div className="flex items-center justify-between mt-1">
                      <div className="text-sm text-muted-foreground">${fromFiatValue}</div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setFromAmount((parseFloat(getTokenBalance(fromToken)) * 0.5).toString())}
                          className="text-xs bg-transparent border border-gray-700 hover:bg-green-700 hover:border-green-700 hover:text-white cursor-pointer"
                        >
                          50%
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setFromAmount((parseFloat(getTokenBalance(fromToken)) * 1.0).toString())}
                          className="text-xs bg-transparent border border-gray-700 hover:bg-green-700 hover:border-green-700 hover:text-white cursor-pointer"
                        >
                          100%
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <Button
                      variant="outline"
                      className="flex items-center space-x-2 bg-card border-border/50 hover:bg-accent/50 px-3 py-2"
                      onClick={() => setShowFromTokenModal(true)}
                    >
                      {fromToken ? (
                        <>
                          <img src={fromToken.icon} alt={fromToken.symbol} className="w-6 h-6 rounded-full" />
                          <span className="text-foreground font-medium text-base">{fromToken.symbol}</span>
                        </>
                      ) : (
                        <span className="text-foreground">Select token</span>
                      )}
                      <ArrowRight className="w-4 h-4 rotate-90" />
                    </Button>
                    {fromToken && (
                      <span className="text-xs text-muted-foreground mt-1">
                        {getTokenBalance(fromToken)} {fromToken.symbol}
                      </span>
                    )}
                  </div>
                  </div>
                </div>

                {/* Switch Button */}
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSwapTokens}
                  className="w-10 h-10 p-0 rounded-full border-border/50 hover:bg-accent/50"
                  disabled={!fromToken || toTokens.length === 0}
                  >
                    <ArrowUpDown className="w-4 h-4" />
                  </Button>
                </div>

                {/* To Tokens (Buy) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-foreground">Buy</Label>
                    {toTokens.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {toTokens.length} token{toTokens.length !== 1 ? 's' : ''} selected
                      </Badge>
                    )}
                  </div>
                  
                  {/* Dynamic Token Grid */}
                  <div className="grid grid-cols-1 gap-3">
                    {/* Selected Token Cards */}
                    {toTokens.map((token, index) => {
                      const tokenPercentage = toPercentages[token.symbol] || "0"
                      const tokenAmount = fromAmount ? (parseFloat(tokenPercentage) / 100) * parseFloat(fromAmount) : 0
                      const tokenValue = tokenAmount * getCachedPrice(token.symbol)
                      
                      return (
                    <div key={token.symbol} className={`relative p-4 bg-card border rounded-lg ${
                      isPercentageExceeding ? 'border-red-500/50' : 'border-border/50'
                    }`}>
                      {/* Remove Button */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeToToken(token.symbol)}
                        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground p-1 h-6 w-6"
                      >
                        <X className="w-3 h-3" />
                    </Button>
                      
                      {/* Token Info */}
                      <div className="flex items-center space-x-2 mb-3">
                        <img src={token.icon} alt={token.symbol} className="w-5 h-5 rounded-full" />
                        <span className="text-foreground font-medium text-sm">{token.symbol}</span>
                      </div>
                      
                      {/* Percentage Input */}
                      <Input
                        type="number"
                        placeholder="Enter percentage"
                        value={toPercentages[token.symbol] || ""}
                        onChange={(e) => updateToTokenPercentage(token.symbol, e.target.value)}
                        className="text-base font-medium border-0 bg-transparent p-0 focus:ring-0 text-foreground mb-2"
                        max="100"
                        min="0"
                      />
                      
                                             {/* Token Details */}
                       <div className="space-y-1">
                          <div className={`text-xs ${
                            isPercentageExceeding ? 'text-red-500' : 'text-muted-foreground'
                          }`}>
                            {tokenPercentage ? `${tokenPercentage}%` : "0%"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {isLoadingPrices ? 
                              "Loading..." : 
                              `≈ ${tokenAmount.toFixed(6)} ${token.symbol}`
                            }
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {isLoadingPrices ? 
                              "Loading..." : 
                              `≈ $${tokenValue.toFixed(2)}`
                            }
                          </div>
                         <div className="text-xs text-muted-foreground">
                           {getTokenBalance(token)} {token.symbol}
                         </div>
                       </div>
                     </div>
                   )
                   })}
                  
                  {/* Add Token Button - Always show one plus button */}
                  <div
                    className="p-4 bg-muted/30 border-2 border-dashed border-border/50 rounded-lg cursor-pointer hover:bg-muted/50 hover:border-border transition-all"
                    onClick={() => setShowToTokenModal(true)}
                  >
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center mb-2">
                        <span className="text-lg font-bold text-muted-foreground">+</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {toTokens.length === 0 ? "Select token" : "Add token"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Total Percentage Display */}
                {toTokens.length > 0 && (
                  <div className={`flex justify-between items-center p-3 rounded-lg ${
                    isPercentageExceeding ? 'bg-red-500/10 border border-red-500/20' : 'bg-muted/50'
                  }`}>
                    <span className="text-sm font-medium text-foreground">Total Percentage:</span>
                    <div className="flex items-center space-x-2">
                      <span className={`text-sm font-medium ${
                        isPercentageExceeding ? 'text-red-500' : 'text-foreground'
                      }`}>
                        {totalPercentage.toFixed(1)}%
                      </span>
                      {isPercentageExceeding && (
                        <span className="text-xs text-red-500">Exceeds 100%</span>
                      )}
                    </div>
                  </div>
                  )}
                  </div>

                  {/* Validation Message */}
                  {isPercentageExceeding && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <p className="text-xs text-red-500 text-center">
                        Total percentage ({totalPercentage.toFixed(1)}%) cannot exceed 100%. 
                        Please reduce the percentages for your selected tokens.
                      </p>
                    </div>
                  )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep(1)} className="border-border/50 cursor-pointer">
                  Back
                </Button>
                <Button 
                  onClick={() => setCurrentStep(3)} 
                  disabled={!fromToken || toTokens.length === 0 || !isInputValid || !isOutputValid || isPercentageExceeding}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg cursor-pointer"
                >
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Condition Type */}
        {currentStep === 3 && selectedPlatform === "hyperevm" && (
          <Card className="max-w-4xl mx-auto border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="text-foreground">Choose Condition Type</CardTitle>
              <CardDescription>Select the condition that will trigger your trade</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {conditionTypes.map((condition) => {
                  const Icon = condition.icon
                  return (
                    <div
                      key={condition.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                        conditionType === condition.id
                          ? "border-primary bg-primary/10 shadow-lg"
                          : "border-border/50 hover:border-primary/30 hover:bg-accent/50"
                      }`}
                      onClick={() => setConditionType(condition.id)}
                    >
                      <div className="flex flex-col items-center text-center space-y-3">
                        <div
                          className={`p-2 rounded-lg transition-colors ${
                            conditionType === condition.id 
                              ? "bg-primary text-primary-foreground" 
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center justify-center space-x-2">
                            <h3 className="font-medium text-foreground">{condition.name}</h3>
                            {condition.popular && (
                              <Badge variant="secondary" className="text-xs bg-primary/20 text-primary border-primary/30">
                                Popular
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{condition.description}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep(2)} className="border-border/50 cursor-pointer">
                  Back
                </Button>
                <Button 
                  onClick={() => setCurrentStep(4)} 
                  disabled={!conditionType}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg cursor-pointer"
                >
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Token Selection Modal for From Token */}
        {showFromTokenModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-hidden">
            <div 
              className="bg-card border border-border/50 rounded-lg shadow-lg w-96 max-h-[80vh] overflow-y-auto"
              onWheel={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-border/50">
                <h3 className="text-lg font-semibold text-foreground">Select a token</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFromTokenModal(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </Button>
                    </div>
              
              <div className="p-4">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search tokens or paste contract address"
                    value={tokenSearchTerm}
                    onChange={(e) => setTokenSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filteredTokenSearch
                    .sort((a, b) => {
                       const aValue = parseFloat(getTokenBalance(a)) * getCachedPrice(a.symbol)
                       const bValue = parseFloat(getTokenBalance(b)) * getCachedPrice(b.symbol)
                      return bValue - aValue // Descending order
                    })
                    .map((token) => (
                    <div
                      key={`from-${token.symbol}`}
                      className="flex items-center justify-between p-3 hover:bg-accent/50 cursor-pointer rounded-lg"
                      onClick={() => handleTokenSelect(token, true)}
                    >
                      <div className="flex items-center space-x-3">
                        <img src={token.icon} alt={token.symbol} className="w-6 h-6 rounded-full" />
                        <div>
                          <div className="font-medium text-foreground">{token.name}</div>
                          <div className="text-sm text-muted-foreground">{token.symbol}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-foreground">
                          {isLoadingPrices ? 
                            "Loading..." : 
                            `$${(parseFloat(getTokenBalance(token)) * getCachedPrice(token.symbol)).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                            })}`
                          }
                        </div>
                        <div className="text-sm text-muted-foreground">{getTokenBalance(token)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
                  </div>
                </div>
              )}

        {/* Token Selection Modal for To Token */}
        {showToTokenModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-hidden">
            <div 
              className="bg-card border border-border/50 rounded-lg shadow-lg w-96 max-h-[80vh] overflow-y-auto"
              onWheel={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-border/50">
                <h3 className="text-lg font-semibold text-foreground">Select a token</h3>
                <Button 
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowToTokenModal(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="p-4">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search tokens or paste contract address"
                    value={tokenSearchTerm}
                    onChange={(e) => setTokenSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {availableBuyTokens
                     .filter(token => !toTokens.find(t => t.symbol === token.symbol)) // Filter out already selected tokens
                    .sort((a, b) => {
                      const aValue = parseFloat(getTokenBalance(a)) * getCachedPrice(a.symbol)
                      const bValue = parseFloat(getTokenBalance(b)) * getCachedPrice(b.symbol)
                      return bValue - aValue // Descending order
                    })
                    .map((token) => (
                    <div
                      key={`to-${token.symbol}`}
                      className="flex items-center justify-between p-3 hover:bg-accent/50 cursor-pointer rounded-lg"
                      onClick={() => handleTokenSelect(token, false)}
                    >
                      <div className="flex items-center space-x-3">
                        <img src={token.icon} alt={token.symbol} className="w-6 h-6 rounded-full" />
                        <div>
                          <div className="font-medium text-foreground">{token.name}</div>
                          <div className="text-sm text-muted-foreground">{token.symbol}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-foreground">
                          {isLoadingPrices ? 
                            "Loading..." : 
                            `$${(parseFloat(getTokenBalance(token)) * getCachedPrice(token.symbol)).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                            })}`
                          }
                        </div>
                        <div className="text-sm text-muted-foreground">{getTokenBalance(token)}</div>
                      </div>
                    </div>
                  ))}
                   {availableBuyTokens.filter(token => !toTokens.find(t => t.symbol === token.symbol)).length === 0 && (
                     <div className="text-center py-4 text-muted-foreground">
                       All available tokens have been selected
                     </div>
                   )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: HyperCore (Coming Soon) */}
        {currentStep === 2 && selectedPlatform === "hypercore" && (
          <Card className="max-w-2xl mx-auto border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="text-foreground">HyperCore Coming Soon</CardTitle>
              <CardDescription>This platform is currently under development</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center py-8">
                <Target className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">HyperCore Platform</h3>
                <p className="text-muted-foreground mb-4">
                  Our advanced core trading platform is currently under development. 
                  Please check back later for updates.
                </p>
                <Button variant="outline" onClick={() => setCurrentStep(1)}>
                  Go Back
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Configure Condition */}
        {currentStep === 4 && (
          <Card className="max-w-2xl mx-auto border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="text-foreground">Configure Condition</CardTitle>
              <CardDescription>
                Set up the specific parameters for your condition 
                {conditionTypes.find((c) => c.id === conditionType)?.name.toLowerCase()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {conditionType === "ohlcvn" && (
                <div className="space-y-4">
                  {/* Trigger Token Section */}
                  <div className="pb-3 border-b border-dotted border-border/40">
                    <div className="flex items-center justify-between">
                      <Label className="text-foreground font-semibold">Pair</Label>
                      <Select value={triggerToken} onValueChange={setTriggerToken}>
                        <SelectTrigger className="w-1/2 border-border/50 focus:ring-primary/20 cursor-pointer">
                          <SelectValue placeholder="HYPE" />
                      </SelectTrigger>
                      <SelectContent>
                        {tokens.map((token) => (
                            <SelectItem key={token.symbol} value={token.symbol} className="cursor-pointer">
                              <div className="flex items-center space-x-2">
                                <img src={token.icon} alt={token.symbol} className="w-5 h-5 rounded-full" />
                                <span>{token.symbol} - {token.name}</span>
                              </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  </div>

                  {/* Timeframe Section */}
                  <div className="pb-3 border-b border-dotted border-border/40">
                    <div className="flex items-center justify-between">
                      <Label className="text-foreground font-semibold">Timeframe</Label>
                      <Select value={timeframe} onValueChange={setTimeframe}>
                        <SelectTrigger className="w-1/2 border-border/50 focus:ring-primary/20 cursor-pointer">
                          <SelectValue placeholder="1H" />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="15m" className="cursor-pointer">15m</SelectItem>
                          <SelectItem value="1h" className="cursor-pointer">1H</SelectItem>
                          <SelectItem value="4h" className="cursor-pointer">4H</SelectItem>
                          <SelectItem value="1d" className="cursor-pointer">1D</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  </div>

                  {/* Source Section */}
                  <div className="pb-3 border-b border-dotted border-border/40">
                    <div className="flex items-center justify-between">
                      <Label className="text-foreground font-semibold">Source</Label>
                      <Select value={condition} onValueChange={setCondition}>
                        <SelectTrigger className="w-1/2 border-border/50 focus:ring-primary/20 cursor-pointer">
                          <SelectValue placeholder="Close" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open" className="cursor-pointer">Open</SelectItem>
                          <SelectItem value="high" className="cursor-pointer">High</SelectItem>
                          <SelectItem value="low" className="cursor-pointer">Low</SelectItem>
                          <SelectItem value="close" className="cursor-pointer">Close</SelectItem>
                          <SelectItem value="volume" className="cursor-pointer">Volume</SelectItem>
                          <SelectItem value="trades" className="cursor-pointer">Number of Trades</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Trigger When Section */}
                  <div className="pb-3 border-b border-dotted border-border/40">
                    <div className="flex items-center justify-between">
                      <Label className="text-foreground font-semibold">Trigger When</Label>
                      <div className="flex w-1/2 bg-muted rounded-lg p-1">
                        <button
                          onClick={() => setTriggerWhen("above")}
                          className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 cursor-pointer ${
                            triggerWhen === "above"
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground hover:bg-accent"
                          }`}
                        >
                          Above
                        </button>
                        <button
                          onClick={() => setTriggerWhen("below")}
                          className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 cursor-pointer ${
                            triggerWhen === "below"
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground hover:bg-accent"
                          }`}
                        >
                          Below
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Target Value Section */}
                  <div className="pb-0">
                    <div className="flex items-center justify-between">
                      <Label className="text-foreground font-semibold">Target Value</Label>
                      <Input
                        placeholder={
                          condition === "volume" 
                            ? "Enter volume in $" 
                            : condition === "trades" 
                              ? "Enter number of trades"
                              : "Enter price in $"
                        }
                        className="w-1/2 border-border/50 focus:ring-primary/20"
                        value={targetValue}
                        onChange={(e) => setTargetValue(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {conditionType === "wallet_activity" && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-foreground">Wallet Address</Label>
                    <Input placeholder="0x..." className="border-border/50 focus:ring-primary/20" />
                  </div>
                  <div>
                    <Label className="text-foreground">Activity Type</Label>
                    <Select>
                      <SelectTrigger className="border-border/50 focus:ring-primary/20">
                        <SelectValue placeholder="Select activity type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="buy">Token Purchase</SelectItem>
                        <SelectItem value="sell">Token Sale</SelectItem>
                        <SelectItem value="transfer">Token Transfer</SelectItem>
                        <SelectItem value="any">Any Transaction</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-foreground">Minimum Amount (Optional)</Label>
                    <Input placeholder="Minimum transaction amount" className="border-border/50 focus:ring-primary/20" />
                  </div>
                </div>
              )}

              {conditionType === "time_based" && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-foreground">Trigger Type</Label>
                    <Select>
                      <SelectTrigger className="border-border/50 focus:ring-primary/20">
                        <SelectValue placeholder="Select trigger type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="specific">Specific Date & Time</SelectItem>
                        <SelectItem value="recurring">Recurring Schedule</SelectItem>
                        <SelectItem value="delay">After Delay</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-foreground">Date & Time</Label>
                    <Input type="datetime-local" className="border-border/50 focus:ring-primary/20" />
                  </div>
                </div>
              )}

              {/* TradingView Chart Section - Only for OHLCV */}
              {conditionType === "ohlcvn" && (
                <div className="pt-4 border-t border-solid border-border/30 mt-5">
                  <div className="bg-card border border-border/50 p-4 rounded-lg">
                    <div id="ohlcv_tradingview_chart" style={{ width: '105%', height: '400px', marginLeft: '-15px' }}></div>
                  </div>
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep(3)} className="border-border/50 cursor-pointer">
                  Back
                </Button>
                <Button 
                  onClick={() => setCurrentStep(5)}
                  disabled={!triggerToken || !timeframe || !condition || !triggerWhen || !targetValue}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg cursor-pointer"
                >
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 5: Review */}
        {currentStep === 5 && (
          <Card className="max-w-2xl mx-auto border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="text-foreground">Review Conditional Swap</CardTitle>
              <CardDescription>Review your conditional swap configuration before creating</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted/50 border border-border/50 p-4 rounded-lg space-y-4">
                <div>
                  <h4 className="font-medium text-foreground mb-2">Platform</h4>
                  <div className="flex justify-center">
                    <Badge variant="outline" className="border-primary/30 text-primary">
                      {selectedPlatform === "hyperevm" ? "HyperEVM" : "HyperCore"}
                    </Badge>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium text-foreground mb-2">Swap Pair</h4>
                  <div className="flex items-center justify-center space-x-4">
                    <div className="text-center">
                      <div className="font-medium text-foreground">{fromToken?.symbol}</div>
                      <div className="text-sm text-muted-foreground">{fromToken?.name}</div>
                      <div className="text-sm text-muted-foreground">{fromAmount} {fromToken?.symbol}</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    <div className="text-center">
                      <div className="space-y-2">
                        {toTokens.map((token) => (
                          <div key={token.symbol} className="text-center">
                            <div className="font-medium text-foreground">{token.symbol}</div>
                            <div className="text-sm text-muted-foreground">{token.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {toPercentages[token.symbol] || "0"}% allocation
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium text-foreground mb-2">Condition</h4>
                  <div className="flex flex-col items-center space-y-2">
                    <Badge variant="outline" className="border-primary/30 text-primary">
                      {conditionTypes.find((c) => c.id === conditionType)?.name}
                    </Badge>
                    <div className="text-sm text-muted-foreground text-center">
                      {triggerToken && condition && timeframe && triggerWhen && targetValue ? (
                        <span>
                          {condition.charAt(0).toUpperCase() + condition.slice(1)} goes {triggerWhen} {targetValue} on {timeframe} chart of {triggerToken}
                    </span>
                      ) : (
                        <span>{conditionTypes.find((c) => c.id === conditionType)?.description}</span>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium text-foreground mb-2">Estimated Fees</h4>
                  <div className="text-sm text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Platform Fee:</span>
                      <span>0.1%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Network Fee:</span>
                      <span>~$2.50</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep(4)} className="border-border/50 cursor-pointer">
                  Back
                </Button>
                <Button 
                  onClick={handleCreateSwap}
                  disabled={isCreating}
                  className="bg-green-600 hover:bg-green-700 text-white shadow-lg cursor-pointer"
                >
                  {isCreating ? "Creating..." : "Create Conditional Swap"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Success Page */}
        {showSuccessPage && (
          <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
            <Card className="max-w-md mx-auto border-border/50 shadow-2xl">
              <CardContent className="p-8 text-center space-y-6">
                {/* Success Icon */}
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto">
                  <svg 
                    className="w-8 h-8 text-green-600 dark:text-green-400" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
      </div>
                
                {/* Success Message */}
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-foreground">Success!</h2>
                  <p className="text-muted-foreground">
                    Conditional Swap created successfully
                  </p>
                </div>
                
                {/* Decorative Elements */}
                <div className="flex justify-center space-x-1">
                  <div className="w-2 h-2 bg-primary/60 rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-primary/40 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                  <div className="w-2 h-2 bg-primary/20 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                </div>
                
                {/* Action Buttons */}
                <div className="space-y-3 pt-4">
                  <Button 
                    onClick={() => {
                      setShowSuccessPage(false);
                      setCurrentStep(1);
                      // Reset all form data
                      setSelectedPlatform(null);
                      setFromToken(tokens.find(t => t.symbol === "USDT") || null);
                      setToTokens([]);
                      setFromAmount("");
                      setToPercentages({});
                      setTriggerToken("");
                      setTimeframe("");
                      setCondition("");
                      setTriggerWhen("above");
                      setTargetValue("");
                    }}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg cursor-pointer"
                  >
                    Create Another Swap
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => window.location.href = '/dashboard'}
                    className="w-full border-border/50 cursor-pointer"
                  >
                    My Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>



      {/* Wallet Connection Prompt Modal */}
      {showWalletPrompt && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card border border-border/50 rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-300">
            <div className="text-center space-y-6">
              {/* Icon */}
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <Wallet className="w-8 h-8 text-primary" />
              </div>
              
              {/* Title */}
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-foreground">Connect Your Wallet</h3>
                <p className="text-muted-foreground">
                  Please connect your wallet to start trading on Hyperstrike
                </p>
              </div>
              
              {/* Buttons */}
              <div className="space-y-3">
                <Button 
                  onClick={() => {
                    setShowWalletPrompt(false)
                    login()
                  }}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg cursor-pointer"
                >
                  Connect Wallet
                  <Wallet className="w-4 h-4 ml-2" />
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowWalletPrompt(false)}
                  className="w-full border-border/50 cursor-pointer"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
} 