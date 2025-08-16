'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import Image from 'next/image'

interface LogoProps {
  className?: string
  width?: number
  height?: number
}

export function Logo({ className = '', width = 24, height = 24 }: LogoProps) {
  const { theme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Don't render until we know the theme to avoid hydration issues
  if (!mounted) {
    return (
      <div 
        className={`animate-pulse bg-muted rounded ${className}`}
        style={{ width, height }}
      />
    )
  }

  const currentTheme = resolvedTheme || theme || 'light'
  const logoSrc = currentTheme === 'dark' ? '/logo-light.svg' : '/logo-dark.svg'

  return (
    <Image
      src={logoSrc}
      alt="Hyperstrike Logo"
      width={width}
      height={height}
      className={className}
    />
  )
}
