"use client"

import { useEffect, useMemo, useState } from "react"
import { usePrivy } from '@privy-io/react-auth'
import { exchangePrivyForBackendJwt, getBackendJwt, listOrders, getUserXp } from '@/lib/api'
import { fetchTokenBalances, fetchHYPEBalance } from '@/lib/token-balances'

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Activity, Bell, Settings, User, Wallet, ChevronDown, ChevronUp, RefreshCw } from "lucide-react"
import { WalletButton } from "@/components/WalletButton"
import { ThemeToggle } from "@/components/theme-toggle"
import { Footer } from "@/components/footer"
import { Logo } from "@/components/Logo"

type OrderState = "open" | "closed" | "deleted" | "done"

interface OrderOut {
  id: number
  user_id: number
  wallet: string
  platform: string
  swapData: { inputToken: string; inputAmount: number; outputToken: string; outputAmount: number }
  orderData?: any
  signature?: string
  time: number
  state: "open" | "closed" | "deleted"
  created_at?: string
}

interface TokenInfo {
  symbol: string
  name: string
  address?: string
  icon: string
}

const TOKENS: TokenInfo[] = [
  { symbol: "USDT", name: "Tether", address: "0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb", icon: "/coins-logos/usdt.svg" },
  { symbol: "UETH", name: "Unit Ethereum", address: "0xbe6727b535545c67d5caa73dea54865b92cf7907", icon: "/coins-logos/eth.svg" },
  { symbol: "UBTC", name: "Unit Bitcoin", address: "0x9fdbda0a5e284c32744d2f17ee5c74b284993463", icon: "/coins-logos/btc.svg" },
  { symbol: "USOL", name: "Unit Solana", address: "0x068f321fa8fb9f0d135f290ef6a3e2813e1c8a29", icon: "/coins-logos/sol.svg" },
  { symbol: "USDE", name: "USD.e", address: "0x5d3a1ff2b6bab83b63cd9ad0787074081a52ef34", icon: "/coins-logos/usde.svg" },
  { symbol: "HYPE", name: "Hyperliquid", icon: "/coins-logos/hyperliquid.svg" },
]

// Simple price map in USDT for sorting and valuation; extend as needed
const PRICE_USD_BY_SYMBOL: Record<string, number> = {
  USDT: 1,
  USDE: 1,
  HYPE: 39,
  UETH: 3500.5,
  UBTC: 118000,
  USOL: 166,
}

const HYPE_ADDRESS = '0x2222222222222222222222222222222222222222'

function useEphemeralDoneState(orders: OrderOut[]) {
  const [doneIds, setDoneIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    // Mark newly closed orders as "done" briefly so users can notice them
    const closedNow = orders.filter(o => o.state === 'closed').map(o => o.id)
    const newlyClosed = closedNow.filter(id => !doneIds.has(id))
    if (newlyClosed.length > 0) {
      const updated = new Set(doneIds)
      newlyClosed.forEach(id => {
        updated.add(id)
        // Auto-move to closed after 30s
        setTimeout(() => {
          setDoneIds(prev => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
        }, 180000)
      })
      setDoneIds(updated)
    }
  }, [orders])

  const clearDone = (id: number) => {
    setDoneIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  return { doneIds, clearDone }
}

export default function PortfolioPage() {
  const { authenticated, user, getAccessToken } = usePrivy()
  const [orders, setOrders] = useState<OrderOut[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [balances, setBalances] = useState<Record<string, string>>({})
  const [loadingBalances, setLoadingBalances] = useState(false)
  const [showClosed, setShowClosed] = useState(false)
  const [xp, setXp] = useState<number>(0)

  // Done state (ephemeral) to briefly show newly closed orders
  const { doneIds, clearDone } = useEphemeralDoneState(orders)

  // Fetch orders
  useEffect(() => {
    const run = async () => {
      if (!authenticated || !user?.wallet?.address) return
      setLoadingOrders(true)
      try {
        // Ensure backend JWT exists
        const jwt = getBackendJwt() || await exchangePrivyForBackendJwt(getAccessToken, user.wallet.address)
        if (!jwt) throw new Error('Missing backend auth')
        const data = await listOrders() as OrderOut[]
        setOrders(Array.isArray(data) ? data : [])
      } catch (e) {
        setOrders([])
      } finally {
        setLoadingOrders(false)
      }
    }
    run()
  }, [authenticated, user?.wallet?.address])

  // Fetch balances
  useEffect(() => {
    const run = async () => {
      if (!authenticated || !user?.wallet?.address) return
      setLoadingBalances(true)
      try {
        // fetch user XP
        try {
          const jwt = getBackendJwt() || await exchangePrivyForBackendJwt(getAccessToken, user.wallet.address)
          if (jwt) setXp(await getUserXp())
        } catch {}

        const erc20Addresses = TOKENS.map(t => t.address).filter(Boolean) as string[]
        const withoutHype = erc20Addresses.filter(addr => addr !== '0x2222222222222222222222222222222222222222')
        const [erc20Balances, hype] = await Promise.all([
          fetchTokenBalances(user.wallet.address, withoutHype),
          fetchHYPEBalance(user.wallet.address)
        ])
        setBalances({
          ...erc20Balances,
          '0x2222222222222222222222222222222222222222': hype,
        })
      } catch {
        setBalances({})
      } finally {
        setLoadingBalances(false)
      }
    }
    run()
  }, [authenticated, user?.wallet?.address])

  const categorized = useMemo(() => {
    const open: OrderOut[] = []
    const done: OrderOut[] = []
    const closed: OrderOut[] = []
    for (const o of orders) {
      if (o.state === 'open') open.push(o)
      else if (o.state === 'closed') {
        if (doneIds.has(o.id)) done.push(o)
        else closed.push(o)
      }
    }
    return { open, done, closed }
  }, [orders, doneIds])

  const addressToSymbol = (address?: string) => {
    if (!address) return 'UNKNOWN'
    if (address.toLowerCase() === HYPE_ADDRESS.toLowerCase()) return 'HYPE'
    const found = TOKENS.find(t => t.address?.toLowerCase() === address.toLowerCase())
    return found?.symbol || address.slice(0, 6) + '...' + address.slice(-4)
  }

  const formatOrderSummary = (o: OrderOut) => {
    const inSym = addressToSymbol((o.swapData as any)?.inputToken)
    const outSym = addressToSymbol((o.swapData as any)?.outputToken)
    const inAmt = (o.swapData as any)?.inputAmount
    const outAmt = (o.swapData as any)?.outputAmount

    const od = (o as any).orderData || {}
    const trig = od.ohlcvTrigger || {}
    const tf = trig.timeframe || trig.interval || ''
    const source = trig.source || 'close'
    const dir = (trig.trigger || trig.above) ? (trig.trigger === 'above' || trig.above ? 'Above' : 'Below') : ''
    const trigVal = trig.triggerValue ?? trig.threshold

    const priceMap = PRICE_USD_BY_SYMBOL
    const inVal = (priceMap[inSym] || 0) * (Number(inAmt) || 0)
    const outVal = (priceMap[outSym] || 0) * (Number(outAmt) || 0)

    return {
      inSym, outSym, inAmt, outAmt, tf, source, dir, trigVal, inVal, outVal
    }
  }

  const formatAmount = (amount: number) => {
    try {
      return Number(amount).toLocaleString(undefined, { maximumFractionDigits: 6 })
    } catch { return String(amount) }
  }

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
              <a href="/trade" className="text-muted-foreground hover:text-foreground transition-colors">Trade</a>
              <a href="/portfolio" className="font-medium text-primary">Portfolio</a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Markets</a>
              <a href="/xp" className="text-muted-foreground hover:text-foreground transition-colors">XP</a>
              <a href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">Dashboard</a>
            </nav>
          </div>
          <div className="ml-auto flex items-center space-x-4">
            <ThemeToggle />
            <Button variant="ghost" size="icon"><Bell className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon"><Settings className="h-4 w-4" /></Button>
            <WalletButton />
            <Button variant="ghost" size="icon"><User className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <div className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Portfolio</h1>
          <p className="text-muted-foreground">Your balances on Hyperliquid and your pending/closed orders</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Orders on the left (wider) */}
          <Card className="border-border/50 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-foreground">Orders</CardTitle>
              <CardDescription>Open, recently closed (done), and closed orders</CardDescription>
            </CardHeader>
            <CardContent>
            {/* Open */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-foreground">Open ({categorized.open.length})</div>
              </div>
              {loadingOrders ? (
                <div className="text-center py-6">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : categorized.open.length === 0 ? (
                <div className="text-muted-foreground text-sm">No open orders</div>
              ) : (
                <div className="space-y-2">
                  {categorized.open.map(o => {
                    const s = formatOrderSummary(o)
                    return (
                      <div key={o.id} className="border border-border/50 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div className="text-foreground font-medium">
                            {formatAmount(s.inAmt)} {s.inSym} → {formatAmount(s.outAmt)} {s.outSym}
                          </div>
                          <Badge variant="outline">open</Badge>
                        </div>
                        {(s.dir && s.trigVal) ? (
                          <div className="text-xs text-muted-foreground mt-1">
                            {s.dir} {s.trigVal} {s.source} price
                          </div>
                        ) : null}
                        
                        {s.tf ? (
                          <div className="text-xs text-muted-foreground mt-1">Timeframe: {s.tf}</div>
                        ) : null}
                        <div className="text-[11px] text-muted-foreground mt-1">#{o.id} • {new Date(o.time).toLocaleString()}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <Separator className="my-4" />

            {/* Done (ephemeral) */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-foreground">Done ({categorized.done.length})</div>
              </div>
              {categorized.done.length === 0 ? (
                <div className="text-muted-foreground text-sm">No recently closed orders</div>
              ) : (
                <div className="space-y-2">
                  {categorized.done.map(o => (
                    <div key={o.id} className="border border-border/50 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-foreground font-medium">
                          {o.swapData.inputAmount} {o.swapData.inputToken} → {o.swapData.outputAmount} {o.swapData.outputToken}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">done</Badge>
                          <Button size="sm" variant="outline" onClick={() => clearDone(o.id)}>Move to closed</Button>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">#{o.id} • {new Date(o.time).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator className="my-4" />

            {/* Closed (collapsible) */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-foreground">Closed ({categorized.closed.length})</div>
                <Button variant="ghost" size="sm" onClick={() => setShowClosed(v => !v)} className="cursor-pointer">
                  {showClosed ? <>Hide <ChevronUp className="w-4 h-4 ml-1" /></> : <>Show <ChevronDown className="w-4 h-4 ml-1" /></>}
                </Button>
              </div>
              {showClosed && (
                categorized.closed.length === 0 ? (
                  <div className="text-muted-foreground text-sm">No closed orders</div>
                ) : (
                  <div className="space-y-2">
                    {categorized.closed.map(o => (
                      <div key={o.id} className="border border-border/50 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div className="text-foreground font-medium">
                            {o.swapData.inputAmount} {o.swapData.inputToken} → {o.swapData.outputAmount} {o.swapData.outputToken}
                          </div>
                          <Badge variant="outline">closed</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">#{o.id} • {new Date(o.time).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
            </CardContent>
          </Card>

          {/* Tokens on the right (compact) */}
          <div className="space-y-6">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-foreground">Tokens</CardTitle>
                <CardDescription>Tradable assets on Hyperliquid</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingBalances ? (
                  <div className="text-center py-6">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    <p className="text-muted-foreground mt-2 text-sm">Loading balances...</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(() => {
                      const rows = TOKENS.map((t) => {
                        const balanceStr = t.symbol === 'HYPE'
                          ? balances['0x2222222222222222222222222222222222222222']
                          : (t.address ? balances[t.address] : undefined)
                        const balanceNum = parseFloat(balanceStr || '0') || 0
                        const price = PRICE_USD_BY_SYMBOL[t.symbol] ?? 0
                        const valueUsd = balanceNum * price
                        return { token: t, balanceStr: (balanceStr ?? '0'), balanceNum, price, valueUsd }
                      }).sort((a, b) => b.valueUsd - a.valueUsd)

                      return rows.map(({ token: t, balanceStr, valueUsd }) => (
                        <div key={t.symbol} className="flex items-center justify-between border border-border/50 rounded-lg px-3 py-2">
                          <div className="flex items-center space-x-2">
                            <img src={t.icon} alt={t.symbol} className="w-5 h-5 rounded-full" />
                            <div>
                              <div className="text-foreground text-sm font-medium">{t.symbol}</div>
                              <div className="text-[10px] text-muted-foreground">{t.name}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-foreground text-sm font-semibold">${valueUsd.toFixed(2)}</div>
                            <div className="text-[10px] text-muted-foreground">{balanceStr}</div>
                          </div>
                        </div>
                      ))
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/50 cursor-pointer" onClick={() => window.location.href = '/xp'}>
              <CardHeader>
                <CardTitle className="text-foreground">Your XP</CardTitle>
                <CardDescription>Track rewards you earn on HyperTrade</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">Total XP</div>
                  <div className="text-foreground font-semibold">{xp}</div>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${Math.min(100, (xp % 1000) / 10)}%` }} />
                </div>
                <div className="text-xs text-muted-foreground">Click to see how to earn more XP</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}

