"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { HYPERLIQUID_TOKENS, DEFAULT_TOKEN_PRICES } from "@/lib/tokens"
import { updateAllTokenPrices } from "@/lib/hyperliquid-prices"
import { XpButton } from "@/components/XpButton"
import { WalletButton } from "@/components/WalletButton"
import { ThemeToggle } from "@/components/theme-toggle"
import { Footer } from "@/components/footer"
import { Logo } from "@/components/Logo"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { 
  TrendingUp, 
  Wallet, 
  Clock, 
  Users, 
  BarChart3, 
  Target, 
  Zap, 
  Star,
  ChevronRight,
  BookOpen,
  Coins,
  Settings
} from "lucide-react"

export default function DocsPage() {
  const [priceCache, setPriceCache] = useState<Record<string, { price: number; change24h: number }>>(DEFAULT_TOKEN_PRICES)
  const [activeSection, setActiveSection] = useState("core")

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const realTimePrices = await updateAllTokenPrices()
        if (realTimePrices && Object.keys(realTimePrices).length > 0) {
          const finalPriceCache = { ...DEFAULT_TOKEN_PRICES, ...realTimePrices }
          setPriceCache(finalPriceCache)
        }
      } catch {
        // keep defaults
      }
    }
    fetchPrices()
    const interval = setInterval(fetchPrices, 30000)
    return () => clearInterval(interval)
  }, [])

  const navigationItems = [
    {
      id: "core",
      label: "Core",
      icon: BookOpen,
    },
    {
      id: "evm",
      label: "EVM",
      icon: BarChart3,
    },
    {
      id: "tradable-assets",
      label: "Tradable Assets",
      icon: Coins,
    },
    {
      id: "features",
      label: "Features",
      icon: Settings,
    }
  ]

  const renderContent = () => {
    switch (activeSection) {
      case "core":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-4">Core Concepts</h2>
              <p className="text-muted-foreground mb-4">
                Hypertick is a decentralized trading platform that allows you to create conditional orders 
                based on market conditions, wallet activity, and time-based triggers.
              </p>
            </div>

            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  How Conditional Orders Work
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 border border-border/30 rounded-lg">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                      <TrendingUp className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">1. Set Condition</h3>
                    <p className="text-sm text-muted-foreground">Choose what market event triggers your order</p>
                  </div>
                  <div className="text-center p-4 border border-border/30 rounded-lg">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Clock className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">2. Wait for Trigger</h3>
                    <p className="text-sm text-muted-foreground">Order monitors market until condition is met</p>
                  </div>
                  <div className="text-center p-4 border border-border/30 rounded-lg">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Zap className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">3. Execute Trade</h3>
                    <p className="text-sm text-muted-foreground">Automatically swap tokens when triggered</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )

      case "evm":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-4">EVM</h2>
              <p className="text-muted-foreground mb-4">
                Create orders that trigger based on market conditions, wallet activity, and time-based triggers.
              </p>
            </div>

            {/* EVM Overview */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  How Conditional Orders Work
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 border border-border/30 rounded-lg">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Coins className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">1. Set Input & Outputs</h3>
                    <p className="text-sm text-muted-foreground">Choose input token and up to 4 output tokens</p>
                  </div>
                  <div className="text-center p-4 border border-border/30 rounded-lg">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                      <TrendingUp className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">2. Set Condition</h3>
                    <p className="text-sm text-muted-foreground">Choose what event triggers your order</p>
                  </div>
                  <div className="text-center p-4 border border-border/30 rounded-lg">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Clock className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">3. Wait for Trigger</h3>
                    <p className="text-sm text-muted-foreground">Order constantly checks if condition is met</p>
                  </div>
                  <div className="text-center p-4 border border-border/30 rounded-lg">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Zap className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">4. Execute Trade</h3>
                    <p className="text-sm text-muted-foreground">Automatically swap tokens when triggered</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* OHLCV Triggers Section */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  OHLCV Triggers
                </CardTitle>
                <CardDescription>
                  Create orders that trigger based on price movements, volume changes, or technical indicators.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-foreground">OHLCV Data Sources</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">open</Badge>
                        <span className="text-sm text-muted-foreground">Opening price of each period</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">high</Badge>
                        <span className="text-sm text-muted-foreground">Highest price during period</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">low</Badge>
                        <span className="text-sm text-muted-foreground">Lowest price during period</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">close</Badge>
                        <span className="text-sm text-muted-foreground">Closing price of each period</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">volume</Badge>
                        <span className="text-sm text-muted-foreground">Trading volume during period</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">hl2</Badge>
                        <span className="text-sm text-muted-foreground">(High + Low) ÷ 2</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">hlc3</Badge>
                        <span className="text-sm text-muted-foreground">(High + Low + Close) ÷ 3</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">ohlc4</Badge>
                        <span className="text-sm text-muted-foreground">(Open + High + Low + Close) ÷ 4</span>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-lg font-semibold mb-3 text-foreground">Technical Indicators</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">SMA</Badge>
                        <span className="text-sm text-muted-foreground">Simple Moving Average - average price over X periods</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">EMA</Badge>
                        <span className="text-sm text-muted-foreground">Exponential Moving Average - weighted average favoring recent data</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">RSI</Badge>
                        <span className="text-sm text-muted-foreground">Relative Strength Index - momentum indicator (0-100)</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">BB.upper</Badge>
                        <span className="text-sm text-muted-foreground">Bollinger Bands upper line (SMA + standard deviation)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">BB.mid</Badge>
                        <span className="text-sm text-muted-foreground">Bollinger Bands middle line (SMA)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">BB.lower</Badge>
                        <span className="text-sm text-muted-foreground">Bollinger Bands lower line (SMA - standard deviation)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Wallet Activity Section */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Wallet className="w-5 h-5" />
                  Wallet Activity Triggers
                </CardTitle>
                <CardDescription>
                  Execute trades based on specific wallet transactions or activity patterns.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Monitor specific wallet addresses for transactions and execute trades when certain conditions are met.
                </p>
                <div className="bg-muted/30 p-4 rounded-lg">
                  <p className="text-sm font-mono">"When wallet 0x123... makes a trade above $1000, buy HYPE"</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )

      case "tradable-assets":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-4">Tradable Assets</h2>
              <p className="text-muted-foreground mb-4">
                All supported tokens available for trading on Hyperliquid.
              </p>
        </div>

        <Card className="border-border/50">
          <CardHeader>
                <CardTitle className="text-foreground">Supported Tokens</CardTitle>
                <CardDescription>Current prices and 24h changes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {HYPERLIQUID_TOKENS.map(t => {
                const price = priceCache[t.symbol]?.price ?? 0
                const change = priceCache[t.symbol]?.change24h ?? 0
                return (
                  <div key={t.symbol} className="flex items-center justify-between border border-border/50 rounded-lg px-3 py-2">
                    <div className="flex items-center space-x-2">
                      <img src={t.icon} alt={t.symbol} className="w-5 h-5 rounded-full" />
                      <div>
                        <div className="text-foreground text-sm font-medium">{t.symbol}</div>
                        <div className="text-[10px] text-muted-foreground">{t.name}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-foreground text-sm font-semibold">{price ? `$${price.toFixed(2)}` : 'N/A'}</div>
                      <div className={`text-[10px] ${change > 0 ? 'text-green-500' : change < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>{change ? `${change.toFixed(2)}%` : '0.00%'}</div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-4">
              <Button variant="outline" onClick={() => (window.location.href = '/trade')} className="cursor-pointer">Start Trading</Button>
            </div>
          </CardContent>
        </Card>
          </div>
        )

      case "features":
        return (
          <div className="space-y-6">
            {/* XP System Section */}
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-4">Features</h2>
              <p className="text-muted-foreground mb-4">
                Additional features and systems available on the platform.
              </p>
            </div>

            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Star className="w-5 h-5" />
                  XP System
                </CardTitle>
                <CardDescription>
                  Earn experience points by using the platform and unlock special features.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="text-center p-4 border border-border/30 rounded-lg">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                      <TrendingUp className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">Trading</h3>
                    <p className="text-sm text-muted-foreground">Earn XP for each successful trade</p>
                  </div>
                  <div className="text-center p-4 border border-border/30 rounded-lg">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Clock className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">Activity</h3>
                    <p className="text-sm text-muted-foreground">Stay active to earn daily XP</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Hyperliquid Names Section */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Hyperliquid Names (.hl)
                </CardTitle>
                <CardDescription>
                  Get your unique .hl domain name for easy wallet identification.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  .hl names are human-readable identifiers that map to wallet addresses, making it easier to send and receive tokens.
                </p>
                <div className="bg-muted/30 p-4 rounded-lg">
                  <p className="text-sm font-mono">Instead of: 0x1234567890abcdef...</p>
                  <p className="text-sm font-mono">Use: yourname.hl</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )

      default:
        return (
          <div className="text-center py-12">
            <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">Welcome to Documentation</h2>
            <p className="text-muted-foreground">Select a topic from the navigation to get started</p>
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card">
        <div className="flex h-16 items-center px-6">
          <div className="flex items-center space-x-4">
            <a href="/" className="flex items-center space-x-1 hover:opacity-80 transition-opacity">
              <Logo width={24} height={24} />
              <span className="text-xl font-bold">Hypertick</span>
            </a>
            <nav className="hidden md:flex items-center space-x-6 text-sm">
              <a href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">Dashboard</a>
              <a href="/trade" className="text-muted-foreground hover:text-foreground transition-colors">Trade</a>
              <a href="/docs" className="font-medium text-primary">Docs</a>
            </nav>
          </div>
          <div className="ml-auto flex items-center space-x-4">
            <XpButton />
            <WalletButton />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Left Navigation - Now acts as a jump table between main categories */}
        <div className="w-64 border-r bg-card/50 p-4">
          <div className="space-y-2">
            {navigationItems.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  activeSection === section.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <section.icon className="w-4 h-4" />
                <span className="font-medium">{section.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          {renderContent()}
        </div>
      </div>

      <Footer />
    </div>
  )
}


