// Lightweight HyperCore client for fetching account, spot balances, and perps positions (MAINNET)
// Uses Hyperliquid Info API (POST /info) with type=clearinghouseState and type=spotClearinghouseState.

export interface HypercoreAccountSummary {
	// Total account value in USD (if provided by API)
	totalValue?: number
	// Available balance in USD (if provided by API)
	availableBalance?: number
	// Optional raw payload for future use
	_raw?: any
}

export interface HypercorePerpPosition {
	asset: string
	size: number
	isLong?: boolean
	entryPrice?: number
	unrealizedPnl?: number
	margin?: number
	_raw?: any
}

export interface HypercoreSpotBalance {
	symbol: string
	balance: number
	_raw?: any
}

import { config } from './config'
const HYPERLIQUID_INFO_API = `${config.apiUrl}/api/hypercore/info`

// Normalize numbers that may arrive as strings from the Info API
function toNumber(v: any): number | undefined {
  const n = typeof v === 'number' ? v : (typeof v === 'string' ? parseFloat(v) : NaN)
  return Number.isFinite(n) ? n : undefined
}

async function postInfo(body: any): Promise<any | null> {
	try {
		const res = await fetch(HYPERLIQUID_INFO_API, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		})
		if (!res.ok) return null
		return await res.json()
	} catch {
		return null
	}
}

// Fetch high-level account summary (USD totals and available balance when exposed)
export async function getCoreAccount(address: string): Promise<HypercoreAccountSummary | null> {
	if (!address) return null
	const data = await postInfo({ type: 'clearinghouseState', user: address })
	if (!data) return null
	const ms = (data && (data.marginSummary || data.crossMarginSummary)) || {}

	const toNumber = (v: any): number | undefined => {
		const n = typeof v === 'number' ? v : (typeof v === 'string' ? parseFloat(v) : NaN)
		return Number.isFinite(n) ? n : undefined
	}

	const totalValue =
		toNumber(ms.accountValue) ??
		toNumber(ms.equity) ??
		toNumber((data as any).accountValue)

	const availableBalance =
		toNumber(ms.freeCollateral) ??
		toNumber(ms.availableMargin) ??
		toNumber((data as any).withdrawable)

	return { totalValue, availableBalance, _raw: data }
}

// Fetch perps positions; normalize key fields we care about
export async function getCorePerpPositions(address: string): Promise<HypercorePerpPosition[]> {
	if (!address) return []
	const data = await postInfo({ type: 'clearinghouseState', user: address })
	const arr = (data && (data.assetPositions || data.positions)) || []
	if (!Array.isArray(arr)) return []
	const toNumber = (v: any): number | undefined => {
		const n = typeof v === 'number' ? v : (typeof v === 'string' ? parseFloat(v) : NaN)
		return Number.isFinite(n) ? n : undefined
	}
	return arr.map((p: any) => ({
		asset: String(p?.asset ?? p?.coin ?? ''),
		size: toNumber(p?.size ?? p?.positionSize) ?? 0,
		isLong: typeof p?.isLong === 'boolean' ? p.isLong : (typeof p?.side === 'string' ? p.side.toLowerCase() === 'long' : undefined),
		entryPrice: toNumber(p?.entryPrice ?? p?.entryPx),
		unrealizedPnl: toNumber(p?.unrealizedPnl ?? p?.uPnl),
		margin: toNumber(p?.margin),
		_raw: p,
	}))
}

// Fetch spot balances
export async function getCoreSpotBalances(address: string): Promise<HypercoreSpotBalance[]> {
	if (!address) return []
	const data = await postInfo({ type: 'spotClearinghouseState', user: address })
	const arr = (data && (data.balances || data.spotBalances || data.balancesMap)) || []
	const out: HypercoreSpotBalance[] = []

	if (Array.isArray(arr)) {
		for (const b of arr) {
			const symbol = String(b?.coin ?? b?.symbol ?? b?.asset ?? b?.token ?? '')
			if (!symbol) continue
			const total = toNumber(b?.total ?? b?.balance ?? b?.free ?? b?.amount) ?? 0
			const hold = toNumber(b?.hold) ?? 0
			const available = isNaN(total) ? 0 : Math.max(0, total - (isNaN(hold) ? 0 : hold))
			out.push({ symbol, balance: available, _raw: b })
		}
		return out
	}

	// balancesMap case: { [symbol]: { total, hold } }
	if (arr && typeof arr === 'object') {
		for (const [symbol, v] of Object.entries(arr)) {
			const vv: any = v
			const total = toNumber(vv?.total ?? vv?.balance) ?? 0
			const hold = toNumber(vv?.hold) ?? 0
			const available = isNaN(total) ? 0 : Math.max(0, total - (isNaN(hold) ? 0 : hold))
			if (symbol) out.push({ symbol, balance: available, _raw: vv })
		}
	}
	return out
}


