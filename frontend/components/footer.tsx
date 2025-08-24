import { Heart } from 'lucide-react'
import { Logo } from './Logo'

export function Footer() {
  return (
    <footer className="border-t bg-card mt-auto">
      <div className="container mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <Logo width={20} height={20} />
              <span className="text-lg font-semibold">Hypertick</span>
            </div>
            <span className="text-sm text-muted-foreground">Conditional Trading Platform</span>
          </div>
          
          <div className="flex items-center space-x-6 text-sm">
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
              Terms
            </a>
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
              Privacy
            </a>
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
              Support
            </a>
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
      </div>
    </footer>
  )
} 