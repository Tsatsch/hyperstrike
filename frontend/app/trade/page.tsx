"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArrowRight, Search, TrendingUp, Users, Clock, Target, Wallet, BarChart3, ArrowUpDown, Activity, Bell, Settings, User } from "lucide-react"
import { WalletButton } from "@/components/WalletButton"
import { ThemeToggle } from "@/components/theme-toggle"
import { Footer } from "@/components/footer"

interface Token {
  symbol: string
  name: string
  price: number
  change24h: number
}

const tokens: Token[] = [
  { symbol: "ETH", name: "Ethereum", price: 2340.5, change24h: 2.4 },
  { symbol: "BTC", name: "Bitcoin", price: 43250.0, change24h: -1.2 },
  { symbol: "SOL", name: "Solana", price: 98.75, change24h: 5.8 },
  { symbol: "USDC", name: "USD Coin", price: 1.0, change24h: 0.0 },
  { symbol: "USDT", name: "Tether", price: 1.0, change24h: 0.0 },
  { symbol: "ARB", name: "Arbitrum", price: 1.85, change24h: 3.2 },
  { symbol: "OP", name: "Optimism", price: 2.45, change24h: -0.8 },
  { symbol: "AVAX", name: "Avalanche", price: 35.2, change24h: 4.1 },
]

const conditionTypes = [
  {
    id: "price_trigger",
    name: "Price Trigger",
    description: "Execute when a token reaches a specific price",
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
  const [currentStep, setCurrentStep] = useState(1)
  const [fromToken, setFromToken] = useState<Token | null>(null)
  const [toToken, setToToken] = useState<Token | null>(null)
  const [conditionType, setConditionType] = useState("")
  const [searchTerm, setSearchTerm] = useState("")

  const filteredTokens = tokens.filter(
    (token) =>
      token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      token.name.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const handleSwapTokens = () => {
    const temp = fromToken
    setFromToken(toToken)
    setToToken(temp)
  }

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
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
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
              { step: 1, title: "Swap Pair" },
              { step: 2, title: "Condition Type" },
              { step: 3, title: "Configure" },
              { step: 4, title: "Review" },
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
                {index < 3 && <ArrowRight className="w-4 h-4 mx-4 text-muted-foreground" />}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Choose Swap Pair */}
        {currentStep === 1 && (
          <Card className="max-w-2xl mx-auto border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="text-foreground">Choose Swap Pair</CardTitle>
              <CardDescription>Select the tokens you want to swap when your condition is met</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tokens..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-border/50 focus:ring-primary/20"
                />
              </div>

              {/* Token Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-foreground mb-2 block">From</Label>
                  <div className="space-y-2 max-h-64 overflow-y-auto border border-border/50 rounded-lg p-2 bg-card">
                    {filteredTokens.map((token) => (
                      <div
                        key={`from-${token.symbol}`}
                        className={`p-3 rounded-lg cursor-pointer transition-all ${
                          fromToken?.symbol === token.symbol
                            ? "bg-primary/10 border-primary/30 border shadow-sm"
                            : "hover:bg-accent/50 border border-transparent hover:border-border/50"
                        }`}
                        onClick={() => setFromToken(token)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-foreground">{token.symbol}</div>
                            <div className="text-sm text-muted-foreground">{token.name}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium text-foreground">${token.price.toLocaleString()}</div>
                            <div className={`text-sm ${token.change24h >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {token.change24h >= 0 ? "+" : ""}
                              {token.change24h}%
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-foreground mb-2 block">To</Label>
                  <div className="space-y-2 max-h-64 overflow-y-auto border border-border/50 rounded-lg p-2 bg-card">
                    {filteredTokens.map((token) => (
                      <div
                        key={`to-${token.symbol}`}
                        className={`p-3 rounded-lg cursor-pointer transition-all ${
                          toToken?.symbol === token.symbol
                            ? "bg-primary/10 border-primary/30 border shadow-sm"
                            : "hover:bg-accent/50 border border-transparent hover:border-border/50"
                        }`}
                        onClick={() => setToToken(token)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-foreground">{token.symbol}</div>
                            <div className="text-sm text-muted-foreground">{token.name}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium text-foreground">${token.price.toLocaleString()}</div>
                            <div className={`text-sm ${token.change24h >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {token.change24h >= 0 ? "+" : ""}
                              {token.change24h}%
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Swap Button */}
              {fromToken && toToken && (
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSwapTokens}
                    className="flex items-center space-x-2 border-primary/30 text-primary hover:bg-primary/10"
                  >
                    <ArrowUpDown className="w-4 h-4" />
                    <span>Swap</span>
                  </Button>
                </div>
              )}

              {/* Selected Pair Display */}
              {fromToken && toToken && (
                <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
                  <div className="flex items-center justify-center space-x-4">
                    <div className="text-center">
                      <div className="font-medium text-lg text-foreground">{fromToken.symbol}</div>
                      <div className="text-sm text-muted-foreground">{fromToken.name}</div>
                    </div>
                    <ArrowRight className="w-6 h-6 text-primary" />
                    <div className="text-center">
                      <div className="font-medium text-lg text-foreground">{toToken.symbol}</div>
                      <div className="text-sm text-muted-foreground">{toToken.name}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button 
                  onClick={() => setCurrentStep(2)} 
                  disabled={!fromToken || !toToken}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
                >
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Choose Condition Type */}
        {currentStep === 2 && (
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
                <Button variant="outline" onClick={() => setCurrentStep(1)} className="border-border/50">
                  Back
                </Button>
                <Button 
                  onClick={() => setCurrentStep(3)} 
                  disabled={!conditionType}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
                >
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Configure Condition */}
        {currentStep === 3 && (
          <Card className="max-w-2xl mx-auto border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="text-foreground">Configure Condition</CardTitle>
              <CardDescription>
                Set up the specific parameters for your{" "}
                {conditionTypes.find((c) => c.id === conditionType)?.name.toLowerCase()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {conditionType === "price_trigger" && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-foreground">Trigger Token</Label>
                    <Select>
                      <SelectTrigger className="border-border/50 focus:ring-primary/20">
                        <SelectValue placeholder="Select token to monitor" />
                      </SelectTrigger>
                      <SelectContent>
                        {tokens.map((token) => (
                          <SelectItem key={token.symbol} value={token.symbol}>
                            {token.symbol} - {token.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-foreground">Condition</Label>
                    <Select>
                      <SelectTrigger className="border-border/50 focus:ring-primary/20">
                        <SelectValue placeholder="Select condition" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="above">Price goes above</SelectItem>
                        <SelectItem value="below">Price goes below</SelectItem>
                        <SelectItem value="change_up">Price increases by %</SelectItem>
                        <SelectItem value="change_down">Price decreases by %</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-foreground">Target Value</Label>
                    <Input placeholder="Enter price or percentage" className="border-border/50 focus:ring-primary/20" />
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

              <div className="bg-accent/20 border border-accent/30 p-4 rounded-lg">
                <h4 className="font-medium text-foreground mb-2">Swap Amount</h4>
                <div className="space-y-2">
                  <Label className="text-foreground">Amount to swap</Label>
                  <div className="flex space-x-2">
                    <Input placeholder="0.0" className="flex-1 border-border/50 focus:ring-primary/20" />
                    <Select>
                      <SelectTrigger className="w-32 border-border/50 focus:ring-primary/20">
                        <SelectValue placeholder="%" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="25">25%</SelectItem>
                        <SelectItem value="50">50%</SelectItem>
                        <SelectItem value="75">75%</SelectItem>
                        <SelectItem value="100">100%</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep(2)} className="border-border/50">
                  Back
                </Button>
                <Button 
                  onClick={() => setCurrentStep(4)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
                >
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Review */}
        {currentStep === 4 && (
          <Card className="max-w-2xl mx-auto border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="text-foreground">Review Conditional Swap</CardTitle>
              <CardDescription>Review your conditional swap configuration before creating</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted/50 border border-border/50 p-4 rounded-lg space-y-4">
                <div>
                  <h4 className="font-medium text-foreground mb-2">Swap Pair</h4>
                  <div className="flex items-center space-x-4">
                    <div className="text-center">
                      <div className="font-medium text-foreground">{fromToken?.symbol}</div>
                      <div className="text-sm text-muted-foreground">{fromToken?.name}</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    <div className="text-center">
                      <div className="font-medium text-foreground">{toToken?.symbol}</div>
                      <div className="text-sm text-muted-foreground">{toToken?.name}</div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium text-foreground mb-2">Condition</h4>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="border-primary/30 text-primary">
                      {conditionTypes.find((c) => c.id === conditionType)?.name}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {conditionTypes.find((c) => c.id === conditionType)?.description}
                    </span>
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
                <Button variant="outline" onClick={() => setCurrentStep(3)} className="border-border/50">
                  Back
                </Button>
                <Button className="bg-green-600 hover:bg-green-700 text-white shadow-lg">
                  Create Conditional Swap
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Footer />
    </div>
  )
} 