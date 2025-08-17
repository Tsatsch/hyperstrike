'use client'

import { Button } from '@/components/ui/button'
import { usePrivy } from '@privy-io/react-auth'
import { useEffect, useState } from 'react'
import { exchangePrivyForBackendJwt, getBackendJwt, getUserXp } from '@/lib/api'

export function XpButton() {
  const { authenticated, user, getAccessToken } = usePrivy()
  const [xp, setXp] = useState<number | null>(null)

  useEffect(() => {
    const run = async () => {
      if (!authenticated || !user?.wallet?.address) {
        setXp(null)
        return
      }
      const jwt = getBackendJwt() || await exchangePrivyForBackendJwt(getAccessToken, user.wallet.address)
      if (!jwt) {
        setXp(null)
        return
      }
      try {
        const val = await getUserXp()
        setXp(Number(val) || 0)
      } catch {
        setXp(null)
      }
    }
    run()
  }, [authenticated, user?.wallet?.address])

  const label = xp !== null ? `XP | ${xp}` : 'XP'

  return (
    <Button
      className="hidden sm:inline-flex bg-green-600 hover:bg-green-700 text-white"
      onClick={() => { window.location.href = '/xp' }}
    >
      {label}
    </Button>
  )
}


