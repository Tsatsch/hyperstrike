"use client"

import { Button } from "@/components/ui/button"
import { usePrivy } from '@privy-io/react-auth'
import { useEffect, useState } from 'react'
import { exchangePrivyForBackendJwt, getBackendJwt, getUserXp, getOrCreateUser, getUserMe, getLeaderboard, claimDailyXp, UserMe } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown } from "lucide-react"
import { Activity, Bell, Settings, User, Wallet } from "lucide-react"
import { WalletButton } from "@/components/WalletButton"
import { ThemeToggle } from "@/components/theme-toggle"
import { XpButton } from "@/components/XpButton"
import { Footer } from "@/components/footer"

export default function XpPage() {
  const { ready, authenticated, user, getAccessToken, login } = usePrivy()
  const [xp, setXp] = useState<number>(0)
  const [refCode, setRefCode] = useState<string>("")
  const [copied, setCopied] = useState<boolean>(false)
  const [leaders, setLeaders] = useState<Array<{ user_id: number; wallet_address: string; xp: number }>>([])
  const [claiming, setClaiming] = useState(false)
  const [claimMsg, setClaimMsg] = useState<string>("")
  const [showConnectPrompt, setShowConnectPrompt] = useState(false)

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
    setClaimMsg("")
    try {
      const res = await claimDailyXp()
      if (res) {
        if (res.awarded > 0) {
          setClaimMsg(`+${res.awarded} XP claimed`)
          setXp(xp + res.awarded)
        } else if (res.nextEligibleAt) {
          setClaimMsg(`Come back at ${new Date(res.nextEligibleAt).toLocaleString()} to claim again`)
        }
      }
    } finally {
      setClaiming(false)
      setTimeout(() => setClaimMsg(""), 3000)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      <div className={!authenticated && ready && showConnectPrompt ? "blur-sm" : ""}>
      <header className="border-b bg-card">
        <div className="flex h-16 items-center px-6">
          <div className="flex items-center space-x-4">
            <a href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
              <Activity className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">HyperTrade</span>
            </a>
            <nav className="hidden md:flex items-center space-x-6 text-sm">
              <a href="/trade" className="text-muted-foreground hover:text-foreground transition-colors">Trade</a>
              <a href="/portfolio" className="text-muted-foreground hover:text-foreground transition-colors">Portfolio</a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Markets</a>
            </nav>
          </div>
          <div className="ml-auto flex items-center space-x-4">
            <ThemeToggle />
            <Button variant="ghost" size="icon"><Bell className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon"><Settings className="h-4 w-4" /></Button>
            <XpButton />
            <WalletButton />
            <Button variant="ghost" size="icon"><User className="h-4 w-4" /></Button>
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
                <Button size="sm" variant="outline" onClick={onClaimDaily} disabled={claiming}>
                  {claiming ? 'Claiming...' : 'Claim Daily 10 XP'}
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
              <CardTitle className="text-foreground">Leaderboard</CardTitle>
              <CardDescription>Top users by XP</CardDescription>
            </CardHeader>
            <CardContent>
              {leaders.length === 0 ? (
                <div className="text-sm text-muted-foreground">No leaders yet</div>
              ) : (
                <div className="space-y-2">
                  {leaders.map((u, idx) => (
                    <div key={u.user_id} className="flex items-center justify-between border border-border/50 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 text-muted-foreground">{idx + 1}</div>
                        <div className="text-foreground text-sm font-medium">{u.wallet_address.slice(0, 6)}...{u.wallet_address.slice(-4)}</div>
                      </div>
                      <div className="text-foreground text-sm font-semibold">{u.xp}</div>
                    </div>
                  ))}
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
                    <div className="text-muted-foreground">Earn 200 XP when your invitee places their first order.</div>
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


