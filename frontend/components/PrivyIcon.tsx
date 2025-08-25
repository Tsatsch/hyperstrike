'use client'

import React, { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import Image from 'next/image'

interface PrivyIconProps {
  width?: number
  height?: number
  className?: string
  showText?: boolean // Whether to show the full logo with text or just the icon
}

export function PrivyIcon({ width = 24, height = 31, className = "", showText = false }: PrivyIconProps) {
  const { theme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])
  
  // Show a fallback during SSR and before mounting to prevent hydration mismatch
  if (!mounted) {
    return (
      <div 
        className={`bg-muted-foreground/20 rounded ${className}`} 
        style={{ width, height }}
        aria-label="Privy"
      />
    )
  }
  
  const isDark = theme === 'dark' || resolvedTheme === 'dark'
  
  // Choose the appropriate logo based on theme and showText prop
  let logoSrc: string
  if (showText) {
    logoSrc = isDark ? '/privy-white-full.svg' : '/privy-black-full.svg'
  } else {
    logoSrc = isDark ? '/privy-white.svg' : '/privy-black.svg'
  }
  
  return (
    <Image
      src={logoSrc}
      alt="Privy"
      width={width}
      height={height}
      className={className}
      style={{ width, height }}
    />
  )
}
