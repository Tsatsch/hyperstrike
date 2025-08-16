"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  ArrowRight, 
  TrendingUp, 
  Users, 
  Clock, 
  Target, 
  Wallet, 
  BarChart3, 
  Activity, 
  Bell, 
  Settings, 
  User,
  Zap,
  Shield,
  Globe,
  ArrowUpDown,
  CheckCircle,
  Star,
  Play,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Cpu,
  Gauge,
  Lock
} from "lucide-react"
import { WalletButton } from "@/components/WalletButton"
import { ThemeToggle } from "@/components/theme-toggle"
import { Footer } from "@/components/footer"
import { Logo } from "@/components/Logo"

const features = [
  {
    icon: Zap,
    title: "Conditional Token Swapping",
    description: "Execute trades based on external signals like wallet activities, token prices, funding rates, and more - not just the token you're trading."
  },
  {
    icon: Cpu,
    title: "Ultra-Fast Execution",
    description: "Built on cutting-edge blockchain technology with sub-second confirmations for lightning-fast execution."
  },
  {
    icon: Shield,
    title: "Fully On-Chain",
    description: "All orders, trades, and cancellations are verifiable on the blockchain ensuring transparency and trustlessness."
  },
  {
    icon: Globe,
    title: "External Data Integration",
    description: "React to real-time on-chain and off-chain market events with sophisticated trading strategies."
  },
  {
    icon: Lock,
    title: "Professional Security",
    description: "Combines the transparency of DeFi with the speed and precision of centralized exchanges."
  },
  {
    icon: Target,
    title: "Advanced Trading Strategies",
    description: "Create sophisticated trading strategies with multiple conditions and real-time market monitoring."
  }
]

const conditionTypes = [
  {
    icon: TrendingUp,
    title: "Price Triggers",
    description: "Execute when any token reaches specific price levels"
  },
  {
    icon: Wallet,
    title: "Wallet Activity",
    description: "React to specific wallet transactions and movements"
  },
  {
    icon: BarChart3,
    title: "Funding Rates",
    description: "Trade based on Hyperliquid's daily funding rates"
  },
  {
    icon: Clock,
    title: "Time-Based",
    description: "Schedule trades for specific times or intervals"
  },
  {
    icon: Target,
    title: "Multi-Token",
    description: "Complex conditions involving multiple token movements"
  },
  {
    icon: Users,
    title: "Social Signals",
    description: "Trade based on social sentiment and market signals"
  }
]

const stats = [
  { label: "Execution Speed", value: "Sub-second", icon: Zap },
  { label: "Supported Tokens", value: "100+", icon: Wallet },
  { label: "Condition Types", value: "6+", icon: Target },
  { label: "Real-time Monitoring", value: "24/7", icon: Activity }
]

export default function LandingPage() {
  const [activeFeature, setActiveFeature] = useState(0)

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex h-16 items-center px-6">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <Logo width={24} height={24} />
              <span className="text-xl font-bold">Hyperstrike</span>
            </div>
            <nav className="hidden md:flex items-center space-x-6 text-sm">
              <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
                Features
              </a>
              <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">
                How It Works
              </a>
              <a href="/trade" className="text-muted-foreground hover:text-foreground transition-colors">
                Trade
              </a>
              <a href="#docs" className="text-muted-foreground hover:text-foreground transition-colors">
                Docs
              </a>
            </nav>
          </div>
          <div className="ml-auto flex items-center space-x-4">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <div className="relative container mx-auto px-6 py-20">
          <div className="text-center max-w-4xl mx-auto">
            <Badge variant="secondary" className="mb-4 bg-primary/20 text-primary border-primary/30">
              <Sparkles className="w-3 h-3 mr-1" />
              Revolutionary Trading Platform
            </Badge>
            
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              Beyond Simple Token Swaps
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 leading-relaxed">
              Our innovative crypto trading platform offers conditional token swapping based on external signals, 
              wallet activities, and market events - going far beyond simple token swaps.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg">
                <a href="/trade" className="flex items-center">
                  <Play className="w-4 h-4 mr-2" />
                  Start Trading
                </a>
              </Button>
              <Button size="lg" variant="outline" className="border-primary/30 text-primary hover:bg-primary/10">
                <ExternalLink className="w-4 h-4 mr-2" />
                View Demo
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
              {stats.map((stat, index) => {
                const Icon = stat.icon
                return (
                  <div key={index} className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      <Icon className="w-5 h-5 text-primary mr-2" />
                      <span className="text-2xl font-bold text-foreground">{stat.value}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Advanced Trading Features
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Experience the future of decentralized trading with unprecedented conditional logic and external data integration.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <Card key={index} className="border-border/50 shadow-lg hover:shadow-xl transition-all duration-300">
                  <CardHeader>
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-base leading-relaxed">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              How Conditional Trading Works
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Set up sophisticated trading strategies that react to real-time market conditions and external signals.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {conditionTypes.map((condition, index) => {
              const Icon = condition.icon
              return (
                <div key={index} className="text-center group">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{condition.title}</h3>
                  <p className="text-muted-foreground">{condition.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary/5">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Experience the Future of Trading?
          </h2>
                      <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join thousands of traders who are already using our platform to execute sophisticated 
              trading strategies with advanced conditional logic and external data integration.
            </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg">
              <a href="/trade" className="flex items-center">
                <Play className="w-4 h-4 mr-2" />
                Start Trading
              </a>
            </Button>
            <Button size="lg" variant="outline" className="border-primary/30 text-primary hover:bg-primary/10">
              <ExternalLink className="w-4 h-4 mr-2" />
              Read Documentation
            </Button>
          </div>

          <div className="flex items-center justify-center space-x-6 text-sm text-muted-foreground">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>No KYC Required</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Instant Setup</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>24/7 Support</span>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Trusted by Professional Traders
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              See what traders are saying about our revolutionary platform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                name: "Alex Chen",
                role: "Professional Trader",
                content: "The conditional trading features are game-changing. I can now execute complex strategies that were impossible on other DEXs.",
                rating: 5
              },
              {
                name: "Sarah Martinez",
                role: "DeFi Developer",
                content: "The conditional trading features are incredible. I can execute complex strategies that were impossible on other platforms.",
                rating: 5
              },
              {
                name: "Michael Rodriguez",
                role: "Crypto Fund Manager",
                content: "The external data integration is game-changing. I can react to market events in real-time with sophisticated strategies.",
                rating: 5
              }
            ].map((testimonial, index) => (
              <Card key={index} className="border-border/50 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    "{testimonial.content}"
                  </p>
                  <div>
                    <p className="font-semibold text-foreground">{testimonial.name}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
