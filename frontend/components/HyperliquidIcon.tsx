import React from 'react'

interface HyperliquidIconProps {
  width?: number
  height?: number
  className?: string
}

export function HyperliquidIcon({ width = 24, height = 24, className = "" }: HyperliquidIconProps) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={width} 
      height={height}
      viewBox="0 0 500 500" 
      className={className}
    >
      <style>{`.st1{fill:#fff}`}</style>
      <ellipse cx="182.8" cy="249.7" className="st1" rx="44" ry="63.6"/>
      <ellipse cx="317.2" cy="249.7" className="st1" rx="44" ry="63.6"/>
      <linearGradient id="SVGID_1_" x1="250" x2="250" y1="499.703" y2="-.297" gradientUnits="userSpaceOnUse">
        <stop offset="0" style={{stopColor:'#71c494'}}/>
        <stop offset=".316" style={{stopColor:'#36629b'}}/>
        <stop offset=".653" style={{stopColor:'#36629b'}}/>
        <stop offset="1" style={{stopColor:'#71c494'}}/>
      </linearGradient>
      <path d="M217.6 78.9S99.5 23.3 21.7 219.7 91.5 524 205.4 492.6c-55.4-31-166.8-73.3-150.6-190.3S155.9 115.1 217.6 78.9zm64.8 341.4s118.1 55.6 195.9-140.8S408.5-24.7 294.6 6.6C350 37.5 461.4 79.9 445.2 196.8S344.1 384 282.4 420.3zm138.2-203S476.2 99.2 279.8 21.4-24.4 91.2 6.9 205.1C37.8 149.7 80.2 38.3 197.1 54.5s187.2 101.1 223.5 162.8zM79.4 282.1S23.8 400.2 220.2 478s304.3-69.8 272.9-183.7c-30.9 55.4-73.2 166.8-190.2 150.6S115.7 343.8 79.4 282.1z" style={{fill:'url(#SVGID_1_)'}}/>
    </svg>
  )
}
