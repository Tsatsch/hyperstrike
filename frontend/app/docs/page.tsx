"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { HYPERLIQUID_TOKENS, DEFAULT_TOKEN_PRICES } from "@/lib/tokens"
import { updateAllTokenPrices } from "@/lib/hyperliquid-prices"
import { XpButton } from "@/components/XpButton"
import { WalletButton } from "@/components/WalletButton"
import { ThemeToggle } from "@/components/theme-toggle"
import { Footer } from "@/components/footer"
import { Logo } from "@/components/Logo"

export default function DocsPage() {
  const [priceCache, setPriceCache] = useState<Record<string, { price: number; change24h: number }>>(DEFAULT_TOKEN_PRICES)

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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card">
        <div className="flex h-16 items-center px-6">
          <div className="flex items-center space-x-4">
            <a href="/" className="flex items-center space-x-1 hover:opacity-80 transition-opacity">
              <Logo width={24} height={24} />
              <span className="text-xl font-bold">Hyperstrike</span>
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

      <div className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Docs</h1>
          <p className="text-muted-foreground">Tradable assets on Hyperliquid and platform information.</p>
        </div>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-foreground">Tradable Assets on Hyperliquid</CardTitle>
            <CardDescription>Explore all supported tokens and their current prices.</CardDescription>
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

      <Footer />
    </div>
  )
}


