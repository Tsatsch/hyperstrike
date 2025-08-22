'use client'

import { Button } from '@/components/ui/button'
import { usePrivy } from '@privy-io/react-auth'
import { Star } from 'lucide-react'
import { useEffect, useState } from 'react'
import { exchangePrivyForBackendJwt, getBackendJwt, getUserXp } from '@/lib/api'

export function XpButton() {
  const { authenticated, user, getAccessToken } = usePrivy()
  const [xp, setXp] = useState<number | null>(null)

  useEffect(() => {
    const run = async () => {
      if (!authenticated || !user?.wallet?.address) return
      const jwt = getBackendJwt() || await exchangePrivyForBackendJwt(getAccessToken, user.wallet.address)
      if (!jwt) return
      try {
        const value = await getUserXp()
        setXp(value)
      } catch {}
    }
    run()
  }, [authenticated, user?.wallet?.address])

  // Only show XP button if user is authenticated
  if (!authenticated) {
    return null
  }

  return (
    <Button
      variant="outline"
      className="hidden sm:inline-flex border-teal-500 text-teal-600 hover:bg-teal-50 hover:text-teal-700 dark:border-teal-400 dark:text-teal-400 dark:hover:bg-teal-950 dark:hover:text-teal-300"
      onClick={() => { window.location.href = '/xp' }}
    >
      <Star className="mr-2 h-4 w-4 text-teal-500 dark:text-teal-400" />
      {typeof xp === 'number' ? `${xp} XP` : 'XP'}
    </Button>
  )
}


