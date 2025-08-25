import { Heart } from 'lucide-react'
import { Logo } from './Logo'
import { GlueXIcon } from './GlueXIcon'
import { HyperliquidIcon } from './HyperliquidIcon'
import { AlchemyIcon } from './AlchemyIcon'
import { PrivyIcon } from './PrivyIcon'

export function Footer() {
  return (
    <footer className="border-t bg-card mt-auto">
      <div className="container mx-auto px-6 py-8">
        <div className="flex flex-col space-y-6">
          <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <Logo width={20} height={20} />
                <span className="text-lg font-semibold">Hypertick</span>
              </div>
              <span className="text-sm text-muted-foreground">Conditional Trading Platform</span>
            </div>

            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <span>Built with</span>
              <Heart className="h-4 w-4 text-red-500" />
              <span>on</span>
              <div className="flex items-center space-x-1">
                <span className="font-medium text-primary">Hyperliquid</span>
                <span className="text-xs">🐱</span>
              </div>
            </div>
          </div>

          {/* Technical stack */}
          <div className="pt-4 border-t border-border/30">
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-6 text-xs text-muted-foreground">
              <div className="flex items-center space-x-2">
                <span>Swaps via</span>
                <GlueXIcon width={40} height={10} className="text-foreground" />
              </div>
              <div className="hidden sm:block w-1 h-1 bg-muted-foreground rounded-full"></div>
              <div className="flex items-center space-x-2">
                <span>RPC by</span>
                <AlchemyIcon width={60} height={13} />
              </div>
              <div className="hidden sm:block w-1 h-1 bg-muted-foreground rounded-full"></div>
              <div className="flex items-center space-x-2">
                <span>Names by</span>
                <HyperliquidIcon width={16} height={16} />
              </div>
              <div className="hidden sm:block w-1 h-1 bg-muted-foreground rounded-full"></div>
              <div className="flex items-center space-x-2">
                <span>Wallet by</span>
                <PrivyIcon width={40} height={10} showText={true} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
} 