'use client'

import React, { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import Image from 'next/image'

interface AlchemyIconProps {
  width?: number
  height?: number
  className?: string
  showText?: boolean // Whether to show the full logo with text or just the icon
}

export function AlchemyIcon({ width = 80, height = 17, className = "", showText = true }: AlchemyIconProps) {
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
        aria-label="Alchemy"
      />
    )
  }
  
  const isDark = theme === 'dark' || resolvedTheme === 'dark'
  
  // Choose the appropriate logo based on theme and showText prop
  let logoSrc: string
  if (showText) {
    logoSrc = isDark ? '/alchemy-white-full.svg' : '/alchemy-black-full.svg'
  } else {
    logoSrc = isDark ? '/alchemy-white.svg' : '/alchemy-black.svg'
  }
  
  return (
    <Image
      src={logoSrc}
      alt="Alchemy"
      width={width}
      height={height}
      className={className}
      style={{ width, height }}
    />
  )
}