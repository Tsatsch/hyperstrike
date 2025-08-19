"use client"

import { useEffect, useMemo, useState } from "react"
import { usePrivy } from '@privy-io/react-auth'
import { exchangePrivyForBackendJwt, getBackendJwt, listOrders, getUserXp, setOrderState } from '@/lib/api'
import { fetchTokenBalances, fetchHYPEBalance } from '@/lib/token-balances'
import { HYPERLIQUID_TOKENS, DEFAULT_TOKEN_PRICES, getNativeToken } from '@/lib/tokens'
import { updateAllTokenPrices } from '@/lib/hyperliquid-prices'

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Activity, Wallet, ChevronDown, ChevronUp, RefreshCw } from "lucide-react"
import { WalletButton } from "@/components/WalletButton"
import { ThemeToggle } from "@/components/theme-toggle"
import { XpButton } from "@/components/XpButton"
import { Footer } from "@/components/footer"
import { Logo } from "@/components/Logo"

type OrderState = "open" | "closed" | "deleted" | "done"

interface OrderOut {
  id: number
  user_id: number
  wallet: string
  platform: string
  swapData: {
    inputToken: string
    inputAmount: number
    outputToken?: string
    outputAmount?: number
    outputs?: { token: string; percentage: number }[]
  }
  orderData?: any
  signature?: string
  time: number
  state: "open" | "done" | "closed" | "deleted"
  created_at?: string
  termination_message?: string
}

// Using centralized token configuration
const TOKENS = HYPERLIQUID_TOKENS
const HYPE_ADDRESS = getNativeToken().address

// Address → symbol mapping aligned with Trade page selections (lowercased keys)
const ADDRESS_TO_SYMBOL: Record<string, string> = {
  "0x2222222222222222222222222222222222222222": "HYPE",
  "0xdac17f958d2ee523a2206206994597c13d831ec7": "USDT",
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": "UETH",
  "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": "UBTC",
  "0xd31a59c85ae9d8edefec411d448f90841571b89c": "USOL",
  "0x5d3a1ff2b6bab83b63cd9ad0787074081a52ef34": "USDE",
  "0x52e444545fbe9e5972a7a371299522f7871aec1f": "JEFF",
  "0xa320d9f65ec992eff38622c63627856382db726c": "HFUN",
  "0x3b4575e689ded21caad31d64c4df1f10f3b2cedf": "UFART",
}

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
  const { ready, authenticated, user, getAccessToken, login } = usePrivy()
  const [orders, setOrders] = useState<OrderOut[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [balances, setBalances] = useState<Record<string, string>>({})
  const [loadingBalances, setLoadingBalances] = useState(false)
  const [showClosed, setShowClosed] = useState(false)
  const [xp, setXp] = useState<number>(0)
  const [showConnectPrompt, setShowConnectPrompt] = useState(false)
  const [hideCanceledClosed, setHideCanceledClosed] = useState(false)
  const [priceCache, setPriceCache] = useState<Record<string, { price: number; change24h: number }>>(DEFAULT_TOKEN_PRICES)
  const [now, setNow] = useState<number>(Date.now())
  const [closingAllDone, setClosingAllDone] = useState(false)
  const [closingIds, setClosingIds] = useState<Set<number>>(new Set())

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

  // Note: Order expiration is now handled automatically by the backend
  // The backend runs expiration checks every 30 seconds and closes expired orders
  // This ensures orders expire even if the frontend is closed

  useEffect(() => {
    if (!ready) return
    setShowConnectPrompt(!authenticated)
  }, [ready, authenticated])

  // Live ticker for countdowns
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

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

  // Fetch real-time prices
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const realTimePrices = await updateAllTokenPrices()
        
        if (realTimePrices && Object.keys(realTimePrices).length > 0) {
          const finalPriceCache = { ...DEFAULT_TOKEN_PRICES, ...realTimePrices }
          setPriceCache(finalPriceCache)
        }
      } catch (error) {
        console.warn('Error fetching portfolio prices:', error)
      }
    }

    fetchPrices()
    
    // Update prices every 30 seconds
    const interval = setInterval(fetchPrices, 30000)
    return () => clearInterval(interval)
  }, [])

  const categorized = useMemo(() => {
    const open: OrderOut[] = []
    const done: OrderOut[] = []
    const closed: OrderOut[] = []
    for (const o of orders) {
      if (o.state === 'open') open.push(o)
      else if (o.state === 'done') done.push(o)
      else if (o.state === 'closed') closed.push(o)
    }
    return { open, done, closed }
  }, [orders])

  const handleMoveOneToClosed = async (orderId: number) => {
    try {
      setClosingIds(prev => new Set(prev).add(orderId))
      const ok = await setOrderState(orderId, 'closed')
      if (ok) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, state: 'closed', termination_message: undefined } : o))
      }
    } finally {
      setClosingIds(prev => {
        const next = new Set(prev)
        next.delete(orderId)
        return next
      })
    }
  }

  const handleMoveAllDoneToClosed = async () => {
    if (closingAllDone) return
    const ids = categorized.done.map(o => o.id)
    if (ids.length === 0) return
    try {
      setClosingAllDone(true)
      await Promise.all(ids.map(id => setOrderState(id, 'closed')))
      setOrders(prev => prev.map(o => ids.includes(o.id) ? { ...o, state: 'closed', termination_message: undefined } : o))
    } finally {
      setClosingAllDone(false)
    }
  }

  const addressToSymbol = (address?: string) => {
    if (!address) return 'UNKNOWN'
    const lower = address.toLowerCase()
    if (ADDRESS_TO_SYMBOL[lower]) return ADDRESS_TO_SYMBOL[lower]
    if (lower === HYPE_ADDRESS.toLowerCase()) return 'HYPE'
    const found = TOKENS.find(t => t.address?.toLowerCase() === lower)
    return found?.symbol || address.slice(0, 6) + '...' + address.slice(-4)
  }

  // ---

  const timeframeToMs = (tf?: string): number | null => {
    if (!tf) return null
    const m = String(tf).toLowerCase().trim()
    if (m.endsWith('m')) return Number(m.replace('m', '')) * 60 * 1000
    if (m.endsWith('h')) return Number(m.replace('h', '')) * 60 * 60 * 1000
    if (m.endsWith('d')) return Number(m.replace('d', '')) * 24 * 60 * 60 * 1000
    return null
  }

  // Normalize seconds vs milliseconds timestamps
  const normalizeTimestamp = (ts: number): number => {
    return ts < 1e12 ? ts * 1000 : ts
  }

  const tfHuman = (tf?: string): string => {
    if (!tf) return ''
    const m = String(tf).toLowerCase()
    if (m.endsWith('m')) return `${m.replace('m', '')}min`
    return m
  }

  const formatDate = (ts: number) => {
    try {
      const d = new Date(ts)
      const day = d.getDate()
      const month = d.getMonth() + 1
      const year = d.getFullYear()
      const hh = String(d.getHours()).padStart(2, '0')
      const mm = String(d.getMinutes()).padStart(2, '0')
      const ss = String(d.getSeconds()).padStart(2, '0')
      return `${day}.${month}.${year}, ${hh}:${mm}:${ss}`
    } catch { return String(new Date(ts)) }
  }

  // Countdown is computed inline per order using created_at + timeframe

  const formatOrderSummary = (o: OrderOut) => {
    const inSym = addressToSymbol((o.swapData as any)?.inputToken)
    const inAmt = (o.swapData as any)?.inputAmount

    const outputs = ((o.swapData as any)?.outputs || []) as { token: string; percentage: number }[]
    const hasSplits = Array.isArray(outputs) && outputs.length > 0
    const outSym = addressToSymbol((o.swapData as any)?.outputToken)
    const outAmt = (o.swapData as any)?.outputAmount
    const legacyOutText = `${typeof outAmt !== 'undefined' ? formatAmount(outAmt) + ' ' : ''}${outSym}`
    const splitsText = hasSplits
      ? outputs.map(s => `${formatAmount(s.percentage)}% ${addressToSymbol(s.token)}`).join(' + ')
      : legacyOutText

    const od = (o as any).orderData || {}
    const trig = od.ohlcvTrigger || {}
    const tf = trig.timeframe || trig.interval || ''
    const source = (trig.source || 'close') as string
    const dir = (trig.trigger || trig.above) ? ((trig.trigger === 'above' || trig.above) ? 'above' : 'below') : ''
    const trigVal = trig.triggerValue ?? trig.threshold
    const pair = trig.pair || od.pair || ''
    const metricLabel = (() => {
      const s = (source || '').toLowerCase()
      if (s === 'close') return 'price'
      if (s === 'open') return 'open price'
      if (s === 'high') return 'high price'
      if (s === 'low') return 'low price'
      if (s === 'volume') return 'volume'
      if (s === 'trades') return 'trades'
      return s
    })()
    const usesDollar = ['price', 'open price', 'high price', 'low price', 'volume'].includes(metricLabel)
    const valueText = usesDollar ? `$${formatAmount(trigVal)}` : `${formatAmount(trigVal)}`
    const ruleText = (dir && trigVal && pair)
      ? `${pair} ${metricLabel} ${dir} ${valueText}`
      : ''

    const inVal = (priceCache[inSym]?.price || 0) * (Number(inAmt) || 0)
    const outVal = hasSplits
      ? outputs.reduce((sum, s) => {
          const sym = addressToSymbol(s.token)
          const pct = Number(s.percentage) || 0
          const val = (priceCache[sym]?.price || 0) * (Number(inAmt) || 0) * (pct / 100)
          return sum + val
        }, 0)
      : (priceCache[outSym]?.price || 0) * (Number(outAmt) || 0)

    return {
      inSym, inAmt, outText: splitsText, tf, source, dir, trigVal, pair, inVal, outVal,
      ruleText,
      tfLabel: tfHuman(tf),
      whenText: formatDate(normalizeTimestamp(o.time)),
      lifetime: trig.lifetime || '',
    }
  }

  const formatAmount = (amount: number | string) => {
    try {
      const num = Number(amount)
      if (!isFinite(num)) return String(amount)
      return new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(num).replace(/,/g, ' ')
    } catch { return String(amount) }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      <div className={!authenticated && ready && showConnectPrompt ? "blur-sm" : ""}>
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
                      <div key={o.id} className="border rounded-lg p-3 bg-blue-500/10 border-blue-500/20">
                        <div className="flex items-center justify-between">
                          <div className="text-foreground font-medium">
                            {formatAmount(s.inAmt)} {s.inSym} → {s.outText}
                          </div>
                          {s.ruleText && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {s.ruleText}
                            </div>
                          )}
                          <Badge variant="outline" className="bg-blue-500/10 border-blue-500/40 text-blue-500">open</Badge>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1">
                          {(() => {
                            const lifetimeMs = timeframeToMs(s.lifetime)
                            if (!lifetimeMs) return `#${o.id} • ${s.whenText}`
                            const created = normalizeTimestamp(o.time)
                            const expiresAt = created + lifetimeMs
                            const remMs = Math.max(0, expiresAt - now)
                            const totalSeconds = Math.floor(remMs / 1000)
                            const hours = Math.floor(totalSeconds / 3600)
                            const minutes = Math.floor((totalSeconds % 3600) / 60)
                            const seconds = totalSeconds % 60
                            const oneDayMs = 24 * 60 * 60 * 1000
                            if (remMs < oneDayMs) {
                              const cd = hours > 0
                                ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
                                : `${minutes}:${String(seconds).padStart(2, '0')}`
                              return `#${o.id} • ${s.whenText}: expires in ${cd}`
                            }
                            return `#${o.id} • expires on ${formatDate(expiresAt)}`
                          })()}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <Separator className="my-4" />

            {/* Done */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-foreground">Done ({categorized.done.length})</div>
                {categorized.done.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleMoveAllDoneToClosed}
                    disabled={closingAllDone}
                    className="cursor-pointer"
                  >
                    {closingAllDone ? 'Moving…' : 'Move all to closed'}
                  </Button>
                )}
              </div>
              {categorized.done.length === 0 ? (
                <div className="text-muted-foreground text-sm">No recently closed orders</div>
              ) : (
                <div className="space-y-2">
                  {categorized.done.map(o => (
                    <div key={o.id} className="border rounded-lg p-3 bg-yellow-500/10 border-yellow-500/20">
                      <div className="flex items-center justify-between">
                        <div className="text-foreground font-medium">
                          {formatAmount((o.swapData as any).inputAmount)} {addressToSymbol((o.swapData as any).inputToken)} → {(() => {
                            const outputs = ((o.swapData as any)?.outputs || []) as { token: string; percentage: number }[]
                            if (Array.isArray(outputs) && outputs.length > 0) {
                              return outputs.map(s => `${formatAmount(s.percentage)}% ${addressToSymbol(s.token)}`).join(' + ')
                            }
                            const outSym = addressToSymbol((o.swapData as any)?.outputToken)
                            const outAmt = (o.swapData as any)?.outputAmount
                            return `${typeof outAmt !== 'undefined' ? formatAmount(outAmt) + ' ' : ''}${outSym}`
                          })()}
                        </div>
                        {(() => {
                          const od = (o as any).orderData || {}
                          const trig = od.ohlcvTrigger || {}
                          const tf = trig.timeframe || trig.interval || ''
                          const source = (trig.source || 'close') as string
                          const dir = (trig.trigger || trig.above) ? ((trig.trigger === 'above' || trig.above) ? 'above' : 'below') : ''
                          const trigVal = trig.triggerValue ?? trig.threshold
                          const pair = trig.pair || od.pair || ''
                          const metricLabel = (() => {
                            const s = (source || '').toLowerCase()
                            if (s === 'close') return 'price'
                            if (s === 'open') return 'open price'
                            if (s === 'high') return 'high price'
                            if (s === 'low') return 'low price'
                            if (s === 'volume') return 'volume'
                            if (s === 'trades') return 'trades'
                            return s
                          })()
                          const usesDollar = ['price', 'open price', 'high price', 'low price', 'volume'].includes(metricLabel)
                          const valueText = usesDollar ? `$${formatAmount(trigVal)}` : `${formatAmount(trigVal)}`
                          const ruleText = (dir && trigVal && pair)
                            ? `${pair} ${metricLabel} ${dir} ${valueText}`
                            : ''
                          return ruleText ? (
                            <div className="text-xs text-muted-foreground mt-1">{ruleText}</div>
                          ) : null
                        })()}
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-yellow-500/10 border-yellow-500/40 text-yellow-500">done</Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleMoveOneToClosed(o.id)}
                            disabled={closingIds.has(o.id)}
                            className="cursor-pointer"
                          >
                            {closingIds.has(o.id) ? 'Moving…' : 'Move to closed'}
                          </Button>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">#{o.id} • {new Date(o.time).toLocaleString()}{o.termination_message ? ` • ${o.termination_message}` : ''}</div>
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
                <div className="flex items-center gap-2">
                  {showClosed && (
                    <Button variant="outline" size="sm" onClick={() => setHideCanceledClosed(v => !v)} className="cursor-pointer">
                      {hideCanceledClosed ? 'Show canceled' : 'Hide canceled'}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setShowClosed(v => !v)} className="cursor-pointer">
                    {showClosed ? <>Hide <ChevronUp className="w-4 h-4 ml-1" /></> : <>Show <ChevronDown className="w-4 h-4 ml-1" /></>}
                  </Button>
                </div>
              </div>
              {showClosed && (
                categorized.closed.length === 0 ? (
                  <div className="text-muted-foreground text-sm">No closed orders</div>
                ) : (
                  <div className="space-y-2">
                    {(hideCanceledClosed ? categorized.closed.filter(o => !o.termination_message) : categorized.closed).map(o => (
                      <div key={o.id} className={`border rounded-lg p-3 ${o.termination_message ? 'bg-red-500/10 border-red-500/20' : 'bg-green-500/10 border-green-500/20'}`}>
                        <div className="flex items-center justify-between">
                          <div className="text-foreground font-medium">
                            {formatAmount((o.swapData as any).inputAmount)} {addressToSymbol((o.swapData as any).inputToken)} → {(() => {
                              const outputs = ((o.swapData as any)?.outputs || []) as { token: string; percentage: number }[]
                              if (Array.isArray(outputs) && outputs.length > 0) {
                                return outputs.map(s => `${formatAmount(s.percentage)}% ${addressToSymbol(s.token)}`).join(' + ')
                              }
                              const outSym = addressToSymbol((o.swapData as any)?.outputToken)
                              const outAmt = (o.swapData as any)?.outputAmount
                              return `${typeof outAmt !== 'undefined' ? formatAmount(outAmt) + ' ' : ''}${outSym}`
                            })()}
                          </div>
                          {(() => {
                            const od = (o as any).orderData || {}
                            const trig = od.ohlcvTrigger || {}
                            const tf = trig.timeframe || trig.interval || ''
                            const source = (trig.source || 'close') as string
                            const dir = (trig.trigger || trig.above) ? ((trig.trigger === 'above' || trig.above) ? 'above' : 'below') : ''
                            const trigVal = trig.triggerValue ?? trig.threshold
                            const pair = trig.pair || od.pair || ''
                            const metricLabel = (() => {
                              const s = (source || '').toLowerCase()
                              if (s === 'close') return 'price'
                              if (s === 'open') return 'open price'
                              if (s === 'high') return 'high price'
                              if (s === 'low') return 'low price'
                              if (s === 'volume') return 'volume'
                              if (s === 'trades') return 'trades'
                              return ''
                            })()
                            const usesDollar = ['price', 'open price', 'high price', 'low price', 'volume'].includes(metricLabel)
                            const valueText = usesDollar ? `$${formatAmount(trigVal)}` : `${formatAmount(trigVal)}`
                            const ruleText = (dir && trigVal && pair)
                              ? `${pair} ${metricLabel} ${dir} ${valueText}`
                              : ''
                            return ruleText ? (
                              <div className="text-xs text-muted-foreground mt-1">{ruleText}</div>
                            ) : null
                          })()}
                          <Badge variant="outline" className={`${o.termination_message ? 'bg-red-500/10 border-red-500/40 text-red-500' : 'bg-green-500/10 border-green-500/40 text-green-500'}`}>closed</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">#{o.id} • {new Date(o.time).toLocaleString()}{o.termination_message ? ` • ${o.termination_message}` : ''}</div>
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
                        const price = priceCache[t.symbol]?.price ?? 0
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

      {!authenticated && ready && showConnectPrompt && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card border border-border/50 rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center space-y-6">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <Wallet className="w-8 h-8 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-foreground">Connect Your Wallet</h3>
                <p className="text-muted-foreground">Please connect your wallet to view your portfolio and orders.</p>
              </div>
              <div className="space-y-3">
                <Button 
                  onClick={login}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg cursor-pointer"
                >
                  Connect Wallet
                  <Wallet className="w-4 w-4 ml-2" />
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowConnectPrompt(false)}
                  className="w-full border-border/50 cursor-pointer"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

