import React from 'react'

interface GlueXIconProps {
  width?: number
  height?: number
  className?: string
}

export function GlueXIcon({ width = 62, height = 16, className = "" }: GlueXIconProps) {
  return (
    <svg 
      width={width} 
      height={height}
      viewBox="0 0 667 101" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path 
        d="M100.9 20.2V0H20.2L0 20.2V80.8C0 91.9 9.00001 101 20.2 101H80.8C91.9 101 101 92 101 80.8V60.6V40.4H50.5V60.6H80.8V80.8H20.2V20.2H100.9Z" 
        fill="currentColor"
      />
      <path 
        d="M141.3 0H121.1V80.7C121.1 91.8 130.1 100.9 141.3 100.9H222V80.7H141.3V0Z" 
        fill="currentColor"
      />
      <path 
        d="M322.9 80.7H262.3V0H242.1V80.7C242.1 91.8 251.1 100.9 262.3 100.9H322.9C334.1 100.9 343.1 91.9 343.1 80.7V0H322.9V80.7Z" 
        fill="currentColor"
      />
      <path 
        d="M464.2 20.2V0H383.5L363.3 20.2V40.4V60.6V80.8C363.3 91.9 372.3 101 383.5 101H464.2V80.8H383.5V60.6H423.9V40.4H383.5V20.2H464.2Z" 
        fill="currentColor"
      />
      <path 
        d="M625.7 0H603.8L586.8 40.4H563.7L546.7 0H524.8L546.1 50.5L524.8 100.9H546.7L563.7 60.6H586.8L603.8 100.9H625.7L604.4 50.5L625.7 0Z" 
        fill="currentColor"
      />
      <path 
        d="M635.8 2.3V0H649.4V2.3H643.7V20.2H641.4V2.3H635.8Z" 
        fill="currentColor"
      />
      <path 
        d="M652.5 20.2V0H655L659.3 6.60001L663.6 0H666.1V20.2H663.8V4.10001L660.6 8.8C660.5 9 660.4 9.39999 660.4 9.89999V11.2H658.1V10C658.1 9.5 658 9.09999 657.9 8.89999L654.7 4.2V20.3H652.5V20.2Z" 
        fill="currentColor"
      />
    </svg>
  )
}
