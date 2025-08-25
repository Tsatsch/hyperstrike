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
  Zap,
  Shield,
  Globe,
  ArrowUpDown,
  Play,
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
import { GlueXIcon } from "@/components/GlueXIcon"
import { HyperliquidIcon } from "@/components/HyperliquidIcon"
import { AlchemyIcon } from "@/components/AlchemyIcon"
import { PrivyIcon } from "@/components/PrivyIcon"

const features = [
  {
    icon: Zap,
    title: "Conditional Swaps",
    description: "Execute trades based on external signals, wallet activities, and market events."
  },
  {
    icon: Shield,
    title: "Fully On-Chain",
    description: "All trades are verifiable on the blockchain. We are suppport as well Hypercore as HyperEVM."
  },
  {
    icon: Activity,
    title: "Advanced Dashboard",
    description: "Manage all your open orders and track performance in one place."
  }
]

const conditionTypes = [
  {
    icon: TrendingUp,
    title: "OHLCV Triggers"
  },
  {
    icon: Wallet,
    title: "Wallet Activity"
  },
  {
    icon: BarChart3,
    title: "DCA"
  },
  {
    icon: Clock,
    title: "Time-Based"
  },
  {
    icon: Target,
    title: "Multi-Token"
  },
  {
    icon: Users,
    title: "Social Signals"
  }
]

const stats = [
  { label: "Execution Speed", value: "Sub-second", icon: Zap },
  { label: "Supported Tokens", value: "10+", icon: Wallet },
  { label: "Condition Types", value: "5+", icon: Target },
  { label: "Real-time Dashboard", value: "24/7", icon: Activity }
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
              <span className="text-xl font-bold">Hypertick</span>
            </div>
            <nav className="hidden md:flex items-center space-x-6 text-sm">
              {/* Hide XP on landing header per request */}
            </nav>
          </div>
          <div className="ml-auto flex items-center space-x-4">
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <a href="/dashboard" className="flex items-center">
                Launch d'App
              </a>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        
        {/* Cute floating cat */}
        <div className="absolute top-20 left-8 md:left-20 z-10 hidden md:block">
          <img 
            src="/purr_success.png" 
            alt="Success cat" 
            className="w-16 h-16 md:w-20 md:h-20 opacity-80 hover:opacity-100 transition-opacity"
          />
        </div>
        
        <div className="relative container mx-auto px-6 py-20">
          <div className="text-center max-w-4xl mx-auto">
            <Badge variant="secondary" className="mb-4 bg-primary/20 text-primary border-primary/30">
              <Sparkles className="w-3 h-3 mr-1" />
              Hyper Trading Platform
            </Badge>
            
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              Smart Conditional Trading
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 leading-relaxed">
              Trade based on external signals, wallet activities, and market events.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg">
                <a href="/trade" className="flex items-center">
                  <Play className="w-4 h-4 mr-2" />
                  Start Trading
                </a>
              </Button>

            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
              {stats.map((stat, index) => {
                const Icon = stat.icon
                return (
                  <div key={stat.label} className="text-center">
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

      {/* Trusted By / Sponsor Lane */}
      <section className="py-8 bg-muted/5 border-y border-border/30">
        <div className="container mx-auto px-6">
          <div className="text-center mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Powered by</h3>
          </div>
          
          {/* Animated Sponsor Carousel */}
          <div className="relative overflow-hidden">
            <div className="flex animate-scroll gap-8 md:gap-12">
              {/* First set of sponsors */}
              <div className="flex items-center gap-8 md:gap-12 min-w-max">
                {/* GlueX */}
                <div className="flex items-center space-x-3 px-4 py-2 bg-background/50 rounded-lg border border-border/30">
                  <GlueXIcon width={28} height={7} className="text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">GlueX</span>
                </div>
                
                {/* Alchemy */}
                <div className="flex items-center space-x-3 px-4 py-2 bg-background/50 rounded-lg border border-border/30">
                  <AlchemyIcon width={20} height={17} showText={false} />
                  <span className="text-sm font-medium text-muted-foreground">Alchemy</span>
                </div>
                
                {/* Hyperliquid */}
                <div className="flex items-center space-x-3 px-4 py-2 bg-background/50 rounded-lg border border-border/30">
                  <HyperliquidIcon width={16} height={16} />
                  <span className="text-sm font-medium text-muted-foreground">Hyperliquid Names</span>
                </div>
                
                {/* Privy */}
                <div className="flex items-center space-x-3 px-4 py-2 bg-background/50 rounded-lg border border-border/30">
                  <PrivyIcon width={16} height={20} />
                  <span className="text-sm font-medium text-muted-foreground">Privy</span>
                </div>
              </div>
              
              {/* Duplicate set for seamless loop */}
              <div className="flex items-center gap-8 md:gap-12 min-w-max">
                {/* GlueX */}
                <div className="flex items-center space-x-3 px-4 py-2 bg-background/50 rounded-lg border border-border/30">
                  <GlueXIcon width={28} height={7} className="text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">GlueX</span>
                </div>
                
                {/* Alchemy */}
                <div className="flex items-center space-x-3 px-4 py-2 bg-background/50 rounded-lg border border-border/30">
                  <AlchemyIcon width={20} height={17} showText={false} />
                  <span className="text-sm font-medium text-muted-foreground">Alchemy</span>
                </div>
                
                {/* Hyperliquid */}
                <div className="flex items-center space-x-3 px-4 py-2 bg-background/50 rounded-lg border border-border/30">
                  <HyperliquidIcon width={16} height={16} />
                  <span className="text-sm font-medium text-muted-foreground">Hyperliquid Names</span>
                </div>
                
                {/* Privy */}
                <div className="flex items-center space-x-3 px-4 py-2 bg-background/50 rounded-lg border border-border/30">
                  <PrivyIcon width={16} height={20} />
                  <span className="text-sm font-medium text-muted-foreground">Privy</span>
                </div>
              </div>
              
              {/* Third set for extra smoothness */}
              <div className="flex items-center gap-8 md:gap-12 min-w-max">
                {/* GlueX */}
                <div className="flex items-center space-x-3 px-4 py-2 bg-background/50 rounded-lg border border-border/30">
                  <GlueXIcon width={28} height={7} className="text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">GlueX</span>
                </div>
                
                {/* Alchemy */}
                <div className="flex items-center space-x-3 px-4 py-2 bg-background/50 rounded-lg border border-border/30">
                  <AlchemyIcon width={20} height={17} showText={false} />
                  <span className="text-sm font-medium text-muted-foreground">Alchemy</span>
                </div>
                
                {/* Hyperliquid */}
                <div className="flex items-center space-x-3 px-4 py-2 bg-background/50 rounded-lg border border-border/30">
                  <HyperliquidIcon width={16} height={16} />
                  <span className="text-sm font-medium text-muted-foreground">Hyperliquid Names</span>
                </div>
                
                {/* Privy */}
                <div className="flex items-center space-x-3 px-4 py-2 bg-background/50 rounded-lg border border-border/30">
                  <PrivyIcon width={16} height={20} />
                  <span className="text-sm font-medium text-muted-foreground">Privy</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trigger Types - Main Feature */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Trigger Types
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Execute trades based on powerful conditional logic and real-time market signals.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {conditionTypes.map((condition, index) => {
              const Icon = condition.icon
              const gradients = [
                'from-blue-500/20 to-cyan-500/20',
                'from-purple-500/20 to-pink-500/20', 
                'from-green-500/20 to-emerald-500/20',
                'from-orange-500/20 to-red-500/20',
                'from-indigo-500/20 to-purple-500/20',
                'from-teal-500/20 to-blue-500/20'
              ]
              return (
                <div key={condition.title} className={`relative bg-gradient-to-br ${gradients[index]} border border-border/30 rounded-xl p-6 text-center group hover:scale-105 hover:shadow-xl transition-all duration-300 backdrop-blur-sm`}>
                  {/* Glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  
                  {/* Icon with enhanced styling */}
                  <div className="relative w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-all duration-300 group-hover:scale-110">
                    <Icon className="w-8 h-8 text-primary group-hover:text-primary transition-colors" />
                  </div>
                  
                  {/* Title */}
                  <h4 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">{condition.title}</h4>
                  
                  {/* Subtle description */}
                  <div className="mt-2 h-1 w-8 bg-primary/30 rounded-full mx-auto group-hover:bg-primary group-hover:w-12 transition-all duration-300" />
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="py-16">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Platform Features
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Built for professional traders with enterprise-grade security and performance.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <Card key={feature.title} className="border-border/50 shadow-lg hover:shadow-xl transition-all duration-300">
                  <CardHeader className="pb-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-3">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <CardDescription className="text-sm leading-relaxed">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>



      {/* Final CTA */}
      <section className="py-16 bg-primary/5">
        <div className="container mx-auto px-6">
          <div className="text-center">
            <h3 className="text-2xl font-bold mb-4">Ready to Start Trading?</h3>
            <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
              Set up conditional orders and manage your portfolio with ease.
            </p>
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg">
              <a href="/dashboard" className="flex items-center">
                <Play className="w-4 h-4 mr-2" />
                Launch d'App
              </a>
            </Button>
          </div>
        </div>
      </section>


      <Footer />
    </div>
  )
}
