'use client'

import { useEffect } from 'react'

export function ReferralCapture() {
  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      const ref = url.searchParams.get('ref')
      if (ref) {
        localStorage.setItem('Hypertick_referral_code', ref)
      }
    } catch {}
  }, [])

  return null
}


