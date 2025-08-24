"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { PendingTransaction } from "@/components/TransactionMonitor"

export function useTransactionMonitor() {
  const [transactions, setTransactions] = useState<PendingTransaction[]>([])
  const monitoringRefs = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Add a new transaction to monitor
  const addTransaction = useCallback((
    hash: string,
    type: PendingTransaction['type'],
    tokenSymbol?: string
  ) => {
    const id = `${hash}-${Date.now()}`
    const newTransaction: PendingTransaction = {
      id,
      hash,
      type,
      tokenSymbol,
      status: 'pending',
      timestamp: Date.now()
    }

    setTransactions(prev => [...prev, newTransaction])
    
    // Start monitoring this transaction
    startMonitoring(id, hash)
    
    return id
  }, [])

  // Start monitoring a transaction
  const startMonitoring = useCallback(async (id: string, hash: string) => {
    console.log(`Starting to monitor transaction: ${hash}`)
    
    try {
      // Dynamic import to avoid build issues
      const { ethers } = await import('ethers')
      
      // Get provider
      const provider = new ethers.JsonRpcProvider(
        process.env.NEXT_PUBLIC_ETH_RPC_URL || "https://rpc.hyperliquid.xyz/evm"
      )

      let attempts = 0
      const maxAttempts = 120 // 10 minutes with 5-second intervals
      
      const checkTransaction = async () => {
        try {
          attempts++
          console.log(`Checking transaction ${hash}, attempt ${attempts}`)
          
          const receipt = await provider.getTransactionReceipt(hash)
          
          if (receipt) {
            // Transaction found
            const success = receipt.status === 1
            
            setTransactions(prev => 
              prev.map(tx => 
                tx.id === id 
                  ? { ...tx, status: success ? 'success' : 'failed' }
                  : tx
              )
            )
            
            console.log(`Transaction ${hash} ${success ? 'succeeded' : 'failed'}`)
            
            // Clear the monitoring interval
            const intervalId = monitoringRefs.current.get(id)
            if (intervalId) {
              clearInterval(intervalId)
              monitoringRefs.current.delete(id)
            }
            
            return
          }
          
          // Check if we've exceeded max attempts
          if (attempts >= maxAttempts) {
            console.log(`Transaction ${hash} timed out after ${maxAttempts} attempts`)
            
            setTransactions(prev => 
              prev.map(tx => 
                tx.id === id 
                  ? { ...tx, status: 'failed' }
                  : tx
              )
            )
            
            // Clear the monitoring interval
            const intervalId = monitoringRefs.current.get(id)
            if (intervalId) {
              clearInterval(intervalId)
              monitoringRefs.current.delete(id)
            }
          }
        } catch (error) {
          console.error(`Error checking transaction ${hash}:`, error)
          
          // On error, continue trying unless we've exceeded max attempts
          if (attempts >= maxAttempts) {
            setTransactions(prev => 
              prev.map(tx => 
                tx.id === id 
                  ? { ...tx, status: 'failed' }
                  : tx
              )
            )
            
            // Clear the monitoring interval
            const intervalId = monitoringRefs.current.get(id)
            if (intervalId) {
              clearInterval(intervalId)
              monitoringRefs.current.delete(id)
            }
          }
        }
      }
      
      // Start polling every 5 seconds
      const intervalId = setInterval(checkTransaction, 5000)
      monitoringRefs.current.set(id, intervalId)
      
      // Check immediately
      checkTransaction()
      
    } catch (error) {
      console.error(`Error setting up monitoring for ${hash}:`, error)
      
      // Mark as failed if we can't even start monitoring
      setTransactions(prev => 
        prev.map(tx => 
          tx.id === id 
            ? { ...tx, status: 'failed' }
            : tx
        )
      )
    }
  }, [])

  // Remove a transaction from the list
  const removeTransaction = useCallback((id: string) => {
    setTransactions(prev => prev.filter(tx => tx.id !== id))
    
    // Clear any monitoring interval
    const intervalId = monitoringRefs.current.get(id)
    if (intervalId) {
      clearInterval(intervalId)
      monitoringRefs.current.delete(id)
    }
  }, [])

  // Update transaction status manually (fallback)
  const updateTransactionStatus = useCallback((id: string, status: PendingTransaction['status']) => {
    setTransactions(prev => 
      prev.map(tx => 
        tx.id === id 
          ? { ...tx, status }
          : tx
      )
    )
  }, [])

  // Clean up intervals on unmount
  useEffect(() => {
    return () => {
      monitoringRefs.current.forEach(intervalId => clearInterval(intervalId))
      monitoringRefs.current.clear()
    }
  }, [])

  return {
    transactions,
    addTransaction,
    removeTransaction,
    updateTransactionStatus
  }
}
