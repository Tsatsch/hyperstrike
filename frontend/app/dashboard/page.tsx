"use client"

import { useEffect, useMemo, useState } from "react"
import { usePrivy } from '@privy-io/react-auth'
import { exchangePrivyForBackendJwt, getBackendJwt, listOrders, getUserXp, setOrderState } from '@/lib/api'
import { fetchTokenBalances, fetchHYPEBalance } from '@/lib/token-balances'
import { HYPERLIQUID_TOKENS, DEFAULT_TOKEN_PRICES, getNativeToken, getTokenBySymbol } from '@/lib/tokens'
import { updateAllTokenPrices } from '@/lib/hyperliquid-prices'
import { 
  getCoreAccount, 
  getCorePerpPositions, 
  getCoreSpotBalances, 
  HypercoreAccountSummary,
  HypercorePerpPosition,
  HypercoreSpotBalance
} from '@/lib/hypercore'

import { Button } from "@/components/ui/button"
 
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
 
import { Separator } from "@/components/ui/separator"
import { Activity, Wallet, ChevronDown, ChevronUp } from "lucide-react"
import { WalletButton } from "@/components/WalletButton"
import { ThemeToggle } from "@/components/theme-toggle"
import { XpButton } from "@/components/XpButton"
import { Footer } from "@/components/footer"
import { Logo } from "@/components/Logo"

type OrderState = "open" | "deleted" | "done_successful" | "done_failed" | "successful" | "failed"

interface OrderOut {
  id: number
  user_id: number
  wallet: string
  platform: string
  swap_data: {
    input_token: string
    input_amount: number
    output_token?: string
    output_amount?: number
    outputs?: { token: string; percentage: number }[]
  }
  order_data?: {
    type: string
    ohlcv_trigger?: {
      pair: string
      timeframe: string
      first_source: {
        type: string
        source?: string
        indicator?: string
        parameters?: {
          length: number
          OHLC_source: string
          std_dev?: number
        }
      }
      trigger_when: string
      second_source: {
        type: string
        value?: number
        indicator?: string
        parameters?: {
          length: number
          OHLC_source: string
          std_dev?: number
        }
      }
      cooldown: {
        active: boolean
        value?: number
      }
      chained_confirmation: {
        active: boolean
      }
      invalidation_halt: {
        active: boolean
      }
      lifetime?: string
    }
    wallet_activity?: {
      type: string
      wallet_activity?: any
    }
  }
  signature?: string
  time: number
  state: "open" | "deleted" | "done_successful" | "done_failed" | "successful" | "failed"
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
    // (Legacy) Previously marked newly closed orders as "done" briefly; no-op with new states
    const closedNow: number[] = []
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

export default function DashboardPage() {
  const { ready, authenticated, user, getAccessToken, login } = usePrivy()
  const [orders, setOrders] = useState<OrderOut[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [balances, setBalances] = useState<Record<string, string>>({})
  const [loadingBalances, setLoadingBalances] = useState(false)
  const [loadingCore, setLoadingCore] = useState(false)
  const [coreAccount, setCoreAccount] = useState<HypercoreAccountSummary | null>(null)
  const [corePerps, setCorePerps] = useState<HypercorePerpPosition[]>([])
  const [coreSpots, setCoreSpots] = useState<HypercoreSpotBalance[]>([])
  const [showClosed, setShowClosed] = useState(false)
  const [xp, setXp] = useState<number>(0)
  const [showConnectPrompt, setShowConnectPrompt] = useState(false)
  const [hideCanceledClosed, setHideCanceledClosed] = useState(false)
  const [priceCache, setPriceCache] = useState<Record<string, { price: number; change24h: number }>>(DEFAULT_TOKEN_PRICES)
  const [now, setNow] = useState<number>(Date.now())
  const [closingAllDone, setClosingAllDone] = useState(false)
  const [closingIds, setClosingIds] = useState<Set<number>>(new Set())
  const [showAllTokens, setShowAllTokens] = useState(false)
  const [cancellingIds, setCancellingIds] = useState<Set<number>>(new Set())
  const [confirmCancelIds, setConfirmCancelIds] = useState<Set<number>>(new Set())

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

  // Fetch HyperCore account, spot, and perps (MAINNET)
  useEffect(() => {
    const run = async () => {
      if (!authenticated || !user?.wallet?.address) return
      setLoadingCore(true)
      try {
        const [acct, perps, spots] = await Promise.all([
          getCoreAccount(user.wallet.address),
          getCorePerpPositions(user.wallet.address),
          getCoreSpotBalances(user.wallet.address)
        ])
        setCoreAccount(acct)
        setCorePerps(Array.isArray(perps) ? perps : [])
        setCoreSpots(Array.isArray(spots) ? spots : [])
      } catch {
        setCoreAccount(null)
        setCorePerps([])
        setCoreSpots([])
      } finally {
        setLoadingCore(false)
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
        console.warn('Error fetching dashboard prices:', error)
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
      else if (o.state === 'done_successful' || o.state === 'done_failed') done.push(o)
      else if (o.state === 'successful' || o.state === 'failed') closed.push(o)
    }
    return { open, done, closed }
  }, [orders])

  const handleMoveOneToClosed = async (orderId: number) => {
    try {
      setClosingIds(prev => new Set(prev).add(orderId))
      const current = orders.find(o => o.id === orderId)
      const nextState: OrderState | null = current?.state === 'done_successful' ? 'successful' : (current?.state === 'done_failed' ? 'failed' : null)
      if (!nextState) return
      const ok = await setOrderState(orderId, nextState)
      if (ok) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, state: nextState } : o))
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
      await Promise.all(categorized.done.map(o => {
        const nextState: OrderState = o.state === 'done_successful' ? 'successful' : 'failed'
        return setOrderState(o.id, nextState)
      }))
      setOrders(prev => prev.map(o => {
        if (!ids.includes(o.id)) return o
        const nextState: OrderState = o.state === 'done_successful' ? 'successful' : 'failed'
        return { ...o, state: nextState }
      }))
    } finally {
      setClosingAllDone(false)
    }
  }

  const requestOnChainAllowanceDecrease = async (order: OrderOut) => {
    try {
      // Placeholder for future on-chain allowance decrease per order
      console.warn('On-chain allowance decrease not implemented yet for order', order.id)
    } catch (e) {
      console.warn('Allowance decrease placeholder error:', e)
    }
  }

  const handleCancelOpenOrder = async (order: OrderOut) => {
    if (!order || order.state !== 'open') return
    try {
      setCancellingIds(prev => new Set(prev).add(order.id))
      const ok = await setOrderState(order.id, 'failed', 'Canceled')
      if (ok) {
        setOrders(prev => prev.map(o => o.id === order.id ? { ...o, state: 'failed', termination_message: 'Canceled' } : o))
        // Fire-and-forget placeholder for future on-chain action
        requestOnChainAllowanceDecrease(order)
      }
    } finally {
      setCancellingIds(prev => {
        const next = new Set(prev)
        next.delete(order.id)
        return next
      })
      setConfirmCancelIds(prev => {
        const next = new Set(prev)
        next.delete(order.id)
        return next
      })
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

  // Map HyperCore symbols to our internal symbol set for price lookup
  const toInternalSymbol = (sym: string): string => {
    const s = (sym || '').toUpperCase()
    if (s === 'ETH') return 'UETH'
    if (s === 'BTC') return 'UBTC'
    if (s === 'SOL') return 'USOL'
    if (s === 'USDE' || s === 'USDE.E' || s === 'USDEUSD') return 'USDE'
    if (s === 'FART') return 'UFART'
    return s
  }

  const getDisplayNameForSymbol = (sym: string): string => {
    const cfg = getTokenBySymbol(sym)
    if (cfg?.name) return cfg.name
    if (sym.toUpperCase() === 'USDC') return 'USD Coin'
    return sym
  }

  const formatAmount4 = (num: number): string => {
    if (!isFinite(num)) return '0.0000'
    const truncated = Math.trunc(num * 10000) / 10000
    return truncated.toFixed(4)
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
    const inSym = addressToSymbol(o.swap_data?.input_token)
    const inAmt = o.swap_data?.input_amount

    const outputs = (o.swap_data?.outputs || []) as { token: string; percentage: number }[]
    const hasSplits = Array.isArray(outputs) && outputs.length > 0
    const outSym = addressToSymbol(o.swap_data?.output_token)
    const outAmt = o.swap_data?.output_amount
    const legacyOutText = `${typeof outAmt !== 'undefined' ? formatAmount(outAmt) + ' ' : ''}${outSym}`
    const splitsText = hasSplits
      ? outputs.map(s => `${formatAmount(s.percentage)}% ${addressToSymbol(s.token)}`).join(' + ')
      : legacyOutText

    const od = o.order_data || {} as any
    const trig = od.ohlcv_trigger || {}
    const tf = trig.timeframe || ''
    const source = (trig.first_source?.source || 'close') as string
    const dir = trig.trigger_when || ''
    const trigVal = trig.second_source?.value || 0
    const pair = trig.pair || ''
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
              <a href="/dashboard" className="font-medium text-primary">Dashboard</a>
              <a href="/trade" className="text-muted-foreground hover:text-foreground transition-colors">Trade</a>
              <a href="/docs" className="text-muted-foreground hover:text-foreground transition-colors">Docs</a>
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
          <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Your balances on Hyperliquid and your pending/closed orders</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Orders on the left (wider) */}
          <Card className="border-border/50 lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-foreground">Orders</CardTitle>
              <div className="text-xs text-muted-foreground flex flex-col items-end gap-1 text-right">
                <span className="flex items-center gap-2 whitespace-nowrap">
                  open
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500" />
                </span>
                <span className="flex items-center gap-2 whitespace-nowrap">
                  success
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" />
                </span>
                <span className="flex items-center gap-2 whitespace-nowrap">
                  failed
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />
                </span>
              </div>
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
                      <div key={o.id} className="relative group border rounded-lg p-3 bg-blue-500/10 border-blue-500/20">
                        <div className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-blue-500/30 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                        <div className="flex items-center justify-between">
                          <div className="text-foreground font-medium">
                            {formatAmount(s.inAmt)} {s.inSym} → {s.outText}
                          </div>
                          {(s.ruleText || s.tfLabel) && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {s.ruleText}
                              {s.tfLabel ? (s.ruleText ? ' • ' : '') + `TF ${s.tfLabel}` : null}
                            </div>
                          )}
                          <Button
                            variant={confirmCancelIds.has(o.id) ? "destructive" : "outline"}
                            size="sm"
                            onClick={() => {
                              if (confirmCancelIds.has(o.id)) {
                                handleCancelOpenOrder(o)
                              } else {
                                setConfirmCancelIds(prev => new Set(prev).add(o.id))
                              }
                            }}
                            disabled={cancellingIds.has(o.id)}
                            className="cursor-pointer"
                          >
                            {cancellingIds.has(o.id) ? 'Canceling…' : (confirmCancelIds.has(o.id) ? 'Confirm cancel' : 'Cancel')}
                          </Button>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1">
                          {(() => {
                            const lifetimeMs = timeframeToMs(s.lifetime)
                            if (!lifetimeMs) return `#${o.id} • ${s.whenText}`
                            const created = normalizeTimestamp(o.time)
                            const expiresAt = created + lifetimeMs
                            const remMs = Math.max(0, expiresAt - now)
                            const oneDayMs = 24 * 60 * 60 * 1000
                            if (remMs > oneDayMs) {
                              return `#${o.id} • expires on ${formatDate(expiresAt)}`
                            }
                            const totalSeconds = Math.floor(remMs / 1000)
                            const hours = Math.floor(totalSeconds / 3600)
                            const minutes = Math.floor((totalSeconds % 3600) / 60)
                            const seconds = totalSeconds % 60
                            const cd = hours > 0
                              ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
                              : `${minutes}:${String(seconds).padStart(2, '0')}`
                            return `#${o.id} • ${s.whenText}: expires in ${cd}`
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
                    <div
                      key={o.id}
                      className={`relative group border rounded-lg p-3 ${o.state === 'done_failed' ? 'bg-red-500/10 border-red-500/20' : 'bg-green-500/10 border-green-500/20'}`}
                    >
                      {/* Animated background glow (box, not edges) */}
                      <div
                        className={`pointer-events-none absolute inset-0 rounded-lg ${o.state === 'done_failed' ? 'bg-red-500/15 shadow-[0_0_24px_rgba(239,68,68,0.25)]' : 'bg-green-500/15 shadow-[0_0_24px_rgba(34,197,94,0.25)]'} animate-[pulse_2.4s_cubic-bezier(0.4,0,0.6,1)_infinite] transition-opacity duration-100 ease-out group-hover:opacity-0`}
                      />
                      {/* Static background on hover for readability */}
                      <div
                        className={`pointer-events-none absolute inset-0 rounded-lg ${o.state === 'done_failed' ? 'bg-red-500/15 shadow-[0_0_20px_rgba(239,68,68,0.2)]' : 'bg-green-500/15 shadow-[0_0_20px_rgba(34,197,94,0.2)]'} opacity-0 transition-opacity duration-100 ease-out group-hover:opacity-100`}
                      />
                      {/* Edge highlight on hover only */}
                      <div
                        className={`pointer-events-none absolute inset-0 rounded-lg ${o.state === 'done_failed' ? 'ring-2 ring-red-500/35' : 'ring-2 ring-green-500/35'} opacity-0 transition-opacity duration-150 group-hover:opacity-100`}
                      />
                      <div className="flex items-center justify-between">
                        <div className="text-foreground font-medium">
                          {formatAmount(o.swap_data?.input_amount)} {addressToSymbol(o.swap_data?.input_token)} → {(() => {
                            const outputs = (o.swap_data?.outputs || []) as { token: string; percentage: number }[]
                            if (Array.isArray(outputs) && outputs.length > 0) {
                              return outputs.map(s => `${formatAmount(s.percentage)}% ${addressToSymbol(s.token)}`).join(' + ')
                            }
                            const outSym = addressToSymbol(o.swap_data?.output_token)
                            const outAmt = o.swap_data?.output_amount
                            return `${typeof outAmt !== 'undefined' ? formatAmount(outAmt) + ' ' : ''}${outSym}`
                          })()}
                        </div>
                        {(() => {
                          const od = o.order_data || {} as any
                          const trig = od.ohlcv_trigger || {}
                          const tf = trig.timeframe || ''
                          const source = (trig.first_source?.source || 'close') as string
                          const dir = trig.trigger_when || ''
                          const trigVal = trig.second_source?.value || 0
                          const pair = trig.pair || ''
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
                          const tfLabel = tfHuman(tf)
                          const hasInfo = !!ruleText || !!tfLabel
                          return hasInfo ? (
                            <div className="text-xs text-muted-foreground mt-1">
                              {ruleText}
                              {tfLabel ? (ruleText ? ' • ' : '') + `TF ${tfLabel}` : null}
                            </div>
                          ) : null
                        })()}
                        <div className="flex items-center gap-2">
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
                    {(hideCanceledClosed ? categorized.closed.filter(o => o.state === 'successful') : categorized.closed).map(o => (
                      <div key={o.id} className={`relative group border rounded-lg p-3 ${o.state === 'failed' ? 'bg-red-500/10 border-red-500/20' : 'bg-green-500/10 border-green-500/20'}`}>
                        <div className={`pointer-events-none absolute inset-0 rounded-lg ${o.state === 'failed' ? 'ring-2 ring-red-500/30' : 'ring-2 ring-green-500/30'} opacity-0 transition-opacity duration-150 group-hover:opacity-100`} />
                        <div className="flex items-center justify-between">
                          <div className="text-foreground font-medium">
                            {formatAmount(o.swap_data?.input_amount)} {addressToSymbol(o.swap_data?.input_token)} → {(() => {
                              const outputs = (o.swap_data?.outputs || []) as { token: string; percentage: number }[]
                              if (Array.isArray(outputs) && outputs.length > 0) {
                                return outputs.map(s => `${formatAmount(s.percentage)}% ${addressToSymbol(s.token)}`).join(' + ')
                              }
                              const outSym = addressToSymbol(o.swap_data?.output_token)
                              const outAmt = o.swap_data?.output_amount
                              return `${typeof outAmt !== 'undefined' ? formatAmount(outAmt) + ' ' : ''}${outSym}`
                            })()}
                          </div>
                          {(() => {
                            const od = o.order_data || {} as any
                            const trig = od.ohlcv_trigger || {}
                            const tf = trig.timeframe || ''
                            const source = (trig.first_source?.source || 'close') as string
                            const dir = trig.trigger_when || ''
                            const trigVal = trig.second_source?.value || 0
                            const pair = trig.pair || ''
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
                            const tfLabel = tfHuman(tf)
                            const hasInfo = !!ruleText || !!tfLabel
                            return hasInfo ? (
                              <div className="text-xs text-muted-foreground mt-1">
                                {ruleText}
                                {tfLabel ? (ruleText ? ' • ' : '') + `TF ${tfLabel}` : null}
                              </div>
                            ) : null
                          })()}
                          
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
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-foreground">Your Tokens (EVM)</CardTitle>
                  <CardDescription>HyperEVM balances</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => (window.location.href = '/docs')}
                  className="cursor-pointer"
                >
                  Tradable Assets
                </Button>
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
                      const rowsAll = TOKENS
                        .map((t) => {
                          const balanceStr = t.symbol === 'HYPE'
                            ? balances['0x2222222222222222222222222222222222222222']
                            : (t.address ? balances[t.address] : undefined)
                          const balanceNum = parseFloat(balanceStr || '0') || 0
                          const price = priceCache[t.symbol]?.price ?? 0
                          const valueUsd = balanceNum * price
                          return { token: t, balanceStr: (balanceStr ?? '0'), balanceNum, price, valueUsd }
                        })
                        .sort((a, b) => b.valueUsd - a.valueUsd)

                      // Only show tokens that the user holds (balance > 0)
                      const rows = rowsAll.filter(r => r.balanceNum > 0)

                      const visible = showAllTokens ? rows : rows.slice(0, 6)

                      return (
                        <>
                          {visible.map(({ token: t, balanceStr, valueUsd }) => (
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
                                <div className="text-[10px] text-muted-foreground">{formatAmount4(parseFloat(balanceStr || '0') || 0)}</div>
                              </div>
                            </div>
                          ))}
                          {rows.length > 6 && (
                            <Button
                              key="toggle"
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowAllTokens(v => !v)}
                              className="w-full cursor-pointer"
                            >
                              {showAllTokens ? <>Hide <ChevronUp className="w-4 h-4 ml-1" /></> : <>Show <ChevronDown className="w-4 h-4 ml-1" /></>}
                            </Button>
                          )}
                        </>
                      )
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* HyperCore Spot */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-foreground">HyperCore Spot</CardTitle>
                <CardDescription>Balances on Core</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingCore ? (
                  <div className="text-center py-6">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    <p className="text-muted-foreground mt-2 text-sm">Loading…</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(() => {
                      const rows = (coreSpots || [])
                        .map(s => {
                          const symbol = toInternalSymbol(s.symbol)
                          const price = priceCache[symbol]?.price ?? (symbol === 'USDC' ? 1 : 0)
                          const amountNum = Number(s.balance) || 0
                          const valueUsd = amountNum * price
                          return { symbol, amountNum, valueUsd }
                        })
                        .filter(r => r.amountNum > 0)
                        .sort((a, b) => b.valueUsd - a.valueUsd)
                      if (rows.length === 0) return (
                        <div className="text-muted-foreground text-sm">No spot balances</div>
                      )
                      return rows.map((r, idx) => {
                        const cfg = getTokenBySymbol(r.symbol)
                        return (
                          <div key={`${r.symbol}-${idx}`} className="flex items-center justify-between border border-border/50 rounded-lg px-3 py-2">
                            <div className="flex items-center space-x-2">
                              {(() => {
                                const icon = cfg?.icon || (r.symbol === 'USDC' ? 'https://app.hyperliquid.xyz/coins/USDT_USDC.svg' : '')
                                return icon ? (
                                  <img src={icon} alt={r.symbol} className="w-5 h-5 rounded-full" loading="eager" width={20} height={20} />
                                ) : null
                              })()}
                              <div>
                                <div className="text-foreground text-sm font-medium">{r.symbol}</div>
                                <div className="text-[10px] text-muted-foreground">{cfg?.name || (r.symbol === 'USDC' ? 'USD Coin' : r.symbol)}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-foreground text-sm font-semibold">${r.valueUsd.toFixed(2)}</div>
                              <div className="text-[10px] text-muted-foreground">{formatAmount4(r.amountNum)}</div>
                            </div>
                          </div>
                        )
                      })
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* HyperCore Perps */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-foreground">HyperCore Perps</CardTitle>
                <CardDescription>Open positions on Core</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingCore ? (
                  <div className="text-center py-6">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    <p className="text-muted-foreground mt-2 text-sm">Loading…</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {typeof coreAccount?.availableBalance === 'number' && coreAccount.availableBalance > 0 && (() => {
                      const sym = 'USDC'
                      const amountNum = Number(coreAccount.availableBalance) || 0
                      const cfg = getTokenBySymbol(sym)
                      return (
                        <div key={`perps-available-${sym}`} className="flex items-center justify-between border border-border/50 rounded-lg px-3 py-2">
                          <div className="flex items-center space-x-2">
                            {(() => {
                              const icon = cfg?.icon || 'https://app.hyperliquid.xyz/coins/USDT_USDC.svg'
                              return icon ? (
                                <img src={icon} alt={sym} className="w-5 h-5 rounded-full" loading="eager" width={20} height={20} />
                              ) : null
                            })()}
                            <div>
                              <div className="text-foreground text-sm font-medium">{sym}</div>
                              <div className="text-[10px] text-muted-foreground">{cfg?.name || 'USD Coin'}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-foreground text-sm font-semibold">${amountNum.toFixed(2)}</div>
                            <div className="text-[10px] text-muted-foreground">{formatAmount4(amountNum)}</div>
                          </div>
                        </div>
                      )
                    })()}
                    {(() => {
                      const rows = (corePerps || [])
                        .map(p => {
                          // Display notional in USD = |size| * price
                          const baseSym = toInternalSymbol(String(p.asset || '').replace('-PERP', '').replace('/USDC', ''))
                          const price = priceCache[baseSym]?.price ?? 0
                          const sizeNum = Number(p.size) || 0
                          const valueUsd = Math.abs(sizeNum) * price
                          return { symbol: String(p.asset || baseSym), sizeNum, valueUsd }
                        })
                        .filter(r => r.sizeNum !== 0)
                        .sort((a, b) => b.valueUsd - a.valueUsd)
                      if (rows.length === 0) return (
                        <div className="text-muted-foreground text-sm">No open perps positions</div>
                      )
                      return rows.map((r, idx) => {
                        const sym = String(r.symbol)
                        const base = toInternalSymbol(sym.replace('-PERP', '').replace('/USDC', ''))
                        const cfg = getTokenBySymbol(base)
                        return (
                          <div key={`${r.symbol}-${idx}`} className="flex items-center justify-between border border-border/50 rounded-lg px-3 py-2">
                            <div className="flex items-center space-x-2">
                              {(() => {
                                const icon = cfg?.icon || (base === 'USDC' ? 'https://app.hyperliquid.xyz/coins/USDT_USDC.svg' : '')
                                return icon ? (
                                  <img src={icon} alt={sym} className="w-5 h-5 rounded-full" loading="eager" width={20} height={20} />
                                ) : null
                              })()}
                              <div>
                                <div className="text-foreground text-sm font-medium">{sym}</div>
                                <div className="text-[10px] text-muted-foreground">{cfg?.name || (base === 'USDC' ? 'USD Coin' : base)}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-foreground text-sm font-semibold">${r.valueUsd.toFixed(2)}</div>
                              <div className="text-[10px] text-muted-foreground">{formatAmount4(r.sizeNum)}</div>
                            </div>
                          </div>
                        )
                      })
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
                <p className="text-muted-foreground">Please connect your wallet to view your dashboard and orders.</p>
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

 

