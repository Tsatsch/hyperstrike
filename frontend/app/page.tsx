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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="border-b bg-card dark:bg-card">
        <div className="flex h-16 items-center px-6">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Activity className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">HyperTrade</span>
            </div>
            <nav className="hidden md:flex items-center space-x-6 text-sm">
              <a href="#" className="font-medium">
                Trade
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground">
                Portfolio
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground">
                Markets
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground">
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

      <div className="container mx-auto px-4 py-8">
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
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                    currentStep >= item.step ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                  }`}
                >
                  {item.step}
                </div>
                <span
                  className={`ml-2 text-sm font-medium ${currentStep >= item.step ? "text-blue-600" : "text-gray-500 dark:text-gray-400"}`}
                >
                  {item.title}
                </span>
                {index < 3 && <ArrowRight className="w-4 h-4 mx-4 text-gray-400" />}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Choose Swap Pair */}
        {currentStep === 1 && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Choose Swap Pair</CardTitle>
              <CardDescription>Select the tokens you want to swap when your condition is met</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search tokens..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Token Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">From</Label>
                  <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-2">
                    {filteredTokens.map((token) => (
                      <div
                        key={`from-${token.symbol}`}
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${
                          fromToken?.symbol === token.symbol
                            ? "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 border"
                            : "hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent"
                        }`}
                        onClick={() => setFromToken(token)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{token.symbol}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{token.name}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">${token.price.toLocaleString()}</div>
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
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">To</Label>
                  <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-2">
                    {filteredTokens.map((token) => (
                      <div
                        key={`to-${token.symbol}`}
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${
                          toToken?.symbol === token.symbol
                            ? "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 border"
                            : "hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent"
                        }`}
                        onClick={() => setToToken(token)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{token.symbol}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{token.name}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">${token.price.toLocaleString()}</div>
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
                    className="flex items-center space-x-2 bg-transparent"
                  >
                    <ArrowUpDown className="w-4 h-4" />
                    <span>Swap</span>
                  </Button>
                </div>
              )}

              {/* Selected Pair Display */}
              {fromToken && toToken && (
                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                  <div className="flex items-center justify-center space-x-4">
                    <div className="text-center">
                      <div className="font-medium text-lg">{fromToken.symbol}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{fromToken.name}</div>
                    </div>
                    <ArrowRight className="w-6 h-6 text-blue-600" />
                    <div className="text-center">
                      <div className="font-medium text-lg">{toToken.symbol}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{toToken.name}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={() => setCurrentStep(2)} disabled={!fromToken || !toToken}>
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Choose Condition Type */}
        {currentStep === 2 && (
          <Card className="max-w-4xl mx-auto">
            <CardHeader>
              <CardTitle>Choose Condition Type</CardTitle>
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
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                      }`}
                      onClick={() => setConditionType(condition.id)}
                    >
                      <div className="flex items-start space-x-3">
                        <div
                          className={`p-2 rounded-lg ${
                            conditionType === condition.id ? "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h3 className="font-medium">{condition.name}</h3>
                            {condition.popular && (
                              <Badge variant="secondary" className="text-xs">
                                Popular
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{condition.description}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <Separator className="my-6" />

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep(1)}>
                  Back
                </Button>
                <Button onClick={() => setCurrentStep(3)} disabled={!conditionType}>
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Configure Condition */}
        {currentStep === 3 && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Configure Condition</CardTitle>
              <CardDescription>
                Set up the specific parameters for your{" "}
                {conditionTypes.find((c) => c.id === conditionType)?.name.toLowerCase()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {conditionType === "price_trigger" && (
                <div className="space-y-4">
                  <div>
                    <Label>Trigger Token</Label>
                    <Select>
                      <SelectTrigger>
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
                    <Label>Condition</Label>
                    <Select>
                      <SelectTrigger>
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
                    <Label>Target Value</Label>
                    <Input placeholder="Enter price or percentage" />
                  </div>
                </div>
              )}

              {conditionType === "wallet_activity" && (
                <div className="space-y-4">
                  <div>
                    <Label>Wallet Address</Label>
                    <Input placeholder="0x..." />
                  </div>
                  <div>
                    <Label>Activity Type</Label>
                    <Select>
                      <SelectTrigger>
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
                    <Label>Minimum Amount (Optional)</Label>
                    <Input placeholder="Minimum transaction amount" />
                  </div>
                </div>
              )}

              {conditionType === "time_based" && (
                <div className="space-y-4">
                  <div>
                    <Label>Trigger Type</Label>
                    <Select>
                      <SelectTrigger>
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
                    <Label>Date & Time</Label>
                    <Input type="datetime-local" />
                  </div>
                </div>
              )}

              <div className="bg-yellow-50 dark:bg-yellow-950 p-4 rounded-lg">
                <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">Swap Amount</h4>
                <div className="space-y-2">
                  <Label>Amount to swap</Label>
                  <div className="flex space-x-2">
                    <Input placeholder="0.0" className="flex-1" />
                    <Select>
                      <SelectTrigger className="w-32">
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
                <Button variant="outline" onClick={() => setCurrentStep(2)}>
                  Back
                </Button>
                <Button onClick={() => setCurrentStep(4)}>
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Review */}
        {currentStep === 4 && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Review Conditional Swap</CardTitle>
              <CardDescription>Review your conditional swap configuration before creating</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Swap Pair</h4>
                  <div className="flex items-center space-x-4">
                    <div className="text-center">
                      <div className="font-medium">{fromToken?.symbol}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{fromToken?.name}</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                    <div className="text-center">
                      <div className="font-medium">{toToken?.symbol}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{toToken?.name}</div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Condition</h4>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">{conditionTypes.find((c) => c.id === conditionType)?.name}</Badge>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {conditionTypes.find((c) => c.id === conditionType)?.description}
                    </span>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Estimated Fees</h4>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
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
                <Button variant="outline" onClick={() => setCurrentStep(3)}>
                  Back
                </Button>
                <Button className="bg-green-600 hover:bg-green-700">Create Conditional Swap</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
