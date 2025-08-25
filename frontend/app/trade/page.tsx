"use client"

import { useState, useEffect } from "react"
import './slider-styles.css'
import { usePrivy } from '@privy-io/react-auth'
import { getBackendJwt, exchangePrivyForBackendJwt } from '@/lib/api'
import { getUserIdFromWallet } from '@/lib/wallet-utils'
import { fetchTokenBalances, fetchHYPEBalance } from '@/lib/token-balances'
import { getBatchTokenData, TokenMetadata, TokenMarketData } from '@/lib/alchemy'
import { HYPERLIQUID_TOKENS, DEFAULT_TOKEN_PRICES, getTokenByAddress } from '@/lib/tokens'
import { updateAllTokenPrices } from '@/lib/hyperliquid-prices'
import { getCoreAccount, HypercoreAccountSummary } from '@/lib/hypercore'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useTheme } from "next-themes"
import { useRef } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArrowRight, Search, TrendingUp, Users, Clock, Target, Wallet, BarChart3, ArrowUpDown, Activity, Copy, ExternalLink, X, Zap } from "lucide-react"
import { WalletButton } from "@/components/WalletButton"
import { ThemeToggle } from "@/components/theme-toggle"
import { XpButton } from "@/components/XpButton"
import { Footer } from "@/components/footer"
import { Logo } from "@/components/Logo"
import { config } from "@/lib/config"
import { checkAllowance, approveToken, getTokenDecimals } from "@/lib/token-allowance"
import { wrapHype, WHYPE_CONTRACT_ADDRESS } from "@/lib/wrap"
import { TransactionMonitor } from "@/components/TransactionMonitor"
import { useTransactionMonitor } from "@/hooks/use-transaction-monitor"
import { useGlueXPrices } from "@/hooks/use-gluex-prices"

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

// Convert centralized token config to local Token interface
const initialTokens: Token[] = HYPERLIQUID_TOKENS.map(token => ({
  symbol: token.symbol,
  name: token.name,
  price: DEFAULT_TOKEN_PRICES[token.symbol]?.price || 0,
  change24h: DEFAULT_TOKEN_PRICES[token.symbol]?.change24h || 0,
  address: token.address,
  balance: 0,
  icon: token.icon,
  metadata: undefined,
  marketData: undefined,
  lastUpdated: undefined
}))

const conditionTypes = [
  {
    id: "ohlcv_trigger",
    name: "OHLCV Trigger",
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
  const [fromToken, setFromToken] = useState<Token | null>(initialTokens.find(t => t.symbol === "HYPE") || null)
  const [toTokens, setToTokens] = useState<Token[]>([])
  const [tokenBalances, setTokenBalances] = useState<Record<string, string>>({})
  const [conditionType, setConditionType] = useState("")
  const [isConditionSelectionUnlocked, setIsConditionSelectionUnlocked] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedPlatform, setSelectedPlatform] = useState<"hyperevm" | "hypercore" | null>(null)
  const [tokenSearchTerm, setTokenSearchTerm] = useState("")
  const [customTokenAddress, setCustomTokenAddress] = useState("")
  const [showCustomTokenInput, setShowCustomTokenInput] = useState(false)
  const [showFromTokenModal, setShowFromTokenModal] = useState(false)
  const [showToTokenModal, setShowToTokenModal] = useState(false)
  const [fromAmount, setFromAmount] = useState("")
  const [toPercentages, setToPercentages] = useState<Record<string, string>>({})
  const [triggerToken, setTriggerToken] = useState<string>("HYPE-USDC");
  const [timeframe, setTimeframe] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [triggerWhen, setTriggerWhen] = useState<string>("above");
  const [targetValue, setTargetValue] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [showSuccessPage, setShowSuccessPage] = useState(false);
  const [isLoadingPrices, setIsLoadingPrices] = useState(true);
  const [indicatorParams, setIndicatorParams] = useState<{ [key: string]: number | string }>({
    // SMA parameters
    sma_length: 14,
    sma_source: 'close',
    
    // EMA parameters
    ema_length: 14,
    ema_source: 'close',
    
    // RSI parameters
    rsi_length: 14,
    rsi_source: 'close',
    
    // BB parameters (shared across all BB lines)
    bb_length: 20,
    bb_ma_type: 'sma',
    bb_source: 'close',
    bb_std: 2,
    
    // Legacy keys for backward compatibility
    sma: 14,
    ema: 14,
    rsi: 14,
    bb_lower: 14,
    bb_mid: 14,
    bb_upper: 14
  });
  const [openParamFor, setOpenParamFor] = useState<string | null>(null);
  const [showValueInput, setShowValueInput] = useState(false);
  const [secondSourceValue, setSecondSourceValue] = useState<string>("");
  const [firstSourceType, setFirstSourceType] = useState<string>("");
  const [secondSourceType, setSecondSourceType] = useState<string>("");
  const [cooldownActive, setCooldownActive] = useState(false);
  const [cooldownValue, setCooldownValue] = useState<string>("");
  const [chainedConfirmation, setChainedConfirmation] = useState(false);
  const [chainedConfirmationBars, setChainedConfirmationBars] = useState<string>("1");
  const [invalidationHaltActive, setInvalidationHaltActive] = useState(false);
  const { resolvedTheme } = useTheme();
  const [priceCache, setPriceCache] = useState<Record<string, { price: number; change24h: number }>>({});
  const [orderLifetime, setOrderLifetime] = useState<string>("24h");
  const [leverage, setLeverage] = useState<number>(20);
  const [showLeverageModal, setShowLeverageModal] = useState(false);
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [positionSize, setPositionSize] = useState<number>(100);
  const [coreAccount, setCoreAccount] = useState<HypercoreAccountSummary | null>(null)
  const [loadingCoreAccount, setLoadingCoreAccount] = useState<boolean>(false)
  const [showTpSl, setShowTpSl] = useState(false);
  const [tpPrice, setTpPrice] = useState("");
  const [slPrice, setSlPrice] = useState("");
  const [gainType, setGainType] = useState<"%" | "$">("%");
  const [lossType, setLossType] = useState<"%" | "$">("%");
  const [showContinueWarning, setShowContinueWarning] = useState(false);
  const [isHypeWrapped, setIsHypeWrapped] = useState(false);
  const [tokenAllowance, setTokenAllowance] = useState<string>("0");
  const [isTokenApproved, setIsTokenApproved] = useState(false);
  const [whypeAllowance, setWhypeAllowance] = useState<string>("0");
  const [isWhypeApproved, setIsWhypeApproved] = useState(false);
  const [showTransactionRejectedModal, setShowTransactionRejectedModal] = useState(false);
  const [rejectedTransactionData, setRejectedTransactionData] = useState<{
    tokenAddress: string;
    tokenSymbol: string;
  } | null>(null);
  const [isRetryingTransaction, setIsRetryingTransaction] = useState(false);
  const [showSwapFlowModal, setShowSwapFlowModal] = useState(false);
  const [swapResults, setSwapResults] = useState<any[]>([]);
  const [isSwapProcessing, setIsSwapProcessing] = useState(true);
  
  // Transaction monitoring
  const { transactions, addTransaction, removeTransaction } = useTransactionMonitor();
  
  // Transaction confirmation states
  const [pendingTransactions, setPendingTransactions] = useState<Set<string>>(new Set());
  
  // GlueX price monitoring (background only - no UI display)
  useGlueXPrices({
    fromToken,
    toTokens,
    fromAmount,
    userAddress: user?.wallet?.address,
    isEnabled: authenticated && currentStep === 2 && selectedPlatform === 'hyperevm' && !!fromToken && toTokens.length > 0
  });
  
  // Monitor transaction status changes to update UI state
  useEffect(() => {
    transactions.forEach(tx => {
      if (tx.status === 'success') {
        // Handle successful transactions
        if (tx.type === 'wrap' && tx.tokenSymbol === 'HYPE') {
          // HYPE wrapping succeeded
          setIsHypeWrapped(true)
          const whypeToken = tokens.find(t => t.symbol === 'WHYPE')
          if (whypeToken) {
            setFromToken(whypeToken)
          }
        } else if (tx.type === 'approval') {
          // Token approval succeeded
          if (tx.tokenSymbol === 'WHYPE' && isHypeWrapped) {
            setIsWhypeApproved(true)
          } else {
            setIsTokenApproved(true)
          }
        }
        
        // Remove from pending transactions
        setPendingTransactions(prev => {
          const newSet = new Set(prev)
          newSet.delete(tx.hash)
          return newSet
        })
        
        // Reset retry states
        setIsRetryingTransaction(false)
        setShowTransactionRejectedModal(false)
        setRejectedTransactionData(null)
      } else if (tx.status === 'failed') {
        // Handle failed transactions
        setPendingTransactions(prev => {
          const newSet = new Set(prev)
          newSet.delete(tx.hash)
          return newSet
        })
        
        setIsRetryingTransaction(false)
      }
    })
  }, [transactions, isHypeWrapped, tokens])

  // Generate mapping from contract address to tokens using centralized config
  const contractAddressToToken: { [key: string]: Token | undefined } = {}
  tokens.forEach(token => {
    if (token.address) {
      contractAddressToToken[token.address] = token
    }
  })
  
  // All tokens from HYPERLIQUID_TOKENS are now properly mapped

  useEffect(() => {
    if (showFromTokenModal || showToTokenModal || showLeverageModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [showFromTokenModal, showToTokenModal, showLeverageModal]);

  // Fetch HyperCore account summary when on HyperCore flow
  useEffect(() => {
    const run = async () => {
      if (!authenticated || !user?.wallet?.address) return
      if (selectedPlatform !== 'hypercore') return
      setLoadingCoreAccount(true)
      try {
        const acct = await getCoreAccount(user.wallet.address)
        setCoreAccount(acct)
      } catch {
        setCoreAccount(null)
      } finally {
        setLoadingCoreAccount(false)
      }
    }
    run()
  }, [authenticated, user?.wallet?.address, selectedPlatform])

  // Check token allowance when fromToken or fromAmount changes
  useEffect(() => {
    const checkTokenAllowance = async () => {
      // Reset approval state first
      setIsTokenApproved(false)
      setTokenAllowance("0")

      if (!authenticated || !user?.wallet?.address || !fromToken?.address) {
        return
      }

      // Skip allowance check for HYPE token (native token) only
      if (fromToken.symbol === 'HYPE') {
        setTokenAllowance(fromAmount || "0")
        setIsTokenApproved(true)
        return
      }

      // Only check allowance if there's an input amount
      if (!fromAmount || parseFloat(fromAmount) <= 0) {
        return
      }

      try {
        const allowance = await checkAllowance(fromToken.address, user.wallet.address)
        setTokenAllowance(allowance?.toString() || "0")
        
        // Get token decimals and convert allowance to human-readable format
        const decimals = await getTokenDecimals(fromToken.address)
        const { formatUnits } = await import('ethers')
        const allowanceFormatted = allowance ? parseFloat(formatUnits(allowance, decimals)) : 0
        
        // Check if allowance is sufficient for the input amount
        const inputAmountBig = parseFloat(fromAmount)
        setIsTokenApproved(allowanceFormatted >= inputAmountBig)
        
       //console.log(`Allowance check: ${allowance} (${allowanceFormatted} ${fromToken.symbol}) vs required: ${fromAmount}, approved: ${allowanceFormatted >= inputAmountBig}`)
      } catch (error) {
        console.error('Error checking allowance:', error)
        setTokenAllowance("0")
        setIsTokenApproved(false)
      }
    }

    checkTokenAllowance()
  }, [authenticated, user?.wallet?.address, fromToken?.address, fromToken?.symbol, fromAmount])

  // Check WHYPE allowance when HYPE is wrapped and token becomes WHYPE
  useEffect(() => {
    const checkWhypeAllowance = async () => {
      // Reset WHYPE approval state first
      setWhypeAllowance("0")
      setIsWhypeApproved(false)

      if (!authenticated || !user?.wallet?.address || !fromToken || fromToken.symbol !== 'WHYPE' || !isHypeWrapped) {
        return
      }

      // Only check allowance if there's an input amount
      if (!fromAmount || parseFloat(fromAmount) <= 0) {
        return
      }

      try {
        // Use the current fromToken since it's now WHYPE
        if (!fromToken.address) {
          return
        }

        const allowance = await checkAllowance(fromToken.address, user.wallet.address)
        setWhypeAllowance(allowance?.toString() || "0")
        
        // Get token decimals and convert allowance to human-readable format
        const decimals = await getTokenDecimals(fromToken.address)
        const { formatUnits } = await import('ethers')
        const allowanceFormatted = allowance ? parseFloat(formatUnits(allowance, decimals)) : 0
        
        // Check if allowance is sufficient for the input amount
        const inputAmountBig = parseFloat(fromAmount)
        setIsWhypeApproved(allowanceFormatted >= inputAmountBig)
        
       // console.log(`WHYPE allowance check: ${allowance} (${allowanceFormatted} WHYPE) vs required: ${fromAmount}, approved: ${allowanceFormatted >= inputAmountBig}`)
      } catch (error) {
        console.error('Error checking WHYPE allowance:', error)
        setWhypeAllowance("0")
        setIsWhypeApproved(false)
      }
    }

    checkWhypeAllowance()
  }, [authenticated, user?.wallet?.address, fromToken?.symbol, fromToken?.address, isHypeWrapped, fromAmount])

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
  const availableBuyTokens = filteredTokenSearch.filter(token => {
    if (!fromToken) return true
    
    // Exclude the same token
    if (token.symbol === fromToken.symbol) return false
    
    // If HYPE is selected as input, exclude WHYPE from output
    if (fromToken.symbol === 'HYPE' && token.symbol === 'WHYPE') return false
    
    // If WHYPE is selected as input, exclude HYPE from output
    if (fromToken.symbol === 'WHYPE' && token.symbol === 'HYPE') return false
    
    return true
  })

  const handleSwapTokens = () => {
    const temp = fromToken
    const tempAmount = fromAmount
    setFromToken(toTokens[0] || null)
    setToTokens(fromToken ? [fromToken] : [])
    setFromAmount(toPercentages[toTokens[0]?.symbol || ''] || '')
    setToPercentages(fromToken ? { [fromToken.symbol]: tempAmount } : {})
  }

  const handleSwapWithToken = (targetToken: Token) => {
    if (!fromToken) return
    
    // Store current input token and amount
    const currentFromToken = fromToken
    const currentFromAmount = fromAmount
    
    // Move target token to input position
    setFromToken(targetToken)
    setFromAmount(toPercentages[targetToken.symbol] || '')
    
    // Remove target token from output tokens
    const newToTokens = toTokens.filter(t => t.symbol !== targetToken.symbol)
    
    // Add current input token to output tokens
    const newToTokensWithCurrent = [...newToTokens, currentFromToken]
    
    // Update output tokens
    setToTokens(newToTokensWithCurrent)
    
    // Update percentages
    const newToPercentages = { ...toPercentages }
    delete newToPercentages[targetToken.symbol]
    newToPercentages[currentFromToken.symbol] = currentFromAmount
    
    setToPercentages(newToPercentages)
    
    // Reset HYPE wrapped state when changing from token
    setIsHypeWrapped(false)
    // Reset token approval state when changing from token
    setIsTokenApproved(false)
    setTokenAllowance("0")
    // Reset WHYPE approval state when changing from token
    setIsWhypeApproved(false)
    setWhypeAllowance("0")
  }

  // Function to fetch balance for a specific token
  const fetchTokenBalance = async (token: Token) => {
    if (!authenticated || !user?.wallet?.address || !token.address) {
      return
    }

    try {

      
      if (token.address === "0x2222222222222222222222222222222222222222") {
        // Handle HYPE token separately
        const balance = await fetchHYPEBalance(user.wallet.address)
        setTokenBalances(prev => ({
          ...prev,
          [token.address!]: balance
        }))

      } else {
        // Handle ERC20 token
        const balances = await fetchTokenBalances(user.wallet.address, [token.address])
        setTokenBalances(prev => ({
          ...prev,
          ...balances
        }))

      }
    } catch (error) {
      console.error(`Error fetching balance for ${token.symbol}:`, error)
    }
  }

  const handleTokenSelect = (token: Token, isFrom: boolean) => {
    // Check if this token is from contract mapping (not in initialTokens)
    const isFromContractMapping = !tokens.find(t => t.symbol === token.symbol && t.address === token.address)
    
    if (isFrom) {
      setFromToken(token)
      setShowFromTokenModal(false)
      // Reset HYPE wrapped state when changing from token
      setIsHypeWrapped(false)
      // Reset token approval state when changing from token
      setIsTokenApproved(false)
      setTokenAllowance("0")
      // Reset WHYPE approval state when changing from token
      setIsWhypeApproved(false)
      setWhypeAllowance("0")
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
        if (prev.length >= 4) {
          return prev // Enforce max of 4 output tokens
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
  const isInputValid = !!fromAmount && parseFloat(fromAmount) > 0
  const isOutputValid = toTokens.length > 0 && toTokens.some(token => {
    const percentage = toPercentages[token.symbol] || "0"
    return percentage && parseFloat(percentage) > 0
  })
  
  // Calculate total percentage
  const totalPercentage = toTokens.reduce((total, token) => {
    const percentage = toPercentages[token.symbol] || "0"
    return total + parseFloat(percentage)
  }, 0)
  
  const isPercentageExceeding = totalPercentage > 100
  const isValidTotalPercentage = Math.abs(totalPercentage - 100) < 0.01 // Allow small floating point differences

  // EVM: check available balance for Sell token (compute directly to avoid helper order dependency)
  const fromTokenBalance = fromToken ? (() => {
    if (authenticated && fromToken.address && tokenBalances[fromToken.address]) {
      const balanceNum = parseFloat(tokenBalances[fromToken.address])
      return isNaN(balanceNum) ? 0 : balanceNum
    }
    const fallback = parseFloat(String(fromToken.balance ?? 0))
    return isNaN(fallback) ? 0 : fallback
  })() : 0
  const isBalanceInsufficient = selectedPlatform === 'hyperevm' && !!fromToken && isInputValid && parseFloat(fromAmount || '0') > fromTokenBalance

  // Helper function to remove a token from toTokens
  const removeToToken = (tokenSymbol: string) => {
    setToTokens(prev => prev.filter(t => t.symbol !== tokenSymbol))
    const newToPercentages = { ...toPercentages }
    delete newToPercentages[tokenSymbol]
    setToPercentages(newToPercentages)
  }

  // Helper function to update percentage for a specific token with auto-adjustment
  const updateToTokenPercentage = (tokenSymbol: string, percentage: string) => {
    const newPercentage = parseFloat(percentage) || 0
    
    setToPercentages(prev => {
      const currentTokens = toTokens.filter(t => t.symbol !== tokenSymbol)
      const otherTokensCount = currentTokens.length
      
      if (otherTokensCount === 0) {
        // Only one token, allow up to 100%
        const clampedPercentage = Math.min(100, Math.max(0, newPercentage))
        return { [tokenSymbol]: String(parseFloat(clampedPercentage.toFixed(2))) }
      }
      
      // Clamp the new percentage to a reasonable range
      const clampedPercentage = Math.min(100, Math.max(0, newPercentage))
      
      // Calculate remaining percentage for other tokens
      const remainingPercentage = Math.max(0, 100 - clampedPercentage)
      const percentagePerOtherToken = remainingPercentage / otherTokensCount
      
      // Build new percentages object with precise rounding
      const newPercentages: Record<string, string> = {}
      
      // Set the main token
      newPercentages[tokenSymbol] = String(parseFloat(clampedPercentage.toFixed(2)))
      
      // Distribute remaining among other tokens
      let distributedTotal = parseFloat(clampedPercentage.toFixed(2))
      
      currentTokens.forEach((token, index) => {
        if (index === currentTokens.length - 1) {
          // For the last token, use exact remaining to ensure total is 100%
          const lastPercentage = parseFloat((100 - distributedTotal).toFixed(2))
          newPercentages[token.symbol] = String(Math.max(0, lastPercentage))
        } else {
          const roundedPercentage = parseFloat(percentagePerOtherToken.toFixed(2))
          newPercentages[token.symbol] = String(Math.max(0, roundedPercentage))
          distributedTotal += roundedPercentage
        }
      })
      
      // Final safety check: ensure total never exceeds 100%
      const finalTotal = Object.values(newPercentages).reduce((sum, val) => sum + parseFloat(val), 0)
      if (finalTotal > 100) {
        // If somehow we exceed 100%, proportionally reduce all values
        const scaleFactor = 100 / finalTotal
        Object.keys(newPercentages).forEach(symbol => {
          const scaledValue = parseFloat(newPercentages[symbol]) * scaleFactor
          newPercentages[symbol] = String(parseFloat(scaledValue.toFixed(2)))
        })
      }
      
      return newPercentages
    })
  }

  // Auto-distribute percentages when toTokens changes
  useEffect(() => {
    if (toTokens.length > 0) {
      const equalPercentage = 100 / toTokens.length
      const newPercentages: Record<string, string> = {}
      
      // Set ALL tokens to equal percentage (redistribute everything)
      let distributedTotal = 0
      
      toTokens.forEach((token, index) => {
        if (index === toTokens.length - 1) {
          // For the last token, use exact remaining to ensure total is exactly 100%
          const lastPercentage = parseFloat((100 - distributedTotal).toFixed(2))
          newPercentages[token.symbol] = String(Math.max(0, lastPercentage))
        } else {
          const roundedPercentage = parseFloat(equalPercentage.toFixed(2))
          newPercentages[token.symbol] = String(roundedPercentage)
          distributedTotal += roundedPercentage
        }
      })
      
      // Only update if there's an actual change in tokens or percentages need redistribution
      const currentTokenSymbols = Object.keys(toPercentages).sort()
      const newTokenSymbols = toTokens.map(t => t.symbol).sort()
      const tokensChanged = currentTokenSymbols.join(',') !== newTokenSymbols.join(',')
      
      if (tokensChanged) {
        setToPercentages(newPercentages)
      }
    } else {
      // Clear all percentages if no tokens selected
      setToPercentages({})
    }
  }, [toTokens.length, toTokens.map(t => t.symbol).join(',')]) // Only trigger when tokens change

  // Helper function to get real balance or fallback to placeholder
  const getTokenBalance = (token: Token | null): string => {
    if (!token) return "99999999999"
    if (authenticated && token.address && tokenBalances[token.address]) {
      const balance = parseFloat(tokenBalances[token.address])

      return balance.toFixed(6)
    }

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
  const tvWidgetRef = useRef<any>(null);
  const tvReadyRef = useRef<boolean>(false);
  const chartRef = useRef<any>(null);
  const currentStudyIdRef = useRef<number | null>(null);
  const initTradingView = (containerId: string, symbol: string = "BYBIT:HYPEUSDT", studies?: any[]) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Clear any existing content
    container.innerHTML = '';

    if ((window as any).TradingView) {
      // Map timeframe to TradingView interval format
      const getTradingViewInterval = (tf: string) => {
        const intervalMap: { [key: string]: string } = {
          '1m': '1',
          '5m': '5',
          '15m': '15',
          '1h': '60',
          '4h': '240',
          '12h': '720',
          '1d': '1D',
          '1w': '1W',
        };
        return intervalMap[tf] || '60';
      };

      // Map selected pair to TradingView symbol format
      const getTradingViewSymbol = (token: string) => {
        // Handle grouped values like "HYPE/USDC" (spot) and "HYPE-USDC" (perps)
        const isSpot = token?.includes('/USDC')
        const isPerp = token?.includes('-USDC')
        const base = isSpot ? token.split('/')[0] : isPerp ? token.split('-')[0] : token

        // Perps mapping (Bybit .P contracts)
        const perpsMap: { [key: string]: string } = {
          'HYPE': 'BYBIT:HYPEUSDT.P',
          'UETH': 'BYBIT:ETHUSD.P',
          'UBTC': 'BYBIT:BTCUSD.P',
          'USOL': 'BYBIT:SOLUSD.P',
          'UFART': 'BYBIT:FARTCOINUSDT.P',
        }

        // Spot mapping (Bybit spot USDT pairs when available)
        const spotMap: { [key: string]: string } = {
          'HYPE': 'BYBIT:HYPEUSDT',
          'UETH': 'BYBIT:ETHUSDT',
          'UBTC': 'BYBIT:BTCUSDT',
          'USOL': 'BYBIT:SOLUSDT',
          'JEF': 'BYBIT:JEFUSDT',
        }

        if (isPerp) {
          return perpsMap[base] || `BYBIT:${base}USDT.P`
        }
        if (isSpot) {
          return spotMap[base] || `BYBIT:${base}USDT`
        }
        // Fallback for old values where token is just a base symbol
        return perpsMap[base] || spotMap[base] || `BYBIT:${base}USDT`
      };

      // Use different logic for HyperCore vs HyperEVM
      if (containerId === "hypercore_tradingview_chart") {
        // Simple HyperCore chart
        new (window as any).TradingView.widget({
          autosize: true,
          symbol: symbol,
          interval: "1H",
          timezone: "Etc/UTC",
          theme: (resolvedTheme === 'light') ? 'light' : 'dark',
          style: "1",
          locale: "en",
          toolbar_bg: (resolvedTheme === 'light') ? "#ffffff" : "#0b0b0b",
          enable_publishing: false,
          allow_symbol_change: true,
          container_id: containerId,
          width: "140%",
          height: "400"
        });
      } else {
        // Complex HyperEVM chart with studies
      tvWidgetRef.current = new (window as any).TradingView.widget({
        autosize: true,
        symbol: getTradingViewSymbol(triggerToken || 'HYPE'),
        interval: getTradingViewInterval(timeframe || '1h'),
        timezone: "Etc/UTC",
        theme: (resolvedTheme === 'light') ? 'light' : 'dark',
        style: "1",
        locale: "en",
        toolbar_bg: (resolvedTheme === 'light') ? "#ffffff" : "#0b0b0b",
        enable_publishing: false,
        allow_symbol_change: true,
        container_id: containerId,
        width: "100%",
        height: "500",
        studies: studies || []
      });

        // Wait for chart to be ready, cache reference (only for HyperEVM)
      tvWidgetRef.current.onChartReady?.(() => {
        tvReadyRef.current = true;
        chartRef.current = tvWidgetRef.current.activeChart?.();
      });
      }
    }
  };

  // Load TradingView script only when needed
  const loadTradingViewScript = (containerId: string, symbol: string = "BYBIT:HYPEUSDT", studies?: any[]) => {
    // Check if TradingView is already loaded
    if ((window as any).TradingView) {
      initTradingView(containerId, symbol, studies);
      return;
    }

    // Load TradingView script
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => initTradingView(containerId, symbol, studies);
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

  // Fetch real-time token prices from Hyperliquid on page load
  useEffect(() => {
    const fetchAllPrices = async () => {
      setIsLoadingPrices(true)
      try {
        // Fetch real-time prices from Hyperliquid API
        const realTimePrices = await updateAllTokenPrices()
        
        if (realTimePrices && Object.keys(realTimePrices).length > 0) {
          // Use real-time prices, fallback to default for missing tokens
          const finalPriceCache = { ...DEFAULT_TOKEN_PRICES, ...realTimePrices }
          setPriceCache(finalPriceCache)
        } else {
          // Fallback to default prices if API fails
          console.warn('Failed to fetch real-time prices, using fallback data')
          setPriceCache(DEFAULT_TOKEN_PRICES)
        }
        
      } catch (error) {
        console.warn('Error fetching real-time prices - using fallback data:', error)
        setPriceCache(DEFAULT_TOKEN_PRICES)
      } finally {
        setIsLoadingPrices(false)
      }
    }

    fetchAllPrices()
    
    // Set up periodic price updates every 30 seconds
    const priceUpdateInterval = setInterval(async () => {
      try {
        const realTimePrices = await updateAllTokenPrices()
        
        if (realTimePrices && Object.keys(realTimePrices).length > 0) {
          const finalPriceCache = { ...DEFAULT_TOKEN_PRICES, ...realTimePrices }
          setPriceCache(finalPriceCache)
        }
      } catch (error) {
        console.warn('Error refreshing prices:', error)
      }
    }, 30000) // 30 seconds
    
    // Cleanup interval on component unmount
    return () => {
      clearInterval(priceUpdateInterval)
    }
  }, [])

  // Fetch token balances when wallet is connected
  useEffect(() => {
    const fetchBalances = async () => {
      if (authenticated && user?.wallet?.address) {

        try {
          // Get all token addresses from the tokens array
          const tokenAddresses = tokens
            .filter(token => token.address) // Include all tokens with addresses
            .map(token => token.address!)

          // Fetch ERC20 token balances and HYPE balance
          // exclude HYPE from the fetchTokenBalances function
          const tokenAddressesWithoutHYPE = tokenAddresses.filter(address => address !== "0x2222222222222222222222222222222222222222")
          
          const [erc20Balances, ethBalance] = await Promise.all([
            fetchTokenBalances(user.wallet.address, tokenAddressesWithoutHYPE),
            fetchHYPEBalance(user.wallet.address)
          ])



                    // Combine all balances - use the token addresses as keys
          const allBalances = {
            ...erc20Balances,
            "0x2222222222222222222222222222222222222222": ethBalance, // Special case for native HYPE token
          }
           


          setTokenBalances(allBalances)
        } catch (error) {
          console.error('Error fetching token balances:', error)
        }
      }
    }

    fetchBalances()
  }, [authenticated, user?.wallet?.address, tokens]);

  // Load TradingView widget when OHLCV configuration step is reached or HyperCore platform is selected
  useEffect(() => {
    if (currentStep === 4 && conditionType === "ohlcv_trigger") {
      loadTradingViewScript("ohlcv_tradingview_chart", "BYBIT:HYPEUSDT");
    }
    
    // Load TradingView widget for HyperCore platform
    if (currentStep === 2 && selectedPlatform === "hypercore") {
      loadTradingViewScript("hypercore_tradingview_chart", "BYBIT:HYPEUSDT", []);
    }
    
    // Cleanup when leaving the OHLCV step or HyperCore platform
    return () => {
      const ohlcvContainer = document.getElementById('ohlcv_tradingview_chart');
      if (ohlcvContainer) {
        ohlcvContainer.innerHTML = '';
      }
      
      const hypercoreContainer = document.getElementById('hypercore_tradingview_chart');
      if (hypercoreContainer) {
        hypercoreContainer.innerHTML = '';
      }
    };
  }, [currentStep, conditionType, triggerToken, timeframe, resolvedTheme, selectedPlatform]);

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
      // Prepare outputs array (percentage-based) limited to 4
      const selectedOutputs = toTokens.slice(0, 4).map(token => ({
        token: token.address || '0x0000000000000000000000000000000000000000',
        percentage: Number(toPercentages[token.symbol] || '0'),
      }));

      const primaryOutputToken = selectedOutputs[0];

      // Helper function to determine source type
      const getSourceType = (sourceValue: string): "OHLCV" | "indicators" => {
        if (["open", "high", "low", "close", "volume"].includes(sourceValue)) {
          return "OHLCV";
        }
        return "indicators";
      };

      // Helper function to get indicator parameters
      const getIndicatorParameters = (indicatorKey: string) => {
        if (indicatorKey === "sma") {
          return {
            length: indicatorParams.sma_length,
            OHLC_source: indicatorParams.sma_source,
            std_dev: undefined
          };
        } else if (indicatorKey === "ema") {
          return {
            length: indicatorParams.ema_length,
            OHLC_source: indicatorParams.ema_source,
            std_dev: undefined
          };
        } else if (indicatorKey === "rsi") {
          return {
            length: indicatorParams.rsi_length,
            OHLC_source: indicatorParams.rsi_source,
            std_dev: undefined
          };
        } else if (indicatorKey.startsWith("bb_")) {
          return {
            length: indicatorParams.bb_length,
            OHLC_source: indicatorParams.bb_source,
            std_dev: indicatorParams.bb_std
          };
        }
        return undefined;
      };

      const orderPayload = {
        platform: (selectedPlatform as 'hyperevm' | 'hypercore') || 'hyperevm',
        wallet: '0x0000000000000000000000000000000000000000',
        swap_data: {
          input_token: fromToken?.address || '0x0000000000000000000000000000000000000000',
          input_amount: isFinite(inputAmountNum) ? inputAmountNum : 0,
          // Legacy single-output fields populated from first split for compatibility
          output_token: primaryOutputToken?.token || '0x0000000000000000000000000000000000000000',
          // New percentage-based outputs for up to 4 tokens
          outputs: selectedOutputs,
        },
        order_data: {
          type: 'ohlcv_trigger',
          ohlcv_trigger: {
            pair: triggerToken || 'HYPE',
            timeframe: timeframe || '1h',
            first_source: {
              type: getSourceType(source),
              source: getSourceType(source) === "OHLCV" ? source : undefined,
              indicator: getSourceType(source) === "indicators" ? source : undefined,
              parameters: getSourceType(source) === "indicators" ? getIndicatorParameters(source) : undefined,
            },
            trigger_when: triggerWhen || 'above',
            second_source: {
              type: secondSourceType === "value" ? "value" : "indicators",
              value: secondSourceType === "value" ? Number(secondSourceValue) : undefined,
              indicator: secondSourceType === "indicators" ? source : undefined,
              parameters: secondSourceType === "indicators" ? getIndicatorParameters(source) : undefined,
            },
            cooldown: {
              active: cooldownActive,
              value: cooldownActive ? Number(cooldownValue) : null,
            },
            chained_confirmation: {
              active: chainedConfirmation,
              bars: chainedConfirmation ? Number(chainedConfirmationBars) || 1 : null,
            },
            invalidation_halt: {
              active: invalidationHaltActive,
            },
            lifetime: orderLifetime || '24h',
          },
          wallet_activity: null,
        },
        signature: null,
        time: Date.now(),
      };

      const response = await fetch(`${config.apiUrl}/api/order`, {
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



  const handleInstantSwap = async () => {
    // Reset state and show the swap flow visualization modal
    setIsSwapProcessing(true);
    setSwapResults([]);
    setShowSwapFlowModal(true);
    
    // Check if wallet is connected
    if (!authenticated || !user?.wallet?.address) {
      console.error('Wallet not connected');
      setShowSwapFlowModal(false);
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
        setShowSwapFlowModal(false);
        return;
      }

      // Build instant swap order payload
      const inputAmountNum = Number(fromAmount);
      
      // Prepare outputs array (percentage-based) limited to 4
      const selectedOutputs = toTokens.slice(0, 4).map(token => ({
        token: token.address || '0x0000000000000000000000000000000000000000',
        percentage: Number(toPercentages[token.symbol] || '0'),
      }));

      const orderPayload = {
        platform: (selectedPlatform as 'hyperevm' | 'hypercore') || 'hyperevm',
        wallet: user.wallet.address,
        swap_data: {
          input_token: fromToken?.address || '0x0000000000000000000000000000000000000000',
          input_amount: isFinite(inputAmountNum) ? inputAmountNum : 0,
          // New percentage-based outputs for up to 4 tokens
          outputs: selectedOutputs,
        },
        order_data: {
          type: 'instant_swap',
        },
        signature: null,
        time: Date.now(),
      };

    // console.log('Sending instant swap order:', orderPayload);

      const response = await fetch(`${config.apiUrl}/api/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${backendJwt}`,
        },
        body: JSON.stringify(orderPayload),
      });

      if (response.ok) {
        const result = await response.json();
        // console.log('Instant swap result:', result);
        // console.log('Result type:', typeof result);
        // console.log('Is array:', Array.isArray(result));
        
        // Handle successful response
        if (Array.isArray(result)) {
        //  console.log('Received swap results array:', result);
          setSwapResults(result);
          setIsSwapProcessing(false); // Switch to success state
        } else if (result && typeof result === 'object') {
         // console.log('Result keys:', Object.keys(result));
          
          // Check if it's an order object with actual_outputs (completed swap)
          if (result.actual_outputs && Array.isArray(result.actual_outputs) && result.actual_outputs.length > 0) {
          //  console.log('Found swap results in actual_outputs:', result.actual_outputs);
            setSwapResults(result.actual_outputs);
            setIsSwapProcessing(false);
          } 
          // Check if the result itself is a non-empty array (direct swap results)
          else if (result.length !== undefined && result.length > 0) {
            //console.log('Response appears to be a non-empty array-like object:', result);
            setSwapResults(Array.isArray(result) ? result : [result]);
            setIsSwapProcessing(false);
          }
          // Check if it's an order that's been created but not executed yet
          else if (result.id && result.state === 'open' && (result.actual_outputs === null || (Array.isArray(result.actual_outputs) && result.actual_outputs.length === 0))) {
          //  console.log('Order created but not executed yet. Order ID:', result.id);
          //  console.log('Order state:', result.state);
            
            // For now, let's show that the order was created
            setSwapResults([]);
            setIsSwapProcessing(false);
            
          ///  console.log('Instant swap order created successfully with ID:', result.id);
          }
          // Check common nested array patterns
          else if (result.data && Array.isArray(result.data)) {
           // console.log('Found array in result.data:', result.data);
            setSwapResults(result.data);
            setIsSwapProcessing(false);
          } else if (result.results && Array.isArray(result.results)) {
           // console.log('Found array in result.results:', result.results);
            setSwapResults(result.results);
            setIsSwapProcessing(false);
          } else if (result.swaps && Array.isArray(result.swaps)) {
          //  console.log('Found array in result.swaps:', result.swaps);
            setSwapResults(result.swaps);
            setIsSwapProcessing(false);
          } else {
           // console.log('Unexpected response format - object without recognizable structure:', result);
          //  console.log('Available properties:', Object.keys(result));
            setShowSwapFlowModal(false);
          }
        } else {
        //  console.log('Unexpected response format - not array or object:', result);
        //  console.log('Response type:', typeof result);
          setShowSwapFlowModal(false);
        }
      } else {
        const errorText = await response.text();
        console.error('Failed to execute instant swap:', response.status, errorText);
        setShowSwapFlowModal(false);
      }
    } catch (error) {
      console.error('Error executing instant swap:', error);
      setShowSwapFlowModal(false);
    }
  }

  const handleWrapHype = async () => {
    if (!user?.wallet?.address || !fromAmount) {
      console.error("No wallet connected or amount specified")
      return
    }

    try {
      // Get signer from Privy - using the wallet's provider
      const { BrowserProvider } = await import('ethers')
      
      // For Privy, we can use the wallet's ethereum provider
      if (!(window as any).ethereum) {
        throw new Error("No ethereum provider found")
      }
      
      const ethersProvider = new BrowserProvider((window as any).ethereum)
      const signer = await ethersProvider.getSigner()

      // Call wrap function with popup transaction
      const tx = await wrapHype(fromAmount, signer)
      
     // console.log(`Wrap HYPE transaction initiated:`, tx.hash)
      
      // Add transaction to monitoring system
      addTransaction(tx.hash, 'wrap', 'HYPE')
      
      // Add to pending transactions
      setPendingTransactions(prev => new Set(prev).add(tx.hash))
      
      //console.log("HYPE wrap transaction submitted for monitoring")
    } catch (error: any) {
      console.error(`Error wrapping HYPE:`, error)
      
      // Reset retry state on any error
      setIsRetryingTransaction(false)
      
      // Check if user rejected the transaction
      if (error?.code === 'ACTION_REJECTED' || error?.code === 4001 || 
          error?.message?.includes('rejected') || error?.message?.includes('denied') ||
          error?.message?.includes('cancelled') || error?.message?.includes('User rejected')) {
        // Show retry modal for user rejection
        setRejectedTransactionData({
          tokenAddress: WHYPE_CONTRACT_ADDRESS,
          tokenSymbol: 'HYPE'
        })
        setShowTransactionRejectedModal(true)
      } else {
        // Other errors (network, etc.) - just log for now
        console.error(`Network or other error for HYPE wrapping:`, error)
      }
    }
  }

  const handleApproveToken = async (tokenAddress: string, tokenSymbol: string) => {
    if (!user?.wallet?.address || !fromAmount) {
      console.error("No wallet connected or amount specified")
      return
    }

    try {
      // Get signer from Privy - using the wallet's provider
      const { BrowserProvider } = await import('ethers')
      
      // For Privy, we can use the wallet's ethereum provider
      if (!(window as any).ethereum) {
        throw new Error("No ethereum provider found")
      }
      
      const ethersProvider = new BrowserProvider((window as any).ethereum)
      const signer = await ethersProvider.getSigner()

      // Call approve function with popup transaction
      const tx = await approveToken(tokenAddress, fromAmount, signer)
      
     // console.log(`Approve ${tokenSymbol} transaction initiated:`, tx.hash)
      
      // Add transaction to monitoring system
      addTransaction(tx.hash, 'approval', tokenSymbol)
      
      // Add to pending transactions
      setPendingTransactions(prev => new Set(prev).add(tx.hash))
      
     // console.log(`${tokenSymbol} approval transaction submitted for monitoring`)
    } catch (error: any) {
      console.error(`Error approving ${tokenSymbol}:`, error)
      
      // Reset retry state on any error
      setIsRetryingTransaction(false)
      
      // Check if user rejected the transaction
      if (error?.code === 'ACTION_REJECTED' || error?.code === 4001 || 
          error?.message?.includes('rejected') || error?.message?.includes('denied') ||
          error?.message?.includes('cancelled') || error?.message?.includes('User rejected')) {
        // Show retry modal for user rejection
        setRejectedTransactionData({
          tokenAddress,
          tokenSymbol
        })
        setShowTransactionRejectedModal(true)
      } else {
        // Other errors (network, etc.) - just log for now
        console.error(`Network or other error for ${tokenSymbol}:`, error)
      }
    }
  }

  const handleRetryApproval = () => {
    if (rejectedTransactionData) {
      setIsRetryingTransaction(true)
      // Check if this is a HYPE wrapping retry
      if (rejectedTransactionData.tokenSymbol === 'HYPE' && rejectedTransactionData.tokenAddress === WHYPE_CONTRACT_ADDRESS) {
        // Retry HYPE wrapping
        handleWrapHype()
      } else {
        // Retry token approval with the stored data
        handleApproveToken(rejectedTransactionData.tokenAddress, rejectedTransactionData.tokenSymbol)
      }
    }
  }

  const handleCancelRetry = () => {
    setShowTransactionRejectedModal(false)
    setRejectedTransactionData(null)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 22px;
          width: 22px;
          border-radius: 60%;
          background: #06c9a2;
          cursor: pointer;
          border: 2px solid #c4cbc5;
          box-shadow: 0 2px 4px #04241c;
        }

        .slider::-moz-range-thumb {
          height: 22px;
          width: 22px;
          border-radius: 60%;
          background: #06c9a2;
          cursor: pointer;
          border: 2px solid #c4cbc5;
          box-shadow: 0 2px 4px #04241c;
        }

        @keyframes pulse-border {
          0%, 100% {
            border-width: 2px;
          }
          50% {
            border-width: 6px;
          }
        }

        .spinning-border {
          animation: spin 1s linear infinite, pulse-border 2s ease-in-out infinite;
        }
      `}</style>
      {/* Header */}
      <header className="border-b bg-card">
        <div className="flex h-16 items-center px-6">
          <div className="flex items-center space-x-4">
            <a href="/" className="flex items-center space-x-1 hover:opacity-80 transition-opacity">
              <Logo width={24} height={24} />
              <span className="text-xl font-bold">Hyperstrike</span>
            </a>
            <nav className="hidden md:flex items-center space-x-6 text-sm">
              <a href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">Dashboard</a>
              <a href="/trade" className="font-medium text-primary">Trade</a>
              <a href="/docs" className="text-muted-foreground hover:text-foreground transition-colors">Docs</a>
            </nav>
          </div>
          <div className="ml-auto flex items-center space-x-4">
            <XpButton />
            <WalletButton />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="flex-1 container mx-auto px-4 py-8">


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
                        <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 border-green-200">
                          Available
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

        {/* Step 2: Swap Pair & Condition Type */}
        {currentStep === 2 && selectedPlatform === "hyperevm" && (
          <div className="max-w-7xl mx-auto">
            <div className="flex gap-6 transition-all duration-500 flex-col lg:flex-row lg:justify-center lg:items-start">
              {/* Swap Pair - Consistent size */}
              <div className="w-full max-w-md mx-auto lg:mx-0">
                <Card className="border-border/50 shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-foreground">Swap Pair</CardTitle>
                    <CardDescription>Choose the tokens you want to trade and configure amounts</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                  
                  {/* From Token (Sell) */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">Sell</Label>
                    <div className="flex items-start space-x-3 p-4 bg-card border border-border/50 rounded-lg">
                      <div className="flex-1 pt-1">
                        <Input
                          type="number"
                          placeholder="0"
                          value={fromAmount}
                          onChange={(e) => setFromAmount(e.target.value)}
                          className="text-2xl font-medium border-0 bg-transparent p-0 focus:ring-0 text-foreground pl-2 w-[90%] h-[2.5rem] flex items-center"
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
                              onClick={() => setFromAmount((parseFloat(getTokenBalance(fromToken)) * 0.999999999999999).toString())}
                              className="text-xs bg-transparent border border-gray-700 hover:bg-green-700 hover:border-green-700 hover:text-white cursor-pointer"
                            >
                              100%
                            </Button>
                          </div>
                        </div>
                        {selectedPlatform === 'hyperevm' && isBalanceInsufficient && (
                          <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-500">
                            Insufficient balance. You have {fromTokenBalance.toFixed(6)} {fromToken?.symbol}.
                          </div>
                        )}
                      </div>
                  <div className="flex flex-col items-end justify-start">
                    <Button
                      variant="outline"
                      className="flex items-center space-x-2 bg-card border-border/50 hover:bg-accent/50 px-3 py-2 h-[2.5rem]"
                      onClick={() => setShowFromTokenModal(true)}
                    >
                      {fromToken ? (
                        <>
                          <img src={fromToken.icon} alt={fromToken.symbol} className="w-6 h-6 rounded-full" />
                          <span className="text-foreground font-medium text-sm">{fromToken.symbol}</span>
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

                {/* Switch Buttons - Show individual buttons for each output token when multiple tokens */}
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
                  
                  {/* Dynamic Token Grid Container */}
                  <div className="flex flex-col gap-3 overflow-y-auto max-h-[300px] pr-2">
                    {/* Group tokens into pairs (levels) */}
                    {Array.from({ length: Math.ceil(toTokens.length / 2) }, (_, levelIndex) => {
                      const startIndex = levelIndex * 2
                      const tokensInLevel = toTokens.slice(startIndex, startIndex + 2)
                      
                      return (
                        <div key={`level-${levelIndex}`} className="grid grid-cols-2 gap-3">
                          {tokensInLevel.map((token, indexInLevel) => {
                            const tokenPercentage = toPercentages[token.symbol] || "0"
                            const percentNumber = Math.min(100, Math.max(0, parseFloat(tokenPercentage) || 0))
                            const tokenAmount = fromAmount ? (parseFloat(tokenPercentage) / 100) * parseFloat(fromAmount) : 0
                            const tokenValue = tokenAmount * getCachedPrice(token.symbol)
                            
                            // Make full width in these cases:
                            // 1. First token (levelIndex === 0 and only token in level) - always rectangle
                            // 2. Any lone token when we're at max capacity (4 tokens) - rectangle since no add button
                            const isFirstTokenAlone = levelIndex === 0 && tokensInLevel.length === 1
                            const isMaxCapacityLoneToken = tokensInLevel.length === 1 && toTokens.length >= 4
                            const isFullWidth = isFirstTokenAlone || isMaxCapacityLoneToken
                            
                            return (
                              <div 
                                key={token.symbol} 
                                className={`relative p-3 bg-card border rounded-lg transition-opacity duration-200 ${
                                  isFullWidth ? 'col-span-2' : ''
                                } ${isPercentageExceeding ? 'border-red-500/50' : 'border-border/50'} ${
                                  parseFloat(tokenPercentage) === 0 ? 'opacity-40' : 'opacity-100'
                                }`}
                              >
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
                                <div className="flex items-center justify-center mb-3">
                                  <div className="flex items-center space-x-2">
                                    <img src={token.icon} alt={token.symbol} className="w-6 h-6 rounded-full" />
                                    <span className="text-foreground font-medium text-base">{token.symbol}</span>
                                  </div>
                                  <span className="text-muted-foreground text-[10px] ml-2">{token.name}</span>
                                </div>
                                
                                {/* Percentage Input (Manual) */}
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="Enter percentage"
                                  value={toPercentages[token.symbol] || ""}
                                  onChange={(e) => {
                                    const raw = e.target.value
                                    const cleaned = raw.replace(/[^0-9.]/g, '')
                                    updateToTokenPercentage(token.symbol, cleaned)
                                  }}
                                  onBlur={() => {
                                    const raw = toPercentages[token.symbol] || ""
                                    const num = parseFloat(raw)
                                    if (isNaN(num)) {
                                      updateToTokenPercentage(token.symbol, "")
                                    } else {
                                      const clamped = Math.min(100, Math.max(0, num))
                                      updateToTokenPercentage(token.symbol, String(clamped))
                                    }
                                  }}
                                  className="text-base font-medium border-0 bg-transparent p-0 focus:ring-0 text-foreground mb-2"
                                />
                                {/* Percentage Slider */}
                                <div className="relative mt-1">
                                  <div className="pointer-events-none absolute inset-0 flex items-center justify-between">
                                    {[...Array(5)].map((_, i) => (
                                      <div key={i} className="w-px h-2 bg-muted-foreground/30"></div>
                                    ))}
                                  </div>
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={percentNumber}
                                    onChange={(e) => updateToTokenPercentage(token.symbol, e.target.value)}
                                    className="relative w-full appearance-none cursor-pointer slider"
                                    style={{
                                      '--slider-value': `${percentNumber}%`
                                    } as React.CSSProperties}
                                  />
                                </div>
                                
                                {/* Token Details */}
                                <div className="space-y-1 mt-2">
                                  {/* Token Amount Display - Replaces percentage */}
                                  {fromAmount && tokenPercentage ? (
                                    <div className="flex items-center space-x-1 text-xs font-medium text-foreground">
                                      <img src={fromToken?.icon} alt={fromToken?.symbol} className="w-3 h-3 rounded-full" />
                                      <span>
                                        {((parseFloat(tokenPercentage) / 100) * parseFloat(fromAmount)).toFixed(6)} {fromToken?.symbol}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="text-xs font-medium text-muted-foreground">
                                      0 {fromToken?.symbol || 'tokens'}
                                    </div>
                                  )}
                                  

                                </div>
                              </div>
                            )
                          })}
                          
                          {/* Add Token Button - show if this level has space and we haven't reached 4 tokens */}
                          {tokensInLevel.length === 1 && toTokens.length === 3 && levelIndex === 1 && (
                            <div
                              className="p-3 bg-muted/30 border-2 border-dashed border-border/50 rounded-lg cursor-pointer hover:bg-muted/50 hover:border-border transition-all"
                              onClick={() => setShowToTokenModal(true)}
                            >
                              <div className="flex flex-col items-center justify-center h-full text-center">
                                <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center mb-2">
                                  <span className="text-lg font-bold text-muted-foreground">+</span>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  Add token
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                    
                    {/* Add Token Button - only show if fewer than 4 outputs selected */}
                    {toTokens.length < 4 && toTokens.length <= 2 && (
                      <div className="grid grid-cols-2 gap-3">
                        <div
                          className="p-3 bg-muted/30 border-2 border-dashed border-border/50 rounded-lg cursor-pointer hover:bg-muted/50 hover:border-border transition-all col-span-2"
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
                    )}
                  </div>

                  {/* Total Percentage Display */}
                {toTokens.length > 0 && (
                  <div className={`flex items-center justify-center p-3 rounded-lg ${
                    isPercentageExceeding ? 'bg-red-500/10 border border-red-500/20' : 'bg-muted/50'
                  }`}>
                    <div className="flex items-center space-x-2">
                      {isPercentageExceeding ? (
                        <span className="text-sm font-medium text-foreground">
                          Total percentage of <span className="text-red-500">{totalPercentage.toFixed(2)}%</span> exceeds 100%
                      </span>
                      ) : (
                        <span className="text-sm font-medium text-foreground">{totalPercentage.toFixed(1)}%</span>
                      )}
                    </div>
                  </div>
                )}


                  </div>

                  {/* Validation Message */}
                  

                  </CardContent>
                </Card>

                {/* Instant Swap Button(s) - Enabled only when NO condition selected AND swap UI is complete */}
                <div className="mt-6">
                  {(fromToken?.symbol === 'HYPE' || (fromToken?.symbol === 'WHYPE' && isHypeWrapped)) ? (
                    /* HYPE/WHYPE token flow: Wrap → Approve WHYPE → Instant Swap */
                    <div className="flex gap-2">
                      {!isHypeWrapped ? (
                        /* Phase 1: Wrap HYPE */
                        <>
                          <Button 
                            onClick={() => {
                              if (isInputValid && isOutputValid && isValidTotalPercentage) {
                                handleWrapHype()
                              }
                            }}
                            disabled={!isInputValid || !isOutputValid || !isValidTotalPercentage || (selectedPlatform === 'hyperevm' && isBalanceInsufficient) || pendingTransactions.size > 0}
                            className={`flex-1 ${
                              (!isInputValid || !isOutputValid || !isValidTotalPercentage || (selectedPlatform === 'hyperevm' && isBalanceInsufficient) || pendingTransactions.size > 0)
                                ? 'bg-muted text-muted-foreground cursor-not-allowed' 
                                : 'bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer'
                            }`}
                          >
                            {pendingTransactions.size > 0 ? 'Wrapping...' : 'Wrap HYPE'}
                          </Button>
                          <Button 
                            disabled={true}
                            className="flex-1 bg-muted text-muted-foreground cursor-not-allowed"
                          >
                            Instant Swap
                            <Zap className="w-4 h-4 ml-2" />
                          </Button>
                        </>
                      ) : !isWhypeApproved ? (
                        /* Phase 2: Approve WHYPE */
                        <>
                          <Button 
                            onClick={() => {
                              if (isInputValid && isOutputValid && isValidTotalPercentage && fromToken?.address) {
                                // For WHYPE approval after wrapping, we use WHYPE token approval
                                handleApproveToken(fromToken.address, fromToken.symbol)
                              }
                            }}
                            disabled={!isInputValid || !isOutputValid || !isValidTotalPercentage || (selectedPlatform === 'hyperevm' && isBalanceInsufficient) || pendingTransactions.size > 0}
                            className={`flex-1 ${
                              (!isInputValid || !isOutputValid || !isValidTotalPercentage || (selectedPlatform === 'hyperevm' && isBalanceInsufficient) || pendingTransactions.size > 0)
                                ? 'bg-muted text-muted-foreground cursor-not-allowed' 
                                : 'bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer'
                            }`}
                          >
                            {pendingTransactions.size > 0 ? 'Approving...' : `Approve ${fromToken?.symbol || 'WHYPE'}`}
                          </Button>
                          <Button 
                            disabled={true}
                            className="flex-1 bg-muted text-muted-foreground cursor-not-allowed"
                          >
                            Instant Swap
                            <Zap className="w-4 h-4 ml-2" />
                          </Button>
                        </>
                      ) : (
                        /* Phase 3: Full-width Instant Swap */
                        <Button 
                          onClick={() => {
                            if (!conditionType && isInputValid && isOutputValid && isValidTotalPercentage) {
                              handleInstantSwap()
                            }
                          }}
                          disabled={!!conditionType || !isInputValid || !isOutputValid || !isValidTotalPercentage || (selectedPlatform === 'hyperevm' && isBalanceInsufficient)}
                          className={`w-full ${
                            (!!conditionType || !isInputValid || !isOutputValid || !isValidTotalPercentage || (selectedPlatform === 'hyperevm' && isBalanceInsufficient))
                              ? 'bg-muted text-muted-foreground cursor-not-allowed' 
                              : 'bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer'
                          }`}
                        >
                          Instant Swap
                          <Zap className="w-4 h-4 ml-2" />
                        </Button>
                      )}
                    </div>
                  ) : (
                    /* Buttons for other tokens - with conditional approve button */
                    <div className="flex gap-2">
                      {!isTokenApproved && fromToken && fromAmount && parseFloat(fromAmount) > 0 && (
                        <Button 
                          onClick={() => {
                            if (fromToken?.address) {
                              handleApproveToken(fromToken.address, fromToken.symbol)
                            }
                          }}
                          disabled={!isInputValid || !isOutputValid || !isValidTotalPercentage || (selectedPlatform === 'hyperevm' && isBalanceInsufficient) || pendingTransactions.size > 0}
                          className={`flex-1 ${
                            (!isInputValid || !isOutputValid || !isValidTotalPercentage || (selectedPlatform === 'hyperevm' && isBalanceInsufficient) || pendingTransactions.size > 0)
                              ? 'bg-muted text-muted-foreground cursor-not-allowed' 
                              : 'bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer'
                          }`}
                        >
                          {pendingTransactions.size > 0 ? 'Approving...' : `Approve ${fromToken.symbol}`}
                        </Button>
                      )}
                      <Button 
                        onClick={() => {
                          if (!conditionType && isInputValid && isOutputValid && isValidTotalPercentage && isTokenApproved) {
                            handleInstantSwap()
                          }
                        }}
                        disabled={!!conditionType || !isInputValid || !isOutputValid || !isValidTotalPercentage || (selectedPlatform === 'hyperevm' && isBalanceInsufficient) || !isTokenApproved}
                        className={`${!isTokenApproved && fromToken && fromAmount && parseFloat(fromAmount) > 0 ? 'flex-1' : 'w-full'} ${
                          (!!conditionType || !isInputValid || !isOutputValid || !isValidTotalPercentage || (selectedPlatform === 'hyperevm' && isBalanceInsufficient) || !isTokenApproved)
                            ? 'bg-muted text-muted-foreground cursor-not-allowed' 
                            : 'bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer'
                        }`}
                      >
                        Instant Swap
                        <Zap className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Add Condition Button with preview/selection */}
              {/* Condition Selection Box - Always visible when unlocked */}
              {isConditionSelectionUnlocked && (
                <div className="hidden lg:flex items-center justify-center w-full max-w-md">
                  <div className="relative h-auto min-h-[400px] w-full border-2 border-dashed border-primary/24 rounded-lg transition-all duration-300 opacity-80 overflow-hidden">
                    
                    {/* Unlocked selection state - Always show when unlocked */}
                    <div className="p-4 h-full">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-foreground">Choose Condition Type</h3>
                        <button
                          onClick={() => {
                            setIsConditionSelectionUnlocked(false)
                            setConditionType("") // Clear the selected condition
                          }}
                          className="text-muted-foreground hover:text-foreground p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3 h-[calc(100%-120px)]">
                        {conditionTypes.map((condition) => {
                          const Icon = condition.icon
                          return (
                            <div
                              key={condition.id}
                              className={`aspect-square border-2 rounded-lg cursor-pointer transition-all hover:shadow-md flex flex-col items-center justify-center p-3 ${
                                conditionType === condition.id
                                  ? "border-primary bg-primary/10 shadow-lg"
                                  : "border-border/50 hover:border-primary/30 hover:bg-accent/50"
                              }`}
                              onClick={() => setConditionType(condition.id)}
                            >
                              <div
                                className={`p-2 rounded-lg transition-colors mb-2 ${
                                  conditionType === condition.id 
                                    ? "bg-primary text-primary-foreground" 
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                <Icon className="w-5 h-5" />
                              </div>
                              <div className="text-center">
                                <h4 className="text-xs font-medium text-foreground leading-tight">{condition.name}</h4>
                                {condition.popular && (
                                  <Badge variant="secondary" className="text-xs bg-primary/20 text-primary border-primary/30 mt-1">
                                    Popular
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                  

                </div>
              )}

              {/* Add Condition Button - Only show when not unlocked */}
              {!isConditionSelectionUnlocked && (
                <div className="hidden lg:flex items-center justify-center w-full max-w-md">
                  <div 
                    className="relative h-auto min-h-[400px] w-full border-2 border-dashed border-primary/24 rounded-lg cursor-pointer hover:border-primary/40 hover:bg-primary/4 transition-all duration-300 opacity-80 overflow-hidden"
                    onClick={() => setIsConditionSelectionUnlocked(true)}
                  >
                    {/* Background condition squares with 30% opacity */}
                    <div className="absolute inset-0 p-4 opacity-30">
                      <div className="grid grid-cols-2 gap-2 h-full">
                        {conditionTypes.map((condition) => {
                          const Icon = condition.icon
                          return (
                            <div
                              key={condition.id}
                              className="aspect-square border border-border/30 rounded-lg bg-muted/20 flex flex-col items-center justify-center p-2"
                            >
                              <div className="p-1 rounded bg-muted/40 mb-1">
                                <Icon className="w-4 h-4 text-muted-foreground" />
                              </div>
                              <h4 className="text-xs font-medium text-foreground text-center leading-tight">{condition.name}</h4>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    
                    {/* Centered "Add Condition" content */}
                    <div className="relative z-10 flex items-center justify-center h-full min-h-[400px] p-6">
                      <div className="text-center space-y-4 bg-background/80 rounded-lg p-6 backdrop-blur-sm">
                        <div className="w-12 h-12 bg-primary/8 rounded-full flex items-center justify-center mx-auto">
                          <Target className="w-6 h-6 text-primary opacity-80" />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-foreground opacity-80">Add Condition</h3>
                          <p className="text-xs text-muted-foreground mt-1 opacity-70">Choose your trading trigger</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}




            </div>

            {/* Navigation Buttons */}
            <div className="mt-6 flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep(1)} className="border-border/50 cursor-pointer">
                Back
              </Button>
              
              {/* Continue Button - Only appears when condition is selected AND tokens are properly prepared AND swap UI is complete */}
              {conditionType && (
                <Button 
                  onClick={() => setCurrentStep(4)} 
                  disabled={
                    !fromToken || 
                    toTokens.length === 0 || 
                    !isInputValid || 
                    !isOutputValid || 
                    (selectedPlatform === 'hyperevm' && isBalanceInsufficient) || 
                    !isValidTotalPercentage ||
                    // Token preparation requirements (same as instant swap)
                    (fromToken?.symbol === 'HYPE' && !isHypeWrapped) ||
                    (fromToken?.symbol === 'WHYPE' && !isWhypeApproved) ||
                    (fromToken?.symbol !== 'HYPE' && fromToken?.symbol !== 'WHYPE' && !isTokenApproved)
                  }
                  className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg cursor-pointer"
                >
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
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
          <div className="max-w-7xl mx-auto px-2">
            {/* Header with Market Info */}
            <div className="bg-card border border-border/50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-xl font-bold text-foreground">HYPE-USDT</span>
                    <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <span>Mark: 4,344.8</span>
                    <span className="mx-2">•</span>
                    <span>Oracle: 4,350.5</span>
                  </div>
                </div>
                <div className="flex items-center space-x-6 text-sm">
                  <div>
                    <div className="text-teal-500">+178.9 / +4.29%</div>
                    <div className="text-muted-foreground">24h Change</div>
                  </div>
                  <div>
                    <div className="text-foreground">$1,721,696.97</div>
                    <div className="text-muted-foreground">24h Volume</div>
                  </div>
                  <div>
                    <div className="text-foreground">$5,113,217.48</div>
                    <div className="text-muted-foreground">Open Interest</div>
                  </div>
                  <div>
                    <div className="text-red-500">-0.0059% 00:13:26</div>
                    <div className="text-muted-foreground">Funding / Countdown</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Chart Section - Takes up 4/5 of the space */}
              <div className="lg:col-span-4">
                <Card className="border-border/50 shadow-lg">
                  <CardContent className="p-0">


                    {/* TradingView Chart */}
                    <div className="relative">
                                              <div id="hypercore_tradingview_chart" style={{ width: '100%', height: '600px' }}></div>
                      
                      {/* Liquidation Price Line */}
                      <div className="absolute left-0 right-0 top-1/2 transform -translate-y-1/2 pointer-events-none">
                        <div className="border-t-2 border-dashed border-red-500/50"></div>
                        <div className="absolute left-4 top-0 transform -translate-y-1/2 bg-red-500 text-white text-xs px-2 py-1 rounded">
                          Liq. Price 4,108.6
                        </div>
                      </div>

                      {/* PNL Overlay */}
                      <div className="absolute top-20 left-20 bg-black/80 text-white text-xs p-2 rounded">
                        <div>PNL $0.15</div>
                        <div>0.0043</div>
                      </div>
              </div>
            </CardContent>
          </Card>
              </div>

              {/* Trading Panel - Takes up 1/5 of the space */}
              <div className="lg:col-span-1">
                <Card className="border-border/50 shadow-lg h-full">
                  <CardContent className="p-4 space-y-4">
                    {/* Leverage Selector */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">Leverage</span>
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={() => setShowLeverageModal(true)}
                          className="px-2 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                          {leverage}x
                        </button>
                      </div>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Available (Core): {loadingCoreAccount ? 'Loading…' : (typeof coreAccount?.availableBalance === 'number' ? `$${coreAccount.availableBalance.toFixed(2)}` : '—')}
                    </div>

                    {/* Order Type Selector */}
                    <div className="flex bg-muted rounded-lg p-0.5">
                      <button
                        onClick={() => setOrderType("market")}
                        className={`flex-1 px-2 py-1 text-xs font-medium rounded-md transition-all duration-200 ${
                          orderType === "market"
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent"
                        }`}
                      >
                        Market
                      </button>
                      <button
                        onClick={() => setOrderType("limit")}
                        className={`flex-1 px-2 py-1 text-xs font-medium rounded-md transition-all duration-200 ${
                          orderType === "limit"
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent"
                        }`}
                      >
                        Limit
                      </button>
                    </div>

                    {/* Buy/Sell Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <button className="px-3 py-2 text-xs font-medium rounded bg-teal-600 text-white hover:bg-teal-700 transition-colors">
                        Buy / Long
                      </button>
                      <button className="px-3 py-2 text-xs font-medium rounded bg-red-600 text-white hover:bg-red-700 transition-colors">
                        Sell / Short
                      </button>
                    </div>

                    {/* Size Input */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-foreground">Size</label>
                      <div className="flex items-center space-x-1">
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="0.0043"
                          className="flex-1 text-xs h-8"
                          value={positionSize.toString()}
                          onChange={(e) => {
                            const cleaned = e.target.value.replace(/[^0-9.]/g, '')
                            const parts = cleaned.split('.')
                            const normalized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned
                            const num = parseFloat(normalized)
                            if (isNaN(num)) {
                              setPositionSize(0)
                            } else {
                              setPositionSize(num)
                            }
                          }}
                        />
                        <div className="flex items-center space-x-1 px-2 py-1 bg-muted rounded text-xs">
                          <span className="font-medium">HYPE</span>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                      
                      {/* Quick Size Actions */}
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPositionSize(50)}
                            className="text-xs bg-transparent border border-gray-700 hover:bg-green-700 hover:border-green-700 hover:text-white cursor-pointer"
                          >
                            50%
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPositionSize(100)}
                            className="text-xs bg-transparent border border-gray-700 hover:bg-green-700 hover:border-green-700 hover:text-white cursor-pointer"
                          >
                            100%
                </Button>
                        </div>
                        <div className="text-xs text-muted-foreground">{positionSize}%</div>
                      </div>
                    </div>

                    {/* Take Profit / Stop Loss */}
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <input 
                          type="checkbox" 
                          id="tp-sl" 
                          className="rounded" 
                          checked={showTpSl}
                          onChange={(e) => setShowTpSl(e.target.checked)}
                        />
                        <label htmlFor="tp-sl" className="text-sm text-foreground">Take Profit / Stop Loss</label>
                      </div>
                      
                      {/* TP/SL Form */}
                      {showTpSl && (
                        <div className="space-y-2 p-2 border border-border/50 rounded-lg bg-muted/20">
                          {/* TP Price */}
                          <div className="grid grid-cols-2 gap-1">
                            <div>
                              <label className="text-xs text-muted-foreground">TP Price</label>
                              <Input
                                type="number"
                                placeholder="TP Price"
                                value={tpPrice}
                                onChange={(e) => setTpPrice(e.target.value)}
                                className="text-xs h-6"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Gain</label>
                              <div className="flex">
                                <Input
                                  type="number"
                                  placeholder="Gain"
                                  className="text-xs h-6 rounded-r-none"
                                />
                                <button
                                  onClick={() => setGainType(gainType === "%" ? "$" : "%")}
                                  className="px-1 h-6 text-xs bg-muted border border-l-0 border-border/50 rounded-r text-muted-foreground hover:bg-accent"
                                >
                                  {gainType}
                                </button>
                              </div>
                            </div>
                          </div>
                          
                          {/* SL Price */}
                          <div className="grid grid-cols-2 gap-1">
                            <div>
                              <label className="text-xs text-muted-foreground">SL Price</label>
                              <Input
                                type="number"
                                placeholder="SL Price"
                                value={slPrice}
                                onChange={(e) => setSlPrice(e.target.value)}
                                className="text-xs h-6"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Loss</label>
                              <div className="flex">
                                <Input
                                  type="number"
                                  placeholder="Loss"
                                  className="text-xs h-6 rounded-r-none"
                                />
                                <button
                                  onClick={() => setLossType(lossType === "%" ? "$" : "%")}
                                  className="px-1 h-6 text-xs bg-muted border border-l-0 border-border/50 rounded-r text-muted-foreground hover:bg-accent"
                                >
                                  {lossType}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Button */}
                    <button className="w-full px-3 py-2 text-xs font-medium rounded bg-muted text-muted-foreground cursor-not-allowed">
                      Not Enough Margin
                    </button>

                    {/* Order Details */}
                    <div className="space-y-2 pt-3 border-t border-border/50">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Liquidation Price</span>
                        <span className="text-foreground">4,211.9</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Order Value</span>
                        <span className="text-foreground">$18.67</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Margin Required</span>
                        <span className="text-foreground">$0.93</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Slippage</span>
                        <span className="text-foreground text-right">Est: 0.0173%<br />Max: 20.00%</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Fees</span>
                        <span className="text-foreground">0.0450% / 0.0150%</span>
                      </div>
              </div>
            </CardContent>
          </Card>
              </div>
            </div>

            {/* Back Button */}
            <div className="flex justify-start mt-6">
              <Button variant="outline" onClick={() => setCurrentStep(2)} className="border-border/50 cursor-pointer">
                Back
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Configure Condition */}
        {currentStep === 4 && (
          <Card className="max-w-7xl mx-auto border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="text-foreground">Configure Condition</CardTitle>
              <CardDescription>
                Set up the specific parameters for your condition  
                {/* {conditionTypes.find((c) => c.id === conditionType)?.name.toLowerCase()} */}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {conditionType === "ohlcv_trigger" && (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                  {/* Left Column: Configuration Settings (2/5 = 40%) */}
                  <div className="space-y-4 lg:col-span-2">
                    {/* Trigger Token Section */}
                    <div className="pb-3 border-b border-dotted border-border/40">
                      <div className="flex items-center justify-between">
                        <Label className="text-foreground font-semibold">Pair</Label>
                        <Select value={triggerToken} onValueChange={setTriggerToken}>
                          <SelectTrigger className="w-1/2 border-border/50 focus:ring-primary/20 cursor-pointer">
                            <SelectValue placeholder="HYPE-USDC" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectLabel>SPOT</SelectLabel>
                            {/* Core tokens */}
                            {tokens
                              .filter(token => ['HYPE', 'USOL', 'UBTC', 'UETH'].includes(token.symbol))
                              .map((token) => (
                                <SelectItem key={`spot-${token.symbol}`} value={`${token.symbol}/USDC`} className="cursor-pointer">
                                  <div className="flex items-center space-x-2">
                                    <img src={token.icon} alt={token.symbol} className="w-5 h-5 rounded-full" />
                                    <span>{token.symbol}/USDC - {token.name}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            {/* Additional spot tokens */}
                            {[
                              { symbol: 'PUMP', name: 'Pump Fun' , icon: 'https://app.hyperliquid.xyz/coins/PUMP_USDC.svg'},



                                                          ].map((token) => (
                                <SelectItem key={`spot-${token.symbol}`} value={`${token.symbol}/USDC`} className="cursor-pointer">
                                  <div className="flex items-center space-x-2">
                                    {token.icon ? (
                                      <img src={token.icon} alt={token.symbol} className="w-5 h-5 rounded-full" />
                                    ) : (
                                      <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                                        {token.symbol.charAt(0)}
                                      </div>
                                    )}
                                    <span>{token.symbol}/USDC - {token.name}</span>
                                  </div>
                                </SelectItem>
                              ))}
                          </SelectGroup>
                          <SelectSeparator />
                          <SelectGroup>
                            <SelectLabel>Perps</SelectLabel>
                            {/* Core perps with regular naming */}
                            {[
                              { symbol: 'HYPE', name: 'Hyperliquid' },
                              { symbol: 'ETH', name: 'Ethereum' },
                              { symbol: 'BTC', name: 'Bitcoin' },
                              { symbol: 'SOL', name: 'Solana' }
                            ].map((token) => (
                              <SelectItem key={`perp-${token.symbol}`} value={`${token.symbol}-USDC`} className="cursor-pointer">
                                <div className="flex items-center space-x-2">
                                  <img src={tokens.find(t => t.symbol === `U${token.symbol}` || t.symbol === token.symbol)?.icon || '/coins-logos/unknown.jpg'} alt={token.symbol} className="w-5 h-5 rounded-full" />
                                  <span>{token.symbol}-USDC - {token.name}</span>
                                </div>
                              </SelectItem>
                            ))}
                            {/* Additional perps */}
                            {[
                              { symbol: 'PUMP', name: 'PumpFun' , icon: 'https://app.hyperliquid.xyz/coins/PUMP_USDC.svg'},


                              { symbol: 'FARTCOIN', name: 'Fartcoin' , icon: 'https://app.hyperliquid.xyz/coins/FARTCOIN_USDC.svg'},
                              { symbol: 'XRP', name: 'XRP' , icon: 'https://app.hyperliquid.xyz/coins/XRP.svg'},

                              { symbol: 'ENA', name: 'ENA' , icon: 'https://app.hyperliquid.xyz/coins/ENA.svg'}
                                                          ].map((token) => (
                                <SelectItem key={`perp-${token.symbol}`} value={`${token.symbol}-USDC`} className="cursor-pointer">
                                  <div className="flex items-center space-x-2">
                                    {token.icon ? (
                                      <img src={token.icon} alt={token.symbol} className="w-5 h-5 rounded-full" />
                                    ) : (
                                      <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                                        {token.symbol.charAt(0)}
                                      </div>
                                    )}
                                    <span>{token.symbol}-USDC - {token.name}</span>
                                  </div>
                                </SelectItem>
                              ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                    </div>

                    {/* Timeframe Section */}
                    <div className="pb-3 border-b border-dotted border-border/40">
                      <div className="flex items-center justify-between">
                        <Label className="text-foreground font-semibold">Timeframe</Label>
                        <div className="flex gap-2">
                          {[
                            { value: "1m", label: "1m" },
                            { value: "5m", label: "5m" },
                            { value: "15m", label: "15m" },
                            { value: "1h", label: "1h" },
                            { value: "4h", label: "4h" },
                            { value: "1d", label: "1d" },
                            { value: "1w", label: "1w" }
                          ].map((tf) => (
                            <button
                              key={tf.value}
                              onClick={() => setTimeframe(tf.value)}
                              className={`px-3 py-2 text-xs font-medium rounded-md transition-all duration-200 cursor-pointer ${
                                timeframe === tf.value
                                  ? "bg-primary text-primary-foreground shadow-sm"
                                  : "bg-muted/50 text-muted-foreground hover:bg-primary/20 hover:text-primary border border-border/50"
                              }`}
                            >
                              {tf.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Source Section */}
                    <div className="pb-3 border-b border-dotted border-border/40">
                      <div className="space-y-3">
                        <Label className="text-foreground font-semibold">Source</Label>
                        {/* Two dropdown menus: OHLCV and Indicators */}
                        <div className="grid grid-cols-2 gap-4">
                          {/* OHLCV Dropdown */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                            <button
                                  className={`flex items-center justify-center gap-2 rounded-xl border h-16 w-full px-3 text-sm font-medium transition-colors ${
                                    firstSourceType === "ohlcv"
                                      ? "bg-primary text-primary-foreground border-primary/50"
                                      : "bg-muted/50 text-muted-foreground hover:bg-primary/20 hover:text-primary border-border/50"
                                  }`}
                                >
                                  <img src="/ohlcv.png" alt="logo" className="w-12 h-12" />
                                  <span>OHLCV</span>
                            </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="min-w-[14rem]">
                              {["open","high","low","close","volume"].map((src) => (
                                <DropdownMenuItem key={`candles-${src}`} onClick={() => {
                                  setSource(src);
                                  setFirstSourceType("ohlcv");
                                }}>
                                  <img src="/ohlcv.png" alt="logo" className="w-4 h-4" />
                                  {src.charAt(0).toUpperCase() + src.slice(1)}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>

                          {/* Indicators Dropdown */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                                              <button
                                  className={`flex items-center justify-center gap-2 rounded-xl border h-16 w-full px-3 text-sm font-medium transition-colors ${
                                    firstSourceType === "indicators"
                                      ? "bg-primary text-primary-foreground border-primary/50"
                                      : "bg-muted/50 text-muted-foreground hover:bg-primary/20 hover:text-primary border-border/50"
                                  }`}
                                >
                                  <img src="/indicators.png" alt="logo" className="w-12 h-12" />
                                  <span>Indicators</span>
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="min-w-[14rem]">
                                                              {[
                                  { key: "sma", label: "SMA" },
                                  { key: "ema", label: "EMA" },
                                  { key: "rsi", label: "RSI" },
                                  { key: "bb_lower", label: "BB.lower" },
                                  { key: "bb_mid", label: "BB.mid" },
                                  { key: "bb_upper", label: "BB.upper" },
                                ].map((ind) => (
                                <DropdownMenuItem
                                  key={`ind-${ind.key}`}
                                  className="flex items-center justify-between gap-2"
                                  onSelect={() => {
                                    setSource(ind.key);
                                    setFirstSourceType("indicators");
                                    // Recreate widget with chosen study (TradingView's public tv.js lacks createStudy in v2)
                                    const length = (() => {
                                      if (ind.key === 'sma') return indicatorParams.sma_length;
                                      if (ind.key === 'ema') return indicatorParams.ema_length;
                                      if (ind.key === 'rsi') return indicatorParams.rsi_length;
                                      if (ind.key?.startsWith('bb_')) return indicatorParams.bb_length;
                                      return 14;
                                    })();
                                    
                                    const studyMap: any = {
                                      sma: { 
                                        id: 'MASimple@tv-basicstudies', 
                                        inputs: { 
                                          length,
                                          source: indicatorParams.sma_source || 'close'
                                        } 
                                      },
                                      ema: { 
                                        id: 'MAExp@tv-basicstudies',
                                        "version": 60, 
                                        inputs: { 
                                          length,
                                          source: indicatorParams.ema_source || 'close'
                                        } 
                                      },
                                      rsi: { 
                                        id: 'RSI@tv-basicstudies', 
                                        inputs: { 
                                          length,
                                          source: indicatorParams.rsi_source || 'close'
                                        } 
                                      },
                                      bb_lower: { 
                                        id: 'BB@tv-basicstudies', 
                                        inputs: { 
                                          length: indicatorParams.bb_length || 20, 
                                          std: indicatorParams.bb_std || 2, 
                                          source: 'lower'
                                        } 
                                      },
                                      bb_mid: { 
                                        id: 'BB@tv-basicstudies', 
                                        inputs: { 
                                          length: indicatorParams.bb_length || 20, 
                                          std: indicatorParams.bb_std || 2, 
                                          source: 'basis'
                                        } 
                                      },
                                      bb_upper: { 
                                        id: 'BB@tv-basicstudies', 
                                        inputs: { 
                                          length: indicatorParams.bb_length || 20, 
                                          std: indicatorParams.bb_std || 2, 
                                          source: 'upper'
                                        } 
                                      },
                                    };
                                    const selected = studyMap[ind.key];
                                    const container = 'ohlcv_tradingview_chart';
                                    const currentSymbol = (() => {
                                      try {
                                        return tvWidgetRef.current?.activeChart?.().symbol?.() || tvWidgetRef.current?.symbol?.();
                                      } catch { return undefined; }
                                    })();
                                    const getIntervalSafe = (tf: string) => {
                                      const map: any = { '1m':'1','5m':'5','15m':'15','1h':'60','4h':'240','12h':'720','1d':'1D','1w':'1W' };
                                      return map[tf] || '60';
                                    }
                                    const currentInterval = (() => {
                                      try {
                                        return tvWidgetRef.current?.activeChart?.().resolution?.() || getIntervalSafe(timeframe || '1h');
                                      } catch { return getIntervalSafe(timeframe || '1h'); }
                                    })();
                                    // re-init widget with same symbol/interval and selected study
                                    const containerEl = document.getElementById(container);
                                    if (containerEl) containerEl.innerHTML = '';
                                    new (window as any).TradingView.widget({
                                      autosize: true,
                                      symbol: currentSymbol || (()=>{ const isSpot=(triggerToken||'').includes('/USDC'); const isPerp=(triggerToken||'').includes('-USDC'); const base=isSpot?(triggerToken||'HYPE').split('/')[0]:isPerp?(triggerToken||'HYPE').split('-')[0]:(triggerToken||'HYPE'); const perps:{[k:string]:string}={HYPE:'BYBIT:HYPEUSDT.P',UETH:'BYBIT:ETHUSD.P',UBTC:'BYBIT:BTCUSD.P',USOL:'BYBIT:SOLUSD.P',UFART:'BYBIT:FARTCOINUSDT.P'}; const spot:{[k:string]:string}={HYPE:'BYBIT:HYPEUSDT',UETH:'BYBIT:ETHUSDT',UBTC:'BYBIT:BTCUSDT',USOL:'BYBIT:SOLUSDT',JEF:'BYBIT:JEFUSDT'}; if(isPerp){return perps[base]||`BYBIT:${base}USDT.P`;} if(isSpot){return spot[base]||`BYBIT:${base}USDT`;} return perps[base]||spot[base]||`BYBIT:${base}USDT`; })(),
                                      interval: currentInterval,
                                      timezone: 'Etc/UTC',
                                      theme: (resolvedTheme === 'light') ? 'light' : 'dark',
                                      style: '1',
                                      locale: 'en',
                                      toolbar_bg: (resolvedTheme === 'light') ? '#ffffff' : '#0b0b0b',
                                      enable_publishing: false,
                                      allow_symbol_change: true,
                                      container_id: container,
                                      width: '100%',
                                      height: '500',
                                      studies: selected ? [selected] : []
                                    });
                                  }}
                                >
                                  <span className="flex items-center gap-2">
                                    <img src="/indicators.png" alt="logo" className="w-4 h-4" />
                                    {ind.label}
                                  </span>
                                  <button
                                    className="p-1 rounded-md hover:bg-accent cursor-pointer"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpenParamFor(ind.key); }}
                                  >
                                    <img src="/settings.png" alt="settings" className="w-4 h-4" />
                                  </button>
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>



                    {/* Indicator Settings Dialog */}
                    <Dialog open={openParamFor !== null} onOpenChange={(open) => setOpenParamFor(open ? openParamFor : null)}>
                      <DialogContent className="sm:max-w-sm">
                        <DialogHeader>
                          <DialogTitle>{openParamFor ? openParamFor.toUpperCase() + ' Settings' : 'Settings'}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3">
                          {/* Length parameter for all indicators */}
                          <label className="text-sm">Length</label>
                          <input
                            type="number"
                            min={1}
                            className="w-full px-3 py-2 rounded-md border bg-background"
                            value={(() => {
                              if (openParamFor?.startsWith('bb_')) return indicatorParams.bb_length;
                              if (openParamFor === 'sma') return indicatorParams.sma_length;
                              if (openParamFor === 'ema') return indicatorParams.ema_length;
                              if (openParamFor === 'rsi') return indicatorParams.rsi_length;
                              return 14;
                            })()}
                            onChange={(e) => {
                              const newValue = Number(e.target.value);
                              if (openParamFor?.startsWith('bb_')) {
                                setIndicatorParams(prev => ({ ...prev, bb_length: newValue }));
                              } else if (openParamFor === 'sma') {
                                setIndicatorParams(prev => ({ ...prev, sma_length: newValue }));
                              } else if (openParamFor === 'ema') {
                                setIndicatorParams(prev => ({ ...prev, ema_length: newValue }));
                              } else if (openParamFor === 'rsi') {
                                setIndicatorParams(prev => ({ ...prev, rsi_length: newValue }));
                              }
                            }}
                          />
                          
                          {/* OHLC Source parameter for SMA, EMA, RSI */}
                          {(openParamFor === 'sma' || openParamFor === 'ema' || openParamFor === 'rsi') && (
                            <>
                              <label className="text-sm">OHLC Source</label>
                              <Select 
                                value={(() => {
                                  if (openParamFor === 'sma') return String(indicatorParams.sma_source);
                                  if (openParamFor === 'ema') return String(indicatorParams.ema_source);
                                  if (openParamFor === 'rsi') return String(indicatorParams.rsi_source);
                                  return 'close';
                                })()}
                                onValueChange={(value) => {
                                  if (openParamFor === 'sma') {
                                    setIndicatorParams(prev => ({ ...prev, sma_source: value }));
                                  } else if (openParamFor === 'ema') {
                                    setIndicatorParams(prev => ({ ...prev, ema_source: value }));
                                  } else if (openParamFor === 'rsi') {
                                    setIndicatorParams(prev => ({ ...prev, rsi_source: value }));
                                  }
                                }}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select OHLC Source" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="open">Open</SelectItem>
                                  <SelectItem value="high">High</SelectItem>
                                  <SelectItem value="low">Low</SelectItem>
                                  <SelectItem value="close">Close</SelectItem>
                                  <SelectItem value="hl2">(High + Low) / 2</SelectItem>
                                  <SelectItem value="hlc3">(High + Low + Close) / 3</SelectItem>
                                  <SelectItem value="ohlc4">(Open + High + Low + Close) / 4</SelectItem>
                                </SelectContent>
                              </Select>
                            </>
                          )}
                          
                          {/* Bollinger Bands specific parameters */}
                          {openParamFor?.startsWith('bb_') && (
                            <>
                              <label className="text-sm">OHLC Source</label>
                              <Select 
                                value={String(indicatorParams.bb_source)}
                                onValueChange={(value) => {
                                  setIndicatorParams(prev => ({ ...prev, bb_source: value }));
                                }}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select OHLC Source" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="open">Open</SelectItem>
                                  <SelectItem value="high">High</SelectItem>
                                  <SelectItem value="low">Low</SelectItem>
                                  <SelectItem value="close">Close</SelectItem>
                                  <SelectItem value="hl2">(High + Low) / 2</SelectItem>
                                  <SelectItem value="hlc3">(High + Low + Close) / 3</SelectItem>
                                  <SelectItem value="ohlc4">(Open + High + Low + Close) / 4</SelectItem>
                                </SelectContent>
                              </Select>
                              
                              <label className="text-sm">Standard Deviation</label>
                              <input
                                type="number"
                                min={0.1}
                                step={0.1}
                                className="w-full px-3 py-2 rounded-md border bg-background"
                                value={indicatorParams.bb_std}
                                onChange={(e) => {
                                  const newValue = Number(e.target.value);
                                  setIndicatorParams(prev => ({ ...prev, bb_std: newValue }));
                                }}
                              />
                            </>
                          )}
                          
                          <div className="text-xs text-muted-foreground">
                            {openParamFor?.startsWith('bb_') 
                              ? `Configure Bollinger Bands with ${indicatorParams.bb_source} source.`
                              : `Configure ${openParamFor?.toUpperCase()} with ${(() => {
                                  if (openParamFor === 'sma') return indicatorParams.sma_source;
                                  if (openParamFor === 'ema') return indicatorParams.ema_source;
                                  if (openParamFor === 'rsi') return indicatorParams.rsi_source;
                                  return 'close';
                                })()} source.`
                            }
                          </div>
                          
                          <div className="flex gap-2 pt-2">
                            <Button 
                              variant="outline" 
                              onClick={() => setOpenParamFor(null)}
                              className="flex-1"
                            >
                              Cancel
                            </Button>
                            <Button 
                              onClick={() => {
                                // Update chart with new parameters if this indicator is currently active
                                if (openParamFor && source === openParamFor) {
                                  const length = (() => {
                                    if (openParamFor?.startsWith('bb_')) return indicatorParams.bb_length;
                                    if (openParamFor === 'sma') return indicatorParams.sma_length;
                                    if (openParamFor === 'ema') return indicatorParams.ema_length;
                                    if (openParamFor === 'rsi') return indicatorParams.rsi_length;
                                    return 14;
                                  })();
                                  
                                  const studyMap: any = {
                                    sma: { 
                                      id: 'MASimple@tv-basicstudies', 
                                      inputs: { 
                                        length,
                                        source: indicatorParams.sma_source || 'close'
                                      } 
                                    },
                                    ema: { 
                                      id: 'MAExp@tv-basicstudies', 
                                      "version": 60, 
                                      inputs: { 
                                        length,
                                        source: indicatorParams.ema_source || 'close'
                                      } 
                                    },
                                    rsi: { 
                                      id: 'RSI@tv-basicstudies', 
                                      inputs: { 
                                        length,
                                        source: indicatorParams.rsi_source || 'close'
                                      } 
                                    },
                                    bb_lower: { 
                                      id: 'BB@tv-basicstudies', 
                                      inputs: { 
                                        length: indicatorParams.bb_length || 20, 
                                        std: indicatorParams.bb_std || 2, 
                                        source: 'lower'
                                      } 
                                    },
                                    bb_mid: { 
                                      id: 'BB@tv-basicstudies', 
                                      inputs: { 
                                        length: indicatorParams.bb_length || 20, 
                                        std: indicatorParams.bb_std || 2, 
                                        source: 'basis'
                                      } 
                                    },
                                    bb_upper: { 
                                      id: 'BB@tv-basicstudies', 
                                      inputs: { 
                                        length: indicatorParams.bb_length || 20, 
                                        std: indicatorParams.bb_std || 2, 
                                        source: 'upper'
                                      } 
                                    },
                                  };
                                  
                                  const selected = studyMap[openParamFor];
                                  if (selected) {
                                    const container = 'ohlcv_tradingview_chart';
                                    const currentSymbol = (() => {
                                      try {
                                        return tvWidgetRef.current?.activeChart?.().symbol?.() || tvWidgetRef.current?.symbol?.();
                                      } catch { return undefined; }
                                    })();
                                    const getIntervalSafe = (tf: string) => {
                                      const map: any = { '1m':'1','5m':'5','15m':'15','1h':'60','4h':'240','12h':'720','1d':'1D','1w':'1W' };
                                      return map[tf] || '60';
                                    }
                                    const currentInterval = (() => {
                                      try {
                                        return tvWidgetRef.current?.activeChart?.().resolution?.() || getIntervalSafe(timeframe || '1h');
                                      } catch { return getIntervalSafe(timeframe || '1h'); }
                                    })();
                                    // re-init widget with same symbol/interval and updated study
                                    const containerEl = document.getElementById(container);
                                    if (containerEl) containerEl.innerHTML = '';
                                    new (window as any).TradingView.widget({
                                      autosize: true,
                                      symbol: currentSymbol || (()=>{ const isSpot=(triggerToken||'').includes('/USDC'); const isPerp=(triggerToken||'').includes('-USDC'); const base=isSpot?(triggerToken||'HYPE').split('/')[0]:isPerp?(triggerToken||'HYPE').split('-')[0]:(triggerToken||'HYPE'); const perps:{[k:string]:string}={HYPE:'BYBIT:HYPEUSDT.P',UETH:'BYBIT:ETHUSD.P',UBTC:'BYBIT:BTCUSD.P',USOL:'BYBIT:SOLUSD.P',UFART:'BYBIT:FARTCOINUSDT.P'}; const spot:{[k:string]:string}={HYPE:'BYBIT:HYPEUSDT',UETH:'BYBIT:ETHUSDT',UBTC:'BYBIT:BTCUSDT',USOL:'BYBIT:SOLUSDT',JEF:'BYBIT:JEFUSDT'}; if(isPerp){return perps[base]||`BYBIT:${base}USDT.P`;} if(isSpot){return spot[base]||`BYBIT:${base}USDT`;} return perps[base]||spot[base]||`BYBIT:${base}USDT`; })(),
                                      interval: currentInterval,
                                      timezone: 'Etc/UTC',
                                      theme: (resolvedTheme === 'light') ? 'light' : 'dark',
                                      style: '1',
                                      locale: 'en',
                                      toolbar_bg: (resolvedTheme === 'light') ? '#ffffff' : '#0b0b0b',
                                      enable_publishing: false,
                                      allow_symbol_change: true,
                                      container_id: container,
                                      width: '100%',
                                      height: '500',
                                      studies: [selected]
                                    });
                                  }
                                }
                                setOpenParamFor(null); // Close dialog after applying changes
                              }}
                              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                            >
                              Confirm
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

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

                    {/* Second Source Section */}
                    <div className="pb-3 border-b border-dotted border-border/40">
                      <div className="space-y-3">
                        <Label className="text-foreground font-semibold">Second Source</Label>
                        <div className={`grid gap-4 ${["volume", "rsi"].includes(source) ? "grid-cols-1" : "grid-cols-2"}`}>
                          {/* Value Button - Transforms to input field */}
                          <div className={`space-y-2 ${["volume", "rsi"].includes(source) ? "col-span-1" : ""}`}>
                            {!showValueInput ? (
                              <button
                                className={`flex items-center justify-center gap-2 rounded-xl border h-16 w-full px-3 text-sm font-medium transition-colors ${
                                  secondSourceType === "value"
                                    ? "bg-primary text-primary-foreground border-primary/50"
                                    : "bg-muted/50 text-muted-foreground hover:bg-primary/20 hover:text-primary border-border/50"
                                }`}
                                onClick={() => {
                                  setShowValueInput(true);
                                  setSecondSourceType("value");
                                }}
                              >
                                <span>{secondSourceValue ? secondSourceValue : "Value"}</span>
                              </button>
                            ) : (
                              <div className="flex items-center justify-center gap-2 rounded-xl border h-16 w-full px-3 text-sm font-medium bg-background border-primary/50">
                                <Input
                                  type="number"
                                  placeholder="Enter value"
                                  className="w-20 h-8 text-center border-0 bg-transparent focus:ring-0 focus:border-0 p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  value={secondSourceValue}
                                  onChange={(e) => setSecondSourceValue(e.target.value)}
                                  onBlur={() => setShowValueInput(false)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      setShowValueInput(false);
                                    }
                                  }}
                                  autoFocus
                                />
                                <button
                                  onClick={() => setShowValueInput(false)}
                                  className="text-muted-foreground hover:text-foreground p-1"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Indicators Button - Hidden when Source One is Volume or RSI */}
                          {!["volume", "rsi"].includes(source) && (
                            <div className="space-y-2">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    className={`flex items-center justify-center gap-2 rounded-xl border h-16 w-full px-3 text-sm font-medium transition-colors ${
                                      secondSourceType === "indicators"
                                        ? "bg-primary text-primary-foreground border-primary/50"
                                        : "bg-muted/50 text-muted-foreground hover:bg-primary/20 hover:text-primary border-border/50"
                                    }`}
                                  >
                                    <img src="/indicators.png" alt="logo" className="w-12 h-12" />
                                    <span>Indicators</span>
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="min-w-[14rem]">
                                  {(() => {
                                    // Different indicator options based on Source One selection
                                    if (["sma", "ema"].includes(source)) {
                                      // If SMA/EMA is selected, allow EMA, SMA, BB.lower, BB.upper
                                      return [
                                        { key: "sma", label: "SMA" },
                                        { key: "ema", label: "EMA" },
                                        { key: "bb_lower", label: "BB.lower" },
                                        { key: "bb_upper", label: "BB.upper" },
                                      ];
                                    } else if (["bb_lower", "bb_mid", "bb_upper"].includes(source)) {
                                      // If BB components are selected, allow only SMA, EMA
                                      return [
                                        { key: "sma", label: "SMA" },
                                        { key: "ema", label: "EMA" },
                                      ];
                                    } else if (["open", "high", "low", "close", "volume"].includes(source)) {
                                      // If OHLCV is selected, show all indicators
                                      return [
                                        { key: "sma", label: "SMA" },
                                        { key: "ema", label: "EMA" },
                                        { key: "bb_lower", label: "BB.lower" },
                                        { key: "bb_mid", label: "BB.mid" },
                                        { key: "bb_upper", label: "BB.upper" },
                                      ];
                                    } else {
                                      // Default: show all indicators (for candlestick selections)
                                      return [
                                        { key: "sma", label: "SMA" },
                                        { key: "ema", label: "EMA" },
                                        { key: "bb_lower", label: "BB.lower" },
                                        { key: "bb_mid", label: "BB.mid" },
                                        { key: "bb_upper", label: "BB.upper" },
                                      ];
                                    }
                                  })().map((ind) => (
                                    <DropdownMenuItem
                                      key={`ind-${ind.key}`}
                                      className="flex items-center justify-between gap-2"
                                      onSelect={() => {
                                        setSource(ind.key);
                                        setSecondSourceType("indicators");
                                        // Clear value when selecting indicators
                                        setSecondSourceValue("");
                                        setShowValueInput(false);
                                        // No chart reloading - just set the condition
                                      }}
                                    >
                                      <span className="flex items-center gap-2">
                                        <img src="/indicators.png" alt="logo" className="w-4 h-4" />
                                        {ind.label}
                                      </span>
                                      <button
                                        className="p-1 rounded-md hover:bg-accent cursor-pointer"
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpenParamFor(ind.key); }}
                                      >
                                        <img src="/settings.png" alt="settings" className="w-4 h-4" />
                                      </button>
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Cooldown Section */}
                    <div className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            onClick={() => setCooldownActive(!cooldownActive)}
                            className={`w-4 h-4 rounded-full border-2 cursor-pointer transition-all duration-200 ${
                              cooldownActive
                                ? "bg-primary border-primary"
                                : "bg-transparent border-muted-foreground/30 hover:border-primary/50"
                            }`}
                          />
                          <Label className={`font-semibold transition-colors ${cooldownActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                            Trigger Delay
                          </Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="w-4 h-4 rounded-full bg-muted-foreground/20 flex items-center justify-center cursor-help">
                                <span className="text-xs text-muted-foreground">?</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Wait {cooldownValue || 'n'} bars after condition is true before executing swap.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Input
                          placeholder="Enter value"
                          className={`w-32 border-border/50 focus:ring-primary/20 transition-all ${
                            cooldownActive 
                              ? 'bg-background text-foreground' 
                              : 'bg-muted/50 text-muted-foreground cursor-not-allowed'
                          }`}
                          value={cooldownValue}
                          onChange={(e) => setCooldownValue(e.target.value)}
                          disabled={!cooldownActive}
                        />
                      </div>
                    </div>

                    {/* Chained Confirmation Section */}
                    <div className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            onClick={() => setChainedConfirmation(!chainedConfirmation)}
                            className={`w-4 h-4 rounded-full border-2 cursor-pointer transition-all duration-200 ${
                              chainedConfirmation
                                ? "bg-primary border-primary"
                                : "bg-transparent border-muted-foreground/30 hover:border-primary/50"
                            }`}
                          />
                          <Label className={`font-semibold transition-colors ${chainedConfirmation ? 'text-foreground' : 'text-muted-foreground'}`}>
                            Chained confirmation
                          </Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="w-4 h-4 rounded-full bg-muted-foreground/20 flex items-center justify-center cursor-help">
                                <span className="text-xs text-muted-foreground">?</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>If set, execute swap only if condition was true AND the previous {chainedConfirmationBars || 'n'} bar{chainedConfirmationBars !== "1" ? 's' : ''} condition was also true.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Input
                          placeholder="Enter value"
                          className={`w-32 border-border/50 focus:ring-primary/20 transition-all ${
                            chainedConfirmation 
                              ? 'bg-background text-foreground' 
                              : 'bg-muted/50 text-muted-foreground cursor-not-allowed'
                          }`}
                          value={chainedConfirmationBars}
                          onChange={(e) => setChainedConfirmationBars(e.target.value)}
                          disabled={!chainedConfirmation}
                          type="number"
                          min="1"
                        />
                      </div>
                    </div>

                    {/* Invalidation Halt Section */}
                    <div className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            onClick={() => setInvalidationHaltActive(!invalidationHaltActive)}
                            className={`w-4 h-4 rounded-full border-2 cursor-pointer transition-all duration-200 ${
                              invalidationHaltActive
                                ? "bg-primary border-primary"
                                : "bg-transparent border-muted-foreground/30 hover:border-primary/50"
                            }`}
                          />
                          <Label className={`font-semibold transition-colors ${invalidationHaltActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                            Invalidation Halt
                          </Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="w-4 h-4 rounded-full bg-muted-foreground/20 flex items-center justify-center cursor-help">
                                <span className="text-xs text-muted-foreground">?</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Drop trigger if the negated condition gets validated.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: TradingView Chart (3/5 = 60%) */}
                  <div className="space-y-4 lg:col-span-3">
                    <div className="bg-card border border-border/50 p-4 rounded-lg">
                      <div id="ohlcv_tradingview_chart" style={{ width: '100%', height: '500px' }}></div>
                    </div>
                    <Alert className="border-yellow-600/40 bg-yellow-500/5 text-yellow-500">
                      <AlertTitle className="font-medium">TradingView limitation:</AlertTitle>
                      <AlertDescription>
                        Although Bybit data is used to display the chart, all triggers are based on candlestick data fetched from HyperCore.
                      </AlertDescription>
                    </Alert>
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

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep(2)} className="border-border/50 cursor-pointer">
                  Back
                </Button>
                <div className="flex gap-3">
                  <div className="relative">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="inline-block">
                          <Button 
                            disabled={true}
                            className="bg-blue-400 hover:bg-blue-500 text-white shadow-lg cursor-not-allowed relative"
                          >
                            Backtest
                          </Button>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-sm">
                          We're working on displaying a backtest of your trigger on historical data so that you can see the post-trigger performance and validate your strategy before execution.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                    <div className="absolute -top-1 -right-1 bg-blue-400 text-white text-[10px] px-1.5 py-0.5 rounded-full transform rotate-12 font-medium shadow-sm">
                      Coming Soon
                    </div>
                  </div>
                  <Button 
                    onClick={() => setCurrentStep(5)}
                    disabled={
                      !triggerToken || // pair
                      !timeframe || // timeframe
                      !source || // first source
                      !triggerWhen || // trigger when
                      !secondSourceType || // second source
                      (secondSourceType === "value" && !secondSourceValue) // if second source is "value", value is required
                    }
                    className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg cursor-pointer"
                  >
                    Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
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
                      {triggerToken && source && timeframe && triggerWhen && targetValue ? (
                        <span>
                          {source.charAt(0).toUpperCase() + source.slice(1)} goes {triggerWhen} {targetValue} on {timeframe} chart of {triggerToken}
                          <br />
                          <span className="text-xs">Order will expire after {orderLifetime}</span>
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
                <div className="w-24 h-24 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto">
                  <img 
                    src="/purr_success.gif" 

                    alt="Success" 
                    className="w-20"
                  />
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
                      setSource("");
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
                    Go to Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>



      {/* Leverage Selection Modal */}
      {showLeverageModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card border border-border/50 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-300">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">Select Leverage</h3>
                <button
                  onClick={() => setShowLeverageModal(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Leverage Display */}
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">{leverage}x</div>
                <div className="text-sm text-muted-foreground mt-1">Leverage</div>
              </div>
              
              {/* Leverage Slider */}
              <div className="space-y-4">
                <div className="relative">
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={leverage}
                    onChange={(e) => setLeverage(parseInt(e.target.value))}
                    className="w-full appearance-none cursor-pointer slider"
                    style={{
                      '--slider-value': `${((leverage - 1) / 19) * 100}%`
                    } as React.CSSProperties}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-2">
                    <span>1x</span>
                    <span>5x</span>
                    <span>10x</span>
                    <span>15x</span>
                    <span>20x</span>
                  </div>
                </div>
                
                {/* Quick Select Buttons */}
                <div className="grid grid-cols-4 gap-2">
                  {[1, 5, 10, 20].map((lev) => (
                    <button
                      key={lev}
                      onClick={() => setLeverage(lev)}
                      className={`px-3 py-2 text-sm rounded transition-colors ${
                        leverage === lev
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {lev}x
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Apply Button */}
              <button
                onClick={() => setShowLeverageModal(false)}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-3 rounded-lg transition-colors"
              >
                Apply Leverage
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Transaction Rejected Modal */}
      {showTransactionRejectedModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card border border-border/50 rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-300">
            <div className="text-center space-y-6">
              {/* Icon with conditional display */}
              {isRetryingTransaction ? (
                /* Loading state with spinning circle */
                <div className="mx-auto relative" style={{ width: '88px', height: '88px' }}>
                  {/* Spinning border with thickness animation - 10% further from image */}
                  <div className="absolute inset-0 rounded-full border-transparent spinning-border"
                       style={{
                         borderWidth: '3px',
                         borderTopColor: resolvedTheme === 'dark' ? '#01cba4' : '#017c67',
                         borderRightColor: 'transparent',
                         borderBottomColor: 'transparent', 
                         borderLeftColor: 'transparent'
                       }}></div>
                  {/* Inner content - centered image with padding for spacing */}
                  <div className="w-full h-full flex items-center justify-center p-2">
                    <img 
                      src="/purr_distinguished.gif" 
                      alt="Processing Transaction" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              ) : (
                /* Error state - 20% bigger total (15% + 5% additional) */
                <div className="mx-auto flex items-center justify-center" style={{ width: '97px', height: '97px' }}>
                  <img 
                    src="/purr_invalid.png" 
                    alt="Transaction Rejected" 
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
              
              {/* Title */}
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-foreground">
                  {isRetryingTransaction ? 'Processing Transaction' : 'Transaction Rejected'}
                </h3>
                <p className="text-muted-foreground">
                  {isRetryingTransaction 
                    ? 'Please confirm the transaction in your wallet...'
                    : `You rejected the ${rejectedTransactionData?.tokenSymbol || 'token'} approval transaction. Would you like to try again?`
                  }
                </p>
              </div>
              
              {/* Buttons - only show when not retrying */}
              {!isRetryingTransaction && (
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    onClick={handleCancelRetry}
                    className="flex-1 border-border/50 cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleRetryApproval}
                    className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg cursor-pointer"
                  >
                    Try Again
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Swap Flow Modal */}
      {showSwapFlowModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card border border-border/50 rounded-xl p-8 max-w-2xl w-full mx-4 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-300">
            <div className="text-center space-y-6">
              {/* PURR Logo - Processing or Success */}
              <div className="mx-auto relative" style={{ 
                width: isSwapProcessing ? '88px' : '97px', 
                height: isSwapProcessing ? '88px' : '97px' 
              }}>
                {isSwapProcessing ? (
                  /* Processing State - Spinning border */
                  <>
                    <div className="absolute inset-0 rounded-full border-transparent spinning-border"
                         style={{
                           borderWidth: '3px',
                           borderTopColor: resolvedTheme === 'dark' ? '#01cba4' : '#017c67',
                           borderRightColor: 'transparent',
                           borderBottomColor: 'transparent', 
                           borderLeftColor: 'transparent'
                         }}></div>
                    <div className="w-full h-full flex items-center justify-center p-2">
                      <img 
                        src="/purr_distinguished.gif" 
                        alt="Processing Swap" 
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </>
                ) : (
                  /* Success State - No spinning border, 10% bigger */
                  <div className="w-full h-full flex items-center justify-center">
                    <img 
                      src="/purr_success.gif" 
                      alt="Swap Successful" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
              </div>

              {/* Token Flow Display - Only show when not processing */}
              {!isSwapProcessing && (
                <div className="flex items-center justify-center space-x-4">
                  {/* Input Token */}
                  <div className="flex items-center space-x-2">
                    <img 
                      src={fromToken?.icon} 
                      alt={fromToken?.symbol} 
                      className="w-6 h-6 rounded-full"
                    />
                    <span className="font-medium text-foreground">
                      {fromToken?.symbol}
                    </span>
                  </div>
                  
                  {/* Arrow */}
                  <ArrowRight className="w-5 h-5 text-green-500" />
                  
                  {/* Output Tokens */}
                  <div className="flex items-center space-x-2">
                    {toTokens.map((token, index) => (
                      <div key={index} className="flex items-center space-x-1">
                        <img 
                          src={token.icon} 
                          alt={token.symbol} 
                          className="w-6 h-6 rounded-full"
                        />
                        <span className="font-medium text-foreground">
                          {token.symbol}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

                            {/* Title */}
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-foreground">
                  {isSwapProcessing 
                    ? 'Processing Swap' 
                    : swapResults.length > 0 
                      ? 'Swap Successful!' 
                      : 'Order Created!'
                  }
                </h3>
                <p className="text-muted-foreground">
                  {isSwapProcessing 
                    ? 'Your swap is being processed. Please wait...' 
                    : swapResults.length > 0
                      ? 'Your instant swap has been completed successfully.'
                      : 'Your instant swap order has been created and is being processed.'
                  }
                </p>
              </div>

              {/* Close Button */}
              <Button 
                variant="outline" 
                onClick={() => setShowSwapFlowModal(false)}
                className="border-border/50 cursor-pointer"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      <Footer />
      
      {/* Transaction Monitor */}
      <TransactionMonitor 
        transactions={transactions}
        onRemoveTransaction={removeTransaction}
      />
    </div>
  )
} 