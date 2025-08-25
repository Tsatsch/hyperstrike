"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TrendingUp, TrendingDown, Clock, DollarSign, Target, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { 
  getMarketData, 
  MarketData, 
  formatPrice, 
  formatPercentage, 
  formatVolume 
} from "@/lib/hyperliquid-market-data"

interface Token {
  symbol: string
  name: string
  price: number
  change24h: number
  address?: string
  balance: number
  icon: string
  metadata?: any
  marketData?: any
  lastUpdated?: string
}

interface MarketInfoProps {
  symbol: string // Can be "HYPE-USDC" format or just "HYPE"
  triggerToken?: string
  setTriggerToken?: (token: string) => void
  tokens?: Token[]
  className?: string
}

export function MarketInfo({ symbol, triggerToken, setTriggerToken, tokens, className }: MarketInfoProps) {
  const [marketData, setMarketData] = useState<MarketData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch market data
  useEffect(() => {
    if (!symbol) return

    const fetchData = async () => {
      setLoading(true)
      setError(null)
      
      try {
        // Extract base symbol from triggerToken format (e.g., "HYPE-USDC" -> "HYPE")
        const baseSymbol = symbol.includes('-') ? symbol.split('-')[0] : 
                          symbol.includes('/') ? symbol.split('/')[0] : symbol
        
        const data = await getMarketData(baseSymbol)
        if (data) {
          setMarketData(data)
        } else {
          setError('No market data available')
        }
      } catch (err) {
        console.error('Error fetching market data:', err)
        setError('Failed to fetch market data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    // Set up auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [symbol])

  if (loading) {
    return (
      <Card className={cn("p-4", className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex items-center space-x-6">
            <Skeleton className="h-12 w-20" />
            <Skeleton className="h-12 w-24" />
            <Skeleton className="h-12 w-24" />
            <Skeleton className="h-12 w-32" />
          </div>
        </div>
      </Card>
    )
  }

  if (error || !marketData) {
    return (
      <Card className={cn("p-4 border-destructive/50", className)}>
        <div className="text-center text-destructive">
          {error || 'No market data available'}
        </div>
      </Card>
    )
  }

  const isPositiveChange = marketData.change24hPercent >= 0
  
  // Extract base symbol for display
  const baseSymbol = symbol.includes('-') ? symbol.split('-')[0] : 
                    symbol.includes('/') ? symbol.split('/')[0] : symbol
  // Use the actual selected symbol instead of hardcoding USDT
  const displaySymbol = symbol
  const isPerp = symbol.includes('-') || (!symbol.includes('/'))

  return (
    <Card className={cn("p-4 border-border/50", className)}>
      <div className="flex items-center justify-between">
        {/* Left side - Symbol and Mark/Oracle prices */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            {triggerToken && setTriggerToken && tokens ? (
              <Select value={triggerToken} onValueChange={setTriggerToken}>
                <SelectTrigger className="h-auto p-0 border-none bg-transparent hover:bg-accent/50 transition-colors">
                  <div className="flex items-center space-x-2">
                    <span className="text-xl font-bold text-foreground">
                      {displaySymbol}
                    </span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </div>
                </SelectTrigger>
                <SelectContent>
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
                      { symbol: 'PURR', name: 'Purr' , icon: 'https://app.hyperliquid.xyz/coins/PURR_USDC.svg'},
                      { symbol: 'BONK', name: 'Bonk' , icon: 'https://app.hyperliquid.xyz/coins/BONK_USDC.svg'},
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
            ) : (
              <span className="text-xl font-bold text-foreground">
                {displaySymbol}
              </span>
            )}
            <Badge variant="outline" className="text-xs">
              {isPerp ? 'PERP' : 'SPOT'}
            </Badge>
          </div>
          
          <div className="text-sm text-muted-foreground">
            <span>Mark: {formatPrice(marketData.markPrice)}</span>
            {marketData.oraclePrice && (
              <>
                <span className="mx-2">•</span>
                <span>Oracle: {formatPrice(marketData.oraclePrice)}</span>
              </>
            )}
          </div>
        </div>

        {/* Right side - Market stats */}
        <div className="flex items-center space-x-6 text-sm">
          {/* 24h Change */}
          <div className="text-center">
            <div className={cn(
              "flex items-center font-medium",
              isPositiveChange ? "text-green-500" : "text-red-500"
            )}>
              {isPositiveChange ? (
                <TrendingUp className="w-4 h-4 mr-1" />
              ) : (
                <TrendingDown className="w-4 h-4 mr-1" />
              )}
              <span>
                {isPositiveChange ? '+' : ''}{formatPrice(marketData.change24h, 1)} / {formatPercentage(marketData.change24hPercent)}
              </span>
            </div>
            <div className="text-muted-foreground">24h Change</div>
          </div>

          {/* 24h Volume */}
          <div className="text-center">
            <div className="flex items-center text-foreground font-medium">
              <DollarSign className="w-4 h-4 mr-1" />
              <span>{formatVolume(marketData.volume24h)}</span>
            </div>
            <div className="text-muted-foreground">24h Volume</div>
          </div>

          {/* Open Interest */}
          {marketData.openInterest !== undefined && (
            <div className="text-center">
              <div className="flex items-center text-foreground font-medium">
                <Target className="w-4 h-4 mr-1" />
                <span>{formatVolume(marketData.openInterest)}</span>
              </div>
              <div className="text-muted-foreground">Open Interest</div>
            </div>
          )}

          {/* Funding Rate & Countdown */}
          {(marketData.fundingRate !== undefined || marketData.fundingCountdown) && (
            <div className="text-center">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4" />
                <div className={cn(
                  "font-medium",
                  marketData.fundingRate !== undefined 
                    ? marketData.fundingRate >= 0 
                      ? "text-green-500" 
                      : "text-red-500"
                    : "text-foreground"
                )}>
                  {marketData.fundingRate !== undefined && (
                    <span>{formatPercentage(marketData.fundingRate)} </span>
                  )}
                  {marketData.fundingCountdown && (
                    <span className="text-muted-foreground">
                      {marketData.fundingCountdown}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-muted-foreground">Funding / Countdown</div>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
