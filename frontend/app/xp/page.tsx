"use client"

import { Button } from "@/components/ui/button"
import { usePrivy } from '@privy-io/react-auth'
import { useEffect, useState } from 'react'
import { exchangePrivyForBackendJwt, getBackendJwt, getUserXp, getOrCreateUser, getUserMe, getLeaderboard, claimDailyXp, getDailyEligibility, UserMe } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, ChevronRight, Users } from "lucide-react"
import { Wallet } from "lucide-react"
import { WalletButton } from "@/components/WalletButton"
import { ThemeToggle } from "@/components/theme-toggle"
import { XpButton } from "@/components/XpButton"
import { Footer } from "@/components/footer"
import { resolveHlName, resolveHlProfile, type HlProfile } from "@/lib/hlnames"
import { shortenAddress } from "@/lib/wallet-utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export default function XpPage() {
  const { ready, authenticated, user, getAccessToken, login } = usePrivy()
  const [xp, setXp] = useState<number>(0)
  const [refCode, setRefCode] = useState<string>("")
  const [copied, setCopied] = useState<boolean>(false)
  const [leaders, setLeaders] = useState<Array<{ user_id: number; wallet_address: string; xp: number }>>([])
  const [claiming, setClaiming] = useState(false)
  const [claimMsg, setClaimMsg] = useState<string>("")
  const [eligible, setEligible] = useState<boolean | null>(null)
  const [showConnectPrompt, setShowConnectPrompt] = useState(false)
  const [hlNames, setHlNames] = useState<Record<string, string>>({})
  const [hlProfiles, setHlProfiles] = useState<Record<string, HlProfile>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const run = async () => {
      if (!authenticated || !user?.wallet?.address) return
      // Ensure backend auth first
      const jwt = getBackendJwt() || await exchangePrivyForBackendJwt(getAccessToken, user.wallet.address)
      if (jwt) {
        try { setXp(await getUserXp()) } catch {}
        let me = await getUserMe()
        if (!me?.referral_code) {
          // Create if missing, then fetch again
          await getOrCreateUser(getAccessToken, user.wallet.address)
          me = await getUserMe()
        }
        if (me?.referral_code) setRefCode(me.referral_code)
        try { setLeaders(await getLeaderboard(20)) } catch {}
        try {
          const elig = await getDailyEligibility()
          if (elig) {
            setEligible(elig.eligible)
            if (!elig.eligible) {
              const timeStr = elig.nextEligibleAt ? new Date(elig.nextEligibleAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''
              setClaimMsg(`Come back tomorrow at ${timeStr} to claim again`)
            } else {
              setClaimMsg("")
            }
          }
        } catch {}
      }
    }
    run()
  }, [authenticated, user?.wallet?.address])

  useEffect(() => {
    if (!ready) return
    setShowConnectPrompt(!authenticated)
  }, [ready, authenticated])

  const copyReferral = async () => {
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    const url = `${base}/?ref=${encodeURIComponent(refCode)}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1000)
  }

  const onClaimDaily = async () => {
    setClaiming(true)
    try {
      const res = await claimDailyXp()
      if (res) {
        if (res.awarded > 0) {
          setClaimMsg(`+${res.awarded} XP claimed`)
          setXp(xp + res.awarded)
          setEligible(false)
        } else if (res.nextEligibleAt) {
          const timeStr = new Date(res.nextEligibleAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          setClaimMsg(`Come back tomorrow at ${timeStr} to claim again`)
          setEligible(false)
        }
      }
    } finally {
      setClaiming(false)
    }
  }

  // Resolve .hl names for leaderboard addresses (quick display)
  useEffect(() => {
    if (!leaders || leaders.length === 0) return
    let cancelled = false
    const run = async () => {
      const addressList = leaders.map(l => l.wallet_address.toLowerCase())
      const missing = addressList.filter(a => hlNames[a] === undefined)
      if (missing.length === 0) return
      try {
        const results = await Promise.all(
          missing.map(async (addr) => {
            try {
              const name = await resolveHlName(addr)
              return [addr, name || ""] as const
            } catch {
              return [addr, ""] as const
            }
          })
        )
        if (!cancelled) {
          setHlNames(prev => {
            const next = { ...prev }
            for (const [addr, name] of results) next[addr] = name
            return next
          })
        }
      } catch {}
    }
    run()
    return () => { cancelled = true }
  }, [leaders])

  // Resolve full HL profiles for records/avatar on demand for leaderboard
  useEffect(() => {
    if (!leaders || leaders.length === 0) return
    let cancelled = false
    const run = async () => {
      const addressList = leaders.map(l => l.wallet_address.toLowerCase())
      const missing = addressList.filter(a => hlProfiles[a] === undefined)
      if (missing.length === 0) return
      try {
        const results = await Promise.all(
          missing.map(async (addr) => {
            try {
              const profile = await resolveHlProfile(addr)
              return [addr, profile] as const
            } catch {
              return [addr, { name: '', namehash: null, texts: {}, avatarUrl: null } as HlProfile] as const
            }
          })
        )
        if (!cancelled) {
          setHlProfiles(prev => {
            const next = { ...prev }
            for (const [addr, profile] of results) next[addr] = profile
            return next
          })
        }
      } catch {}
    }
    run()
    return () => { cancelled = true }
  }, [leaders])

  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      <div className={!authenticated && ready && showConnectPrompt ? "blur-sm" : ""}>
      <header className="border-b bg-card">
        <div className="flex h-16 items-center px-6">
          <div className="flex items-center space-x-4">
            <a href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
              <img src="/logo.svg" alt="Hypertick" className="h-6 w-6" />
              <span className="text-xl font-bold">Hypertick</span>
            </a>
            <nav className="hidden md:flex items-center space-x-6 text-sm">
              <a href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">Dashboard</a>
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
          <h1 className="text-3xl font-bold text-foreground mb-2">XP</h1>
          <p className="text-muted-foreground">Earn XP for trading, creating orders, and inviting friends.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-border/50 md:col-span-1">
            <CardHeader>
              <CardTitle className="text-foreground">XP Overview</CardTitle>
              <CardDescription>Total XP and progress</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Total XP</div>
                <div className="text-foreground font-semibold">{xp}</div>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${Math.min(100, (xp % 1000) / 10)}%` }} />
              </div>
              <div className="text-xs text-muted-foreground mt-2">More actions earn more XP</div>
              <div className="mt-3 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={onClaimDaily}
                  disabled={claiming || eligible === false}
                  className={eligible === false ? 'bg-rose-400 hover:bg-rose-500 text-foreground disabled:opacity-100' : eligible === true ? 'bg-teal-400 hover:bg-teal-500 text-foreground' : ''}
                >
                  {claiming ? 'Claiming...' : eligible === false ? 'Daily XP unavailable' : 'Claim Daily 10 XP'}
                </Button>
                {claimMsg && <div className="text-xs text-muted-foreground">{claimMsg}</div>}
              </div>
              <div className="mt-6 border-t border-border/50 pt-4">
                <div className="text-sm text-muted-foreground mb-2">Your referral link</div>
                <div className="flex items-center justify-between border border-border/50 rounded-lg px-3 py-2">
                  <div className="truncate text-xs text-muted-foreground">
                    {refCode ? `${typeof window !== 'undefined' ? window.location.origin : ''}/?ref=${refCode}` : 'Generating...' }
                  </div>
                  <Button variant="outline" size="sm" className="ml-2" onClick={copyReferral} disabled={!refCode}>
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 md:col-span-2">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center justify-between">
                <span>Leaderboard</span>
                <div className="flex items-center text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded-md">
                  <Users className="w-3 h-3 mr-1" />
                  <span>with .hl names</span>
                </div>
              </CardTitle>
              <CardDescription>Top users by XP</CardDescription>
            </CardHeader>
            <CardContent>
              {leaders.length === 0 ? (
                <div className="text-sm text-muted-foreground">No leaders yet</div>
              ) : (
                <div className="space-y-2">
                  {leaders.map((u, idx) => {
                    const key = u.wallet_address.toLowerCase()
                    const profile = hlProfiles[key]
                    const hlName = hlNames[key]
                    const hasHlName = !!hlName
                    const avatarUrl = profile?.avatarUrl || ''
                    const isExpanded = !!expanded[key]
                    
                    // Determine display name with priority: Name value > .hl name > shortened address
                    let displayName: string
                    let hasNameRecord = false
                    if (profile?.texts?.Name) {
                      // Priority 1: Show Name value prominently, then .hl name if available
                      hasNameRecord = true
                      if (hlName) {
                        // Render with styled components for visual distinction
                        displayName = `${profile.texts.Name} (${hlName})`
                      } else {
                        displayName = profile.texts.Name
                      }
                    } else if (hlName) {
                      // Priority 2: .hl name only
                      displayName = hlName
                    } else {
                      // Priority 3: Shortened address
                      displayName = shortenAddress(u.wallet_address)
                    }
                    
                    // Filter out Name key and avatar-related entries from expandable texts
                    const entries = profile ? Object.entries(profile.texts) : []
                    const nonAvatarEntries = entries.filter(([k]) => 
                      !k.toLowerCase().includes('avatar') && k !== 'Name'
                    )
                    const firstTwo = nonAvatarEntries.slice(0, 2)
                    
                    return (
                      <div key={u.user_id} className="border border-border/50 rounded-lg px-3 py-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-6 text-muted-foreground">{idx + 1}</div>
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={(avatarUrl && avatarUrl.startsWith('https://')) ? avatarUrl : '/placeholder-user.jpg'} alt={displayName} />
                              <AvatarFallback>{(displayName || 'U')[0]?.toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <span className="text-foreground text-sm font-medium">
                              {hasNameRecord && hlName ? (
                                <>
                                  <span>{profile!.texts.Name}</span>
                                  <span className="text-xs text-muted-foreground ml-1">({hlName})</span>
                                </>
                              ) : (
                                displayName
                              )}
                            </span>
                            {hasHlName && (
                              <>
                                <span className="text-xs bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded-md">.hl</span>
                                {firstTwo.length > 0 && (
                                  <button
                                    aria-label={isExpanded ? 'Collapse' : 'Expand'}
                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                    onClick={() => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))}
                                  >
                                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                          <div className="text-foreground text-sm font-semibold">{u.xp}</div>
                        </div>
                        {hasHlName && isExpanded && firstTwo.length > 0 && (
                          <div className="mt-2 text-xs text-muted-foreground space-y-1">
                            {firstTwo.map(([k, v]) => (
                              <div key={k} className="break-words">
                                <span className="font-medium text-foreground">{k}:</span>{' '}
                                <span>{String(v)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 md:col-span-3">
            <CardHeader>
              <CardTitle className="text-foreground">How to earn XP</CardTitle>
              <CardDescription>Actions and rewards</CardDescription>
            </CardHeader>
            <CardContent>
              <Collapsible>
                <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2 border border-border/50 rounded-lg text-sm">
                  <span className="text-foreground">Show details</span>
                  <ChevronDown className="w-4 h-4" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 mt-3 text-sm">
                  <div className="border border-border/50 rounded-lg p-3">
                    <div className="font-medium text-foreground">Order triggers</div>
                    <div className="text-muted-foreground">Earn XP equal to 1% of your order's input USD value when it triggers.</div>
                  </div>
                  <div className="border border-border/50 rounded-lg p-3">
                    <div className="font-medium text-foreground">Invite friends</div>
                    <div className="text-muted-foreground">Earn %10 of your invitee's triggered orders.</div>
                  </div>
                  <div className="border border-border/50 rounded-lg p-3">
                    <div className="font-medium text-foreground">Daily visit</div>
                    <div className="text-muted-foreground">Earn 10 XP for visiting the app once per day.</div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
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
                <p className="text-muted-foreground">Please connect your wallet to view XP and the leaderboard.</p>
              </div>
              <div className="space-y-3">
                <Button 
                  onClick={login}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg cursor-pointer"
                >
                  Connect Wallet
                  <Wallet className="w-4 h-4 ml-2" />
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


