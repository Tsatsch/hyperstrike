"use client"

import { useState, useEffect } from "react"
import { usePrivy } from '@privy-io/react-auth'
import { getUserIdFromWallet } from '@/lib/wallet-utils'

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Activity, Bell, Settings, User, ArrowRight, TrendingUp, Clock, AlertCircle, CheckCircle, XCircle, Eye, Trash2, Edit, Wallet } from "lucide-react"
import { WalletButton } from "@/components/WalletButton"
import { ThemeToggle } from "@/components/theme-toggle"
import { Footer } from "@/components/footer"

interface Trigger {
  user: string
  type: string
  condition: {
    symbol: string
    interval: string
    source: string
    above: boolean
    threshold: number
    lookback: number
  }
  platform: string
  chat_id: number | string
  registered_at: string
  status?: 'active' | 'triggered' | 'cancelled' // Make status optional since backend doesn't return it
}

export default function Dashboard() {
  const { authenticated, user } = usePrivy();
  const [triggers, setTriggers] = useState<Trigger[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authenticated) {
      fetchTriggers()
    }
  }, [authenticated])

  const fetchTriggers = async () => {
    // Check if wallet is connected
    if (!authenticated || !user?.wallet?.address) {
      setLoading(false);
      setError('Please connect your wallet to view triggers');
      return;
    }

    try {
      setLoading(true)
      // Generate the same user ID from wallet address as in trade page
      const userIdFromWallet = getUserIdFromWallet(user.wallet.address);
      
      const response = await fetch(`http://localhost:8000/api/triggers?userId=${userIdFromWallet}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        setTriggers(data)
      } else {
        setError('Failed to fetch triggers')
      }
    } catch (err) {
      setError('Error fetching triggers')
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'triggered':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4" />
      case 'triggered':
        return <AlertCircle className="w-4 h-4" />
      case 'cancelled':
        return <XCircle className="w-4 h-4" />
      default:
        return <Clock className="w-4 h-4" />
    }
  }

  const formatCondition = (condition: Trigger['condition']) => {
    const direction = condition.above ? 'above' : 'below'
    return `${condition.source.charAt(0).toUpperCase() + condition.source.slice(1)} goes ${direction} ${condition.threshold} on ${condition.interval} chart of ${condition.symbol}`
  }

  const deleteTrigger = async (triggerId: number) => {
    try {
      const response = await fetch(`http://localhost:8000/api/triggers/${triggerId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        // Remove the deleted trigger from the local state
        setTriggers(triggers.filter(trigger => trigger.id !== triggerId))
      } else {
        console.error('Failed to delete trigger')
        // You can add error handling here (e.g., show error message)
      }
    } catch (error) {
      console.error('Error deleting trigger:', error)
      // You can add error handling here
    }
  }



  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="flex h-16 items-center px-6">
          <div className="flex items-center space-x-4">
            <a href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
              <Activity className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">HyperTrade</span>
            </a>
            <nav className="hidden md:flex items-center space-x-6 text-sm">
              <a href="/trade" className="text-muted-foreground hover:text-foreground transition-colors">
                Trade
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                Portfolio
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                Markets
              </a>
              <a href="/dashboard" className="font-medium text-primary">
                Dashboard
              </a>
            </nav>
          </div>
          <div className="ml-auto flex items-center space-x-4">
            <ThemeToggle />
            <Button variant="ghost" size="icon">
              <Bell className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
            <WalletButton />
            <Button variant="ghost" size="icon">
              <User className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Manage your conditional swaps and triggers</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Triggers</p>
                  <p className="text-2xl font-bold text-foreground">
                    {triggers.filter(t => (t.status || 'active') === 'active').length}
                  </p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-full">
                  <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Triggered</p>
                  <p className="text-2xl font-bold text-foreground">
                    {triggers.filter(t => t.status === 'triggered').length}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-full">
                  <AlertCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Triggers</p>
                  <p className="text-2xl font-bold text-foreground">{triggers.length}</p>
                </div>
                <div className="p-3 bg-primary/20 rounded-full">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Triggers List */}
        <Card className="border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-foreground">Your Triggers</CardTitle>
                <CardDescription>Monitor and manage your conditional swaps</CardDescription>
              </div>
              <Button 
                onClick={() => window.location.href = '/trade'}
                className="bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
              >
                Create New Trigger
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="text-muted-foreground mt-2">Loading triggers...</p>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <p className="text-red-600 mb-4">{error}</p>
                <Button onClick={fetchTriggers} variant="outline">
                  Retry
                </Button>
              </div>
            ) : triggers.length === 0 ? (
              <div className="text-center py-8">
                <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">No triggers found</p>
                <Button 
                  onClick={() => window.location.href = '/trade'}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
                >
                  Create Your First Trigger
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {triggers.map((trigger) => (
                  <div key={trigger.id} className="border border-border/50 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <Badge variant="outline" className="border-primary/30 text-primary">
                            {trigger.type.toUpperCase()}
                          </Badge>
                          <Badge className={getStatusColor(trigger.status || 'active')}>
                            <div className="flex items-center space-x-1">
                              {getStatusIcon(trigger.status || 'active')}
                              <span className="capitalize">{trigger.status || 'active'}</span>
                            </div>
                          </Badge>
                        </div>
                        
                        <div className="space-y-2">
                          <p className="text-foreground font-medium">
                            {formatCondition(trigger.condition)}
                          </p>
                          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                            <span>Platform: {trigger.platform}</span>
                            <span>•</span>
                            <span>Created: {new Date(trigger.registered_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        <Button variant="outline" size="sm" className="cursor-pointer">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm" className="cursor-pointer">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => deleteTrigger(trigger.id)}
                          className="text-red-600 hover:text-red-700 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Footer />
    </div>
  )
}