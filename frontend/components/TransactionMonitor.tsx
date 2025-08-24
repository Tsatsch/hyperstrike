"use client"

import { useState, useEffect } from "react"
import { X, CheckCircle, XCircle, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "next-themes"

export interface PendingTransaction {
  id: string
  hash: string
  type: 'approval' | 'wrap' | 'swap' | 'unwrap'
  tokenSymbol?: string
  status: 'pending' | 'success' | 'failed'
  timestamp: number
}

interface TransactionMonitorProps {
  transactions: PendingTransaction[]
  onRemoveTransaction: (id: string) => void
}

export function TransactionMonitor({ transactions, onRemoveTransaction }: TransactionMonitorProps) {
  const [visibleTransactions, setVisibleTransactions] = useState<PendingTransaction[]>([])
  const [exitingTransactions, setExitingTransactions] = useState<Set<string>>(new Set())
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    setVisibleTransactions(transactions.filter(tx => tx.status !== 'pending'))
  }, [transactions])

  // Auto-dismiss successful transactions after 5 seconds
  useEffect(() => {
    const timers: NodeJS.Timeout[] = []
    
    visibleTransactions.forEach(tx => {
      if (tx.status === 'success') {
        const timer = setTimeout(() => {
          handleRemove(tx.id)
        }, 5000)
        timers.push(timer)
      }
    })

    return () => {
      timers.forEach(timer => clearTimeout(timer))
    }
  }, [visibleTransactions])

  const handleRemove = (id: string) => {
    // Start exit animation
    setExitingTransactions(prev => new Set(prev).add(id))
    
    // Remove after animation completes
    setTimeout(() => {
      onRemoveTransaction(id)
      setExitingTransactions(prev => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
    }, 300) // Match animation duration
  }

  const getTransactionIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-white" />
      case 'failed':
        return <XCircle className="w-5 h-5 text-white" />
      case 'pending':
        return <Clock className="w-5 h-5 text-white animate-spin" />
      default:
        return <Clock className="w-5 h-5 text-white" />
    }
  }

  const getTransactionStyles = (status: string) => {
    const isDark = resolvedTheme === 'dark'
    
    switch (status) {
      case 'success':
        return {
          bg: 'bg-[#01cba4] dark:bg-[#01cba4]', // Turquoise green
          border: isDark 
            ? 'border-2 border-dashed border-green-600' // Dark green dots for dark mode
            : 'border-2 border-dashed border-green-400'  // Light green dots for light mode
        }
      case 'failed':
        return {
          bg: 'bg-red-500 dark:bg-red-600',
          border: isDark
            ? 'border-2 border-dashed border-red-400'
            : 'border-2 border-dashed border-red-300'
        }
      case 'pending':
        return {
          bg: 'bg-blue-500 dark:bg-blue-600',
          border: isDark
            ? 'border-2 border-dashed border-blue-400'
            : 'border-2 border-dashed border-blue-300'
        }
      default:
        return {
          bg: 'bg-gray-500 dark:bg-gray-600',
          border: 'border-2 border-dashed border-gray-400'
        }
    }
  }

  const getTransactionMessage = (tx: PendingTransaction) => {
    const baseMessage = (() => {
      switch (tx.type) {
        case 'approval':
          return `${tx.tokenSymbol || 'Token'} approval`
        case 'wrap':
          return 'HYPE wrapping'
        case 'swap':
          return 'Token swap'
        case 'unwrap':
          return 'HYPE unwrapping'
        default:
          return 'Transaction'
      }
    })()

    switch (tx.status) {
      case 'success':
        return `${baseMessage} successful`
      case 'failed':
        return `${baseMessage} failed`
      case 'pending':
        return `${baseMessage} pending...`
      default:
        return baseMessage
    }
  }

  if (visibleTransactions.length === 0) {
    return null
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md min-w-[320px]">
      {visibleTransactions.map((tx) => {
        const styles = getTransactionStyles(tx.status)
        return (
          <div
            key={tx.id}
            className={`${styles.bg} ${styles.border} text-white p-4 rounded-lg shadow-lg transition-transform duration-300 ${
              exitingTransactions.has(tx.id) 
                ? 'transform translate-x-full' // Slide right (exit)
                : 'animate-in slide-in-from-right-full' // Slide in from right
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {getTransactionIcon(tx.status)}
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {getTransactionMessage(tx)}
                  </p>
                  <a 
                    href={`https://hyperevmscan.io/tx/${tx.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs underline cursor-pointer"
                  >
                    View on Explorer
                  </a>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(tx.id)}
                className="text-white hover:bg-white/20 p-1 h-6 w-6 ml-2"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
