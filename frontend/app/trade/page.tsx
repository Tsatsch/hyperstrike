


"use client"

import { useState, useEffect } from "react"
import { usePrivy } from '@privy-io/react-auth'
import { getBackendJwt, exchangePrivyForBackendJwt } from '@/lib/api'
import { getUserIdFromWallet } from '@/lib/wallet-utils'
import { fetchTokenBalances, fetchHYPEBalance } from '@/lib/token-balances'

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

interface Token {
  symbol: string
  name: string
  price: number
  change24h: number
  address?: string
  balance: number
  icon: string // Add this line for the icon URL or path
}

const tokens: Token[] = [
  { symbol: "USDT", name: "Tether", price: 1.0, change24h: 0.0, address: "0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb", balance: 1250.45, icon: "https://i.imgur.com/ERZzJcK.png" },
  { symbol: "UETH", name: "Unit Ethereum", price: 3500.5, change24h: 2.4, address: "0xbe6727b535545c67d5caa73dea54865b92cf7907", balance: 0.01858, icon: "https://i.imgur.com/ERZzJcK.png" },
  { symbol: "UBTC", name: "Unit Bitcoin", price: 118000.0, change24h: -1.2, address: "0x9fdbda0a5e284c32744d2f17ee5c74b284993463", balance: 0.00234, icon: "https://i.imgur.com/ERZzJcK.png" },
  { symbol: "USOL", name: "Unit Solana", price: 166, change24h: 5.8, address: "0x068f321fa8fb9f0d135f290ef6a3e2813e1c8a29", balance: 2.45, icon: "https://i.imgur.com/jh8AZo0.png" },
  { symbol: "USDE", name: "USD.e", price: 1, change24h: 3.2, address: "0x5d3a1ff2b6bab83b63cd9ad0787074081a52ef34", balance: 45.67, icon: "https://i.imgur.com/jh8AZo0.png" },
  { symbol: "HYPE", name: "Hyperliquid", price: 39, change24h: 3.2, address: "0x2222222222222222222222222222222222222222", balance: 45.67, icon: "https://i.imgur.com/jh8AZo0.png" },

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
  const [fromToken, setFromToken] = useState<Token | null>(tokens.find(t => t.symbol === "USDT") || null)
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
  const [toAmounts, setToAmounts] = useState<Record<string, string>>({})
  const [triggerToken, setTriggerToken] = useState<string>("");
  const [timeframe, setTimeframe] = useState<string>("");
  const [condition, setCondition] = useState<string>("");
  const [triggerWhen, setTriggerWhen] = useState<string>("above");
  const [targetValue, setTargetValue] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [showSuccessPage, setShowSuccessPage] = useState(false);

  // Dummy mapping from contract address to tokens
  const contractAddressToToken: { [key: string]: Token | undefined } = {
    "0x2222222222222222222222222222222222222222": tokens.find(t => t.symbol === "HYPE"),
    "0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb": tokens.find(t => t.symbol === "USDT"),
    // Add more mappings as needed
  }
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

  const filteredTokenSearch = tokens.filter(
    (token) =>
      token.symbol.toLowerCase().includes(tokenSearchTerm.toLowerCase()) ||
      token.name.toLowerCase().includes(tokenSearchTerm.toLowerCase()) ||
      (token.address && token.address.toLowerCase().includes(tokenSearchTerm.toLowerCase())),
  )

  // Filter out the sell token from the buy token list
  const availableBuyTokens = filteredTokenSearch.filter(token => 
    !fromToken || token.symbol !== fromToken.symbol
  )

  const handleSwapTokens = () => {
    const temp = fromToken
    const tempAmount = fromAmount
    setFromToken(toTokens[0] || null)
    setToTokens(fromToken ? [fromToken] : [])
    setFromAmount(toAmounts[toTokens[0]?.symbol || ''] || '')
    setToAmounts(fromToken ? { [fromToken.symbol]: tempAmount } : {})
  }

  const handleTokenSelect = (token: Token, isFrom: boolean) => {
    if (isFrom) {
      setFromToken(token)
      setShowFromTokenModal(false)
      // Clear toTokens if they contain the same token as the new fromToken
      setToTokens(prev => prev.filter(t => t.symbol !== token.symbol))
      const newToAmounts = { ...toAmounts }
      delete newToAmounts[token.symbol]
      setToAmounts(newToAmounts)
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
      balance: 0
    }
    if (isFrom) {
      // Add icon property to match Token type
      setFromToken({...token, icon: ''}) 
      setShowFromTokenModal(false)
      // Clear toTokens if they contain the same token as the new fromToken
      setToTokens(prev => prev.filter(t => t.symbol !== token.symbol))
      const newToAmounts = { ...toAmounts }
      delete newToAmounts[token.symbol]
      setToAmounts(newToAmounts)
    } else {
      // Add icon property to match Token type
      const tokenWithIcon = {...token, icon: ''}
      setToTokens(prev => {
        if (prev.find(t => t.symbol === token.symbol)) {
          return prev // Token already exists
        }
        return [...prev, tokenWithIcon]
      })
      setShowToTokenModal(false)
    }
    setCustomTokenAddress("")
    setShowCustomTokenInput(false)
  }

  // Calculate fiat values
  const fromFiatValue = fromToken && fromAmount ? (parseFloat(fromAmount) * fromToken.price).toFixed(2) : "0"
  const toFiatValue = toTokens.reduce((total, token) => {
    const amount = toAmounts[token.symbol] || "0"
    return total + (parseFloat(amount) * token.price)
  }, 0).toFixed(2)

  // Helper function to remove a token from toTokens
  const removeToToken = (tokenSymbol: string) => {
    setToTokens(prev => prev.filter(t => t.symbol !== tokenSymbol))
    const newToAmounts = { ...toAmounts }
    delete newToAmounts[tokenSymbol]
    setToAmounts(newToAmounts)
  }

  // Helper function to update amount for a specific token
  const updateToTokenAmount = (tokenSymbol: string, amount: string) => {
    setToAmounts(prev => ({
      ...prev,
      [tokenSymbol]: amount
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

  // Add TradingView widget
  useEffect(() => {
    const initTradingView = () => {
      const container = document.getElementById('tradingview_chart');
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
          container_id: "tradingview_chart",
          width: "120%",
          height: "400"
        });
      }
    };

    // Check if TradingView is already loaded
    if ((window as any).TradingView) {
      initTradingView();
      return;
    }

    // Load TradingView script
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = initTradingView;
    script.onerror = () => {
      console.error('Failed to load TradingView script');
    };
    
    document.head.appendChild(script);

    return () => {
      const container = document.getElementById('tradingview_chart');
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [currentStep]);

  // Auto-proceed to step 2 when wallet gets connected after platform selection
  useEffect(() => {
    if (authenticated && pendingPlatform && currentStep === 1) {
      setSelectedPlatform(pendingPlatform)
      setCurrentStep(2)
      setPendingPlatform(null)
      setShowWalletPrompt(false)
    }
  }, [authenticated, pendingPlatform, currentStep]);

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
  }, [authenticated, user?.wallet?.address]);

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
      const primaryOutputAmount = Number(toAmounts[primaryOutputToken?.symbol || '']);
      
      const orderPayload = {
        platform: (selectedPlatform as 'hyperevm' | 'hypercore') || 'hyperevm',
        wallet: '0x0000000000000000000000000000000000000000',
        swapData: {
          inputToken: fromToken?.address || '0x0000000000000000000000000000000000000000',
          inputAmount: isFinite(inputAmountNum) ? inputAmountNum : 0,
          outputToken: primaryOutputToken?.address || '0x0000000000000000000000000000000000000000',
          outputAmount: isFinite(primaryOutputAmount) ? primaryOutputAmount : 0,
          // Add additional output tokens if needed
          additionalOutputs: toTokens.slice(1).map(token => ({
            token: token.address || '0x0000000000000000000000000000000000000000',
            amount: (() => { const n = Number(toAmounts[token.symbol]); return isFinite(n) ? n : 0; })()
          }))
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
            <a href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
              <Activity className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">HyperTrade</span>
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
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                Analytics
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

        {/* Step 2: Choose Swap Pair */}
        {currentStep === 2 && selectedPlatform === "hyperevm" && (
          <Card className="max-w-md mx-auto border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="text-foreground">Swap Tokens</CardTitle>
              <CardDescription>Select the tokens you want to swap when your condition is met</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                <div className="space-y-3">
                  {/* Add Token Button */}
                  <div className="flex justify-center">
                    <Button
                      variant="outline"
                      className="flex items-center space-x-2 bg-card border-border/50 hover:bg-accent/50 px-3 py-2"
                      onClick={() => setShowToTokenModal(true)}
                    >
                      <span className="text-foreground">
                        {toTokens.length === 0 ? "Select tokens" : "Add more tokens"}
                      </span>
                      <ArrowRight className="w-4 h-4 rotate-90" />
                    </Button>
                  </div>

                  {/* Selected Tokens */}
                  {toTokens.map((token) => (
                    <div key={token.symbol} className="flex items-center space-x-3 p-4 bg-card border border-border/50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <img src={token.icon} alt={token.symbol} className="w-6 h-6 rounded-full" />
                            <span className="text-foreground font-medium text-base">{token.symbol}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeToToken(token.symbol)}
                            className="text-muted-foreground hover:text-foreground p-1"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        <Input
                          type="number"
                          placeholder="0"
                          value={toAmounts[token.symbol] || ""}
                          onChange={(e) => updateToTokenAmount(token.symbol, e.target.value)}
                          className="text-lg font-medium border-0 bg-transparent p-0 focus:ring-0 text-foreground"
                        />
                        <div className="flex items-center justify-between mt-1">
                          <div className="text-sm text-muted-foreground">
                            ${toAmounts[token.symbol] ? (parseFloat(toAmounts[token.symbol]) * token.price).toFixed(2) : "0"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {getTokenBalance(token)} {token.symbol}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Total Value Display */}
                  {toTokens.length > 0 && (
                    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <span className="text-sm font-medium text-foreground">Total Value:</span>
                      <span className="text-sm font-medium text-foreground">${toFiatValue}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep(1)} className="border-border/50 cursor-pointer">
                  Back
                </Button>
                <Button 
                  onClick={() => setCurrentStep(3)} 
                  disabled={!fromToken || toTokens.length === 0 || !fromAmount}
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
                      const aValue = parseFloat(getTokenBalance(a)) * a.price
                      const bValue = parseFloat(getTokenBalance(b)) * b.price
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
                          ${(parseFloat(getTokenBalance(token)) * token.price).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
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
                      const aValue = parseFloat(getTokenBalance(a)) * a.price
                      const bValue = parseFloat(getTokenBalance(b)) * b.price
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
                          ${(parseFloat(getTokenBalance(token)) * token.price).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
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

        {/* Step 3: Choose Condition Type */}
        {currentStep === 3 && (
          <Card className="max-w-4xl mx-auto border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="text-foreground">Choose Condition Type</CardTitle>
              <CardDescription>Select the type of condition that will trigger your swap</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                      <div className="flex items-start space-x-3">
                        <div
                          className={`p-2 rounded-lg transition-colors ${
                            conditionType === condition.id 
                              ? "bg-primary text-primary-foreground" 
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
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

              <Separator className="my-6" />

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

              {/* TradingView Chart Section */}
              <div className="pt-4 border-t border-solid border-border/30 mt-5">
                <div className="bg-card border border-border/50 p-4 rounded-lg">
                  
                  <div id="tradingview_chart" style={{ width: '105%', height: '400px', marginLeft: '-15px' }}></div>
                </div>
              </div>

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
                              {toAmounts[token.symbol] || "0"} {token.symbol}
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
                      setToAmounts({});
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

      {/* Add the container for the TradingView chart */}
      {/* <div id="tradingview_chart" className="bg-card border border-border/50 p-4 rounded-lg mt-4"></div> */}

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
                  Please connect your wallet to start trading on HyperTrade
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