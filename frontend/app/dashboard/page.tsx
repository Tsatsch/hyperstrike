"use client"

import { useEffect, useMemo, useState } from "react"
import { usePrivy } from '@privy-io/react-auth'
import { exchangePrivyForBackendJwt, getBackendJwt, listOrders, listHyperCoreOrders, deleteHyperCoreOrder, getUserXp, setOrderState } from '@/lib/api'
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
import { resolveHlName, resolveHlProfile, type HlProfile } from '@/lib/hlnames'

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

interface HyperCoreOrder {
  id: number
  user_id: number
  user_wallet: string
  trigger_data: {
    value: number
    condition: string
    timeframe: string
    source: string
    pair: string
  }
  position_data: {
    side: string
    size: number
    leverage: number
    order_type: string
    limit_price?: number
    take_profit?: {
      price: number
      gain_value: number
      gain_type: string
    }
    stop_loss?: {
      price: number
      loss_value: number
      loss_type: string
    }
  }
  created_at: string
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
  const [hyperCoreOrders, setHyperCoreOrders] = useState<HyperCoreOrder[]>([])
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
  const [showAllCoreSpot, setShowAllCoreSpot] = useState(false)
  const [showAllCorePerps, setShowAllCorePerps] = useState(false)
  const [cancellingIds, setCancellingIds] = useState<Set<number>>(new Set())
  const [confirmCancelIds, setConfirmCancelIds] = useState<Set<number>>(new Set())
  const [hlName, setHlName] = useState<string | null>(null)
  const [hlProfile, setHlProfile] = useState<HlProfile | null>(null)

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
        
        // Fetch both HyperEVM and HyperCore orders
        const [evmData, coreData] = await Promise.all([
          listOrders().catch(() => []),
          listHyperCoreOrders().catch(() => [])
        ])
        
        setOrders(Array.isArray(evmData) ? evmData : [])
        setHyperCoreOrders(Array.isArray(coreData) ? coreData : [])
      } catch (e) {
        setOrders([])
        setHyperCoreOrders([])
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

  // Fetch HL name when user is authenticated
  useEffect(() => {
    const run = async () => {
      if (!authenticated || !user?.wallet?.address) {
        setHlName(null)
        return
      }
      try {
        const name = await resolveHlName(user.wallet.address)
        setHlName(name)
      } catch (error) {
        console.warn('Error fetching HL name:', error)
        setHlName(null)
      }
    }
    run()
  }, [authenticated, user?.wallet?.address])

  // Fetch full HL profile when user is authenticated
  useEffect(() => {
    const run = async () => {
      if (!authenticated || !user?.wallet?.address) {
        setHlProfile(null)
        return
      }
      try {
        const profile = await resolveHlProfile(user.wallet.address)
        setHlProfile(profile)
      } catch (error) {
        console.warn('Error fetching HL profile:', error)
        setHlProfile(null)
      }
    }
    run()
  }, [authenticated, user?.wallet?.address])

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
    const open: (OrderOut | HyperCoreOrder)[] = []
    const done: (OrderOut | HyperCoreOrder)[] = []
    const closed: (OrderOut | HyperCoreOrder)[] = []
    
    // Categorize HyperEVM orders
    for (const o of orders) {
      if (o.state === 'open') open.push(o)
      else if (o.state === 'done_successful' || o.state === 'done_failed') done.push(o)
      else if (o.state === 'successful' || o.state === 'failed') closed.push(o)
    }
    
    // Add HyperCore orders (all are considered "open" since they're pre-trigger)
    for (const o of hyperCoreOrders) {
      open.push(o)
    }
    
    return { open, done, closed }
  }, [orders, hyperCoreOrders])

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

  const handleDeleteHyperCoreOrder = async (order: HyperCoreOrder) => {
    try {
      setCancellingIds(prev => new Set(prev).add(order.id))
      const ok = await deleteHyperCoreOrder(order.id)
      if (ok) {
        setHyperCoreOrders(prev => prev.filter(o => o.id !== order.id))
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

  const formatOrderSummary = (o: OrderOut | HyperCoreOrder) => {
    // Handle HyperCore orders
    if ('trigger_data' in o) {
      const hc = o as HyperCoreOrder
      return {
        inAmt: hc.position_data.size,
        inSym: 'USDC',
        outText: `${hc.position_data.side.toUpperCase()} ${hc.trigger_data.pair}`,
        ruleText: `${hc.trigger_data.source} ${hc.trigger_data.condition} ${hc.trigger_data.value}`,
        tfLabel: hc.trigger_data.timeframe,
        whenText: 'Trigger',
        lifetime: '24h',
        platform: 'HyperCore'
      }
    }
    
    // Handle HyperEVM orders
    const evm = o as OrderOut
    const inSym = addressToSymbol(o.swap_data?.input_token)
    const inAmt = o.swap_data?.input_amount

    // For completed orders, prioritize actual outputs if available
    const actualOutputs = (o as any).actual_outputs
    let outText = ''
    
    // Get planned outputs for fallback
    const outputs = (o.swap_data?.outputs || []) as { token: string; percentage: number }[]
    const hasSplits = Array.isArray(outputs) && outputs.length > 0
    const outSym = addressToSymbol(o.swap_data?.output_token)
    const outAmt = o.swap_data?.output_amount
    
    if (actualOutputs && Array.isArray(actualOutputs) && actualOutputs.length > 0) {
      // Show actual executed outputs
      outText = actualOutputs.map((output: any) => 
        `${formatAmount(output.amount)} ${addressToSymbol(output.token)}`
      ).join(' + ')
    } else {
      // Fallback to planned outputs
      if (hasSplits) {
        outText = outputs.map(s => `${formatAmount(s.percentage)}% ${addressToSymbol(s.token)}`).join(' + ')
      } else {
        outText = `${typeof outAmt !== 'undefined' ? formatAmount(outAmt) + ' ' : ''}${outSym}`
      }
    }

    const od = o.order_data || {} as any
    const trig = od.ohlcv_trigger || {}
    const tf = trig.timeframe || ''
    const pair = trig.pair || ''
    
    // Build comprehensive trigger description
    const buildTriggerDescription = () => {
      if (!trig.first_source || !trig.trigger_when || !trig.second_source) return ''
      
      const firstSource = trig.first_source
      const secondSource = trig.second_source
      const triggerWhen = trig.trigger_when
      
      // First source description
      let firstSourceDesc = ''
      if (firstSource.type === 'OHLCV' && firstSource.source) {
        const sourceMap: Record<string, string> = {
          'close': 'close price',
          'open': 'open price', 
          'high': 'high price',
          'low': 'low price',
          'volume': 'volume',
          'trades': 'trades'
        }
        firstSourceDesc = sourceMap[firstSource.source.toLowerCase()] || firstSource.source
      } else if (firstSource.type === 'indicators' && firstSource.indicator) {
        firstSourceDesc = firstSource.indicator
        if (firstSource.parameters) {
          const params = firstSource.parameters
          if (params.length) {
            firstSourceDesc += `(${params.length}`
            if (params.OHLC_source && params.OHLC_source !== 'close') {
              firstSourceDesc += `, ${params.OHLC_source}`
            }
            if (params.std_dev) {
              firstSourceDesc += `, σ${params.std_dev}`
            }
            firstSourceDesc += ')'
          }
        }
      }
      
      // Second source description
      let secondSourceDesc = ''
      if (secondSource.type === 'value' && secondSource.value !== undefined) {
        const isPrice = ['close', 'open', 'high', 'low'].includes(firstSource.source?.toLowerCase() || '')
        secondSourceDesc = isPrice ? `$${formatAmount(secondSource.value)}` : formatAmount(secondSource.value)
      } else if (secondSource.type === 'indicators' && secondSource.indicator) {
        secondSourceDesc = secondSource.indicator
        if (secondSource.parameters) {
          const params = secondSource.parameters
          if (params.length) {
            secondSourceDesc += `(${params.length}`
            if (params.OHLC_source && params.OHLC_source !== 'close') {
              secondSourceDesc += `, ${params.OHLC_source}`
            }
            if (params.std_dev) {
              secondSourceDesc += `, σ${params.std_dev}`
            }
            secondSourceDesc += ')'
          }
        }
      }
      
      // Build the complete description
      let description = `${pair} ${firstSourceDesc} ${triggerWhen} ${secondSourceDesc}`
      
      // Add additional trigger features
      const features: string[] = []
      
      if (trig.cooldown?.active && trig.cooldown.value) {
        features.push(`${trig.cooldown.value}min cooldown`)
      }
      
      if (trig.chained_confirmation?.active && trig.chained_confirmation.bars) {
        features.push(`${trig.chained_confirmation.bars} bar confirmation`)
      }
      
      if (trig.invalidation_halt?.active) {
        features.push('invalidation halt')
      }
      
      if (features.length > 0) {
        description += ` • ${features.join(', ')}`
      }
      
      return description
    }
    
    const ruleText = buildTriggerDescription()

    const inVal = (priceCache[inSym]?.price || 0) * (Number(inAmt) || 0)
    
    // Calculate outVal based on actual outputs or planned outputs
    let outVal = 0
    if (actualOutputs && Array.isArray(actualOutputs) && actualOutputs.length > 0) {
      // Use actual outputs for value calculation
      outVal = actualOutputs.reduce((sum: number, s: any) => {
        const sym = addressToSymbol(s.token)
        const val = (priceCache[sym]?.price || 0) * (Number(s.amount) || 0)
        return sum + val
      }, 0)
    } else {
      // Fallback to planned outputs
      const outputs = (o.swap_data?.outputs || []) as { token: string; percentage: number }[]
      const hasSplits = Array.isArray(outputs) && outputs.length > 0
      const outSym = addressToSymbol(o.swap_data?.output_token)
      const outAmt = o.swap_data?.output_amount
      
      if (hasSplits) {
        outVal = outputs.reduce((sum: number, s: any) => {
          const sym = addressToSymbol(s.token)
          const pct = Number(s.percentage) || 0
          const val = (priceCache[sym]?.price || 0) * (Number(inAmt) || 0) * (pct / 100)
          return sum + val
        }, 0)
      } else {
        outVal = (priceCache[outSym]?.price || 0) * (Number(outAmt) || 0)
      }
    }

    return {
      inSym, inAmt, outText, tf, pair, inVal, outVal,
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
              <span className="text-xl font-bold">Hypertick</span>
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
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {(() => {
              // Priority 1: "Name" key from profile texts (highest priority)
              if (hlProfile?.texts?.Name) {
                return `${hlProfile.texts.Name}'s Dashboard`
              }
              // Priority 2: .hl domain name
              if (hlName) {
                return `${hlName}'s Dashboard`
              }
              // Priority 3: Default fallback
              return 'Dashboard'
            })()}
          </h1>
          <p className="text-muted-foreground">Your balances on Hyperliquid and your pending/closed orders</p>
        </div>

        {/* Balances Row - EVM ↔ Spot ↔ Perps */}
        <div className="flex items-stretch gap-4 mb-8">
          {/* EVM Tokens */}
          <Card className="border-border/50 flex-1 flex flex-col">
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
            <CardContent className="flex-1">
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

                    const visible = showAllTokens ? rows : rows.slice(0, 4)

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
                        {rows.length > 4 && (
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

          {/* Swap Arrow: EVM ↔ Spot */}
          <div className="flex flex-col items-center justify-center">
            <Button
              size="sm"
              className="w-10 h-10 p-0 rounded-full bg-primary hover:bg-primary/90 transition-all duration-200 cursor-pointer"
            >
              <svg className="w-4 h-4 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </Button>
          </div>

          {/* HyperCore Spot */}
          <Card className="border-border/50 flex-1 flex flex-col">
            <CardHeader>
              <CardTitle className="text-foreground">HyperCore Spot</CardTitle>
              <CardDescription>Balances on Core</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
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
                    
                    const visible = showAllCoreSpot ? rows : rows.slice(0, 4)
                    
                    return (
                      <>
                        {visible.map((r, idx) => {
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
                        })}
                        {rows.length > 4 && (
                          <Button
                            key="toggle-core-spot"
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowAllCoreSpot(v => !v)}
                            className="w-full cursor-pointer"
                          >
                            {showAllCoreSpot ? <>Hide <ChevronUp className="w-4 h-4 ml-1" /></> : <>Show <ChevronDown className="w-4 h-4 ml-1" /></>}
                          </Button>
                        )}
                      </>
                    )
                  })()}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Swap Arrow: Spot ↔ Perps */}
          <div className="flex flex-col items-center justify-center">
            <Button
              size="sm"
              className="w-10 h-10 p-0 rounded-full bg-primary hover:bg-primary/90 transition-all duration-200 cursor-pointer"
            >
              <svg className="w-4 h-4 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </Button>
          </div>

          {/* HyperCore Perps */}
          <Card className="border-border/50 flex-1 flex flex-col">
            <CardHeader>
              <CardTitle className="text-foreground">HyperCore Perps</CardTitle>
              <CardDescription>Open positions on Core</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
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
                    
                    const visible = showAllCorePerps ? rows : rows.slice(0, 4)
                    
                    return (
                      <>
                        {visible.map((r, idx) => {
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
                        })}
                        {rows.length > 4 && (
                          <Button
                            key="toggle-core-perps"
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowAllCorePerps(v => !v)}
                            className="w-full cursor-pointer"
                          >
                            {showAllCorePerps ? <>Hide <ChevronUp className="w-4 h-4 ml-1" /></> : <>Show <ChevronDown className="w-4 h-4 ml-1" /></>}
                          </Button>
                        )}
                      </>
                    )
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Orders Section */}
        <Card className="border-border/50 mb-8">
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
                    const isHyperCore = 'trigger_data' in o
                    
                    return (
                      <div key={o.id} className={`relative group border rounded-lg p-3 ${isHyperCore ? 'bg-green-500/10 border-green-500/20' : 'bg-blue-500/10 border-blue-500/20'}`}>
                        <div className={`pointer-events-none absolute inset-0 rounded-lg ring-2 ${isHyperCore ? 'ring-green-500/30' : 'ring-blue-500/30'} opacity-0 transition-opacity duration-150 group-hover:opacity-100`} />
                        <div className="grid grid-cols-3 gap-4 items-center">
                          {/* Column 1: Order details */}
                          <div className="text-foreground font-medium">
                            {formatAmount(s.inAmt)} {s.inSym} → {s.outText}
                          </div>
                          
                          {/* Column 2: Condition text (always centered) */}
                          <div className="text-center">
                            {(s.ruleText || s.tfLabel) && (
                              <div className="text-xs text-muted-foreground">
                                {s.ruleText}
                                {s.tfLabel ? (s.ruleText ? ' • ' : '') + `TF ${s.tfLabel}` : null}
                              </div>
                            )}
                          </div>
                          
                          {/* Column 3: Action buttons */}
                          <div className="flex justify-end">
                            {!isHyperCore ? (
                              <Button
                                variant={confirmCancelIds.has(o.id) ? "destructive" : "outline"}
                                size="sm"
                                onClick={() => {
                                  if (confirmCancelIds.has(o.id)) {
                                    handleCancelOpenOrder(o as OrderOut)
                                  } else {
                                    setConfirmCancelIds(prev => new Set(prev).add(o.id))
                                  }
                                }}
                                disabled={cancellingIds.has(o.id)}
                                className="cursor-pointer"
                              >
                                {cancellingIds.has(o.id) ? 'Canceling…' : (confirmCancelIds.has(o.id) ? 'Confirm cancel' : 'Cancel')}
                              </Button>
                            ) : (
                              <Button
                                variant={confirmCancelIds.has(o.id) ? "destructive" : "outline"}
                                size="sm"
                                onClick={() => {
                                  if (confirmCancelIds.has(o.id)) {
                                    handleDeleteHyperCoreOrder(o as HyperCoreOrder)
                                  } else {
                                    setConfirmCancelIds(prev => new Set(prev).add(o.id))
                                  }
                                }}
                                disabled={cancellingIds.has(o.id)}
                                className="cursor-pointer"
                              >
                                {cancellingIds.has(o.id) ? 'Deleting…' : (confirmCancelIds.has(o.id) ? 'Confirm delete' : 'Delete')}
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1">
                          {(() => {
                            if (isHyperCore) {
                              const hc = o as HyperCoreOrder
                              return `${hc.position_data.leverage}x • ${hc.position_data.order_type} • Created ${formatDate(new Date(hc.created_at).getTime())}`
                            }
                            
                            return `${s.whenText}`
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
                      <div className="grid grid-cols-3 gap-4 items-center">
                        {/* Column 1: Order details */}
                        <div className="text-foreground font-medium">
                          {(() => {
                            if ('trigger_data' in o) {
                              // HyperCore order
                              const hc = o as HyperCoreOrder
                              return `${formatAmount(hc.position_data.size)} USDC → ${hc.position_data.side.toUpperCase()} ${hc.trigger_data.pair}`
                            } else {
                              // HyperEVM order - use formatOrderSummary for consistency
                              const s = formatOrderSummary(o)
                              return `${formatAmount(s.inAmt)} ${s.inSym} → ${s.outText}`
                            }
                          })()}
                        </div>
                        
                        {/* Column 2: Condition text (always centered) */}
                        <div className="text-center">
                          {(() => {
                            // Only show trigger info for HyperEVM orders (not HyperCore)
                            if ('trigger_data' in o) return null
                            
                            const s = formatOrderSummary(o)
                            return (s.ruleText || s.tfLabel) ? (
                              <div className="text-xs text-muted-foreground">
                                {s.ruleText}
                                {s.tfLabel ? (s.ruleText ? ' • ' : '') + `TF ${s.tfLabel}` : null}
                              </div>
                            ) : null
                          })()}
                        </div>
                        
                        {/* Column 3: Action buttons */}
                        <div className="flex justify-end">
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
                      <div className="text-xs text-muted-foreground mt-1">{new Date('trigger_data' in o ? new Date(o.created_at).getTime() : o.time).toLocaleString()}{('termination_message' in o && o.termination_message) ? ` • ${o.termination_message}` : ''}</div>
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
                    {(hideCanceledClosed ? categorized.closed.filter(o => 'state' in o && o.state === 'successful') : categorized.closed).map(o => (
                      <div key={o.id} className={`relative group border rounded-lg p-3 ${('state' in o && o.state === 'failed') ? 'bg-red-500/10 border-red-500/20' : 'bg-green-500/10 border-green-500/20'}`}>
                        <div className={`pointer-events-none absolute inset-0 rounded-lg ${('state' in o && o.state === 'failed') ? 'ring-2 ring-red-500/30' : 'ring-2 ring-green-500/30'} opacity-0 transition-opacity duration-150 group-hover:opacity-100`} />
                        <div className="grid grid-cols-3 gap-4 items-center">
                          {/* Column 1: Order details */}
                          <div className="text-foreground font-medium">
                            {(() => {
                              if ('trigger_data' in o) {
                                // HyperCore order
                                const hc = o as HyperCoreOrder
                                return `${formatAmount(hc.position_data.size)} USDC → ${hc.position_data.side.toUpperCase()} ${hc.trigger_data.pair}`
                              } else {
                                // HyperEVM order - use formatOrderSummary for consistency
                                const s = formatOrderSummary(o)
                                return `${formatAmount(s.inAmt)} ${s.inSym} → ${s.outText}`
                              }
                            })()}
                          </div>
                          
                          {/* Column 2: Condition text (always centered) */}
                          <div className="text-center">
                            {(() => {
                              // Only show trigger info for HyperEVM orders (not HyperCore)
                              if ('trigger_data' in o) return null
                              
                              const s = formatOrderSummary(o)
                              return (s.ruleText || s.tfLabel) ? (
                                <div className="text-xs text-muted-foreground">
                                  {s.ruleText}
                                  {s.tfLabel ? (s.ruleText ? ' • ' : '') + `TF ${s.tfLabel}` : null}
                                </div>
                              ) : null
                            })()}
                          </div>
                          
                          {/* Column 3: Empty for closed orders (no buttons) */}
                          <div></div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{new Date('trigger_data' in o ? new Date(o.created_at).getTime() : o.time).toLocaleString()}{('termination_message' in o && o.termination_message) ? ` • ${o.termination_message}` : ''}</div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
            </CardContent>
          </Card>
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

 

