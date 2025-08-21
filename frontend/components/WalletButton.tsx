'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Wallet, User, Copy, ExternalLink, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { exchangePrivyForBackendJwt, listOrders } from '@/lib/api';
import { config } from '@/lib/config';
import { resolveHlName, resolveHlProfile, HlProfile } from '@/lib/hlnames';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// Blockscout URLs for different networks
const BLOCKSCOUT_URLS: { [key: string]: string } = {
  'eip155:1': 'https://eth.blockscout.com',
  'eip155:42161': 'https://arbitrum.blockscout.com/',
  'eip155:8453': 'https://base.blockscout.com',
  'eip155:56': 'https://bscscan.com/',
  'eip155:43114': 'https://subnets.avax.network/',
  'eip155:10': 'https://optimism.blockscout.com',
  'eip155:137': 'https://polygon.blockscout.com',
  'eip155:5000': 'https://explorer.mantle.xyz',
  'eip155:130': 'https://unichain.blockscout.com/',
  'eip155:534352': 'https://scroll.blockscout.com',
};

export function WalletButton() {
  const { login, logout, authenticated, user, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [hlName, setHlName] = useState<string | null>(null);
  const [hlProfile, setHlProfile] = useState<HlProfile | null>(null);

  const currentWalletAddress = user?.wallet?.address;

  // Notify backend when wallet connection status changes and register user
  useEffect(() => {
    const notifyBackend = async () => {
      if (authenticated && currentWalletAddress) {
        try {
          await fetch(`${config.apiUrl}/api/wallet?address=${currentWalletAddress}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });
        } catch (error) {
          console.error('Error notifying backend of wallet connection:', error);
        }
      }
    };

    const registerUser = async () => {
      if (authenticated && currentWalletAddress) {
        try {
          const token = await getAccessToken?.();
          if (!token) return;
          // Read referral code from URL if present
          let referralParam = '';
          try {
            const url = new URL(window.location.href);
            const ref = url.searchParams.get('ref');
            if (ref) referralParam = `&referral=${encodeURIComponent(ref)}`;
          } catch {}

          await fetch(`${config.apiUrl}/api/user?wallet=${currentWalletAddress}${referralParam}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
        } catch (error) {
          console.error('Error registering user:', error);
        }
      }
    };

    const exchangeJwtAndPrefetchOrders = async () => {
      if (authenticated && currentWalletAddress) {
        try {
          const jwt = await exchangePrivyForBackendJwt(getAccessToken, currentWalletAddress);
          if (jwt) {
            // Optional: prefetch orders to verify end-to-end and aid DX during hackathon
            try {
              const orders = await listOrders();

            } catch (e) {
              console.warn('Could not prefetch orders:', e);
            }
          }
        } catch (error) {
          console.error('Error exchanging Privy token for backend JWT:', error);
        }
      }
    };

    notifyBackend();
    registerUser();
    exchangeJwtAndPrefetchOrders();
  }, [authenticated, currentWalletAddress]);

  // Resolve .hl name for display
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!currentWalletAddress) {
        setHlName(null);
        setHlProfile(null);
        return;
      }
      try {
        const name = await resolveHlName(currentWalletAddress);
        if (!cancelled) setHlName(name);
      } catch {
        if (!cancelled) setHlName(null);
      }
      try {
        const profile = await resolveHlProfile(currentWalletAddress);
        if (!cancelled) setHlProfile(profile);
      } catch {
        if (!cancelled) setHlProfile(null);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [currentWalletAddress]);

  const handleCopyAddress = async () => {
    if (currentWalletAddress) {
      await navigator.clipboard.writeText(currentWalletAddress);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 1000);
    }
  };

  const handleViewOnHypurrScan = () => {
    if (currentWalletAddress) {
      window.open(`https://hypurrscan.io/address/${currentWalletAddress}`, '_blank');
    }
  };

  if (!authenticated) {
    return (
      <Button
        variant="outline"
        className="hidden sm:inline-flex"
        onClick={login}
      >
        <Wallet className="mr-2 h-4 w-4" />
        Connect Wallet
      </Button>
    );
  }

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="hidden sm:inline-flex"
        >
          <div className="mr-2">
            <Avatar className="h-5 w-5">
              <AvatarImage
                src={(hlProfile?.avatarUrl && hlProfile.avatarUrl.startsWith('https://')) ? hlProfile.avatarUrl : '/placeholder-user.jpg'}
                alt={hlName || currentWalletAddress || 'avatar'}
              />
              <AvatarFallback>{(hlName || currentWalletAddress || 'U')[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
          </div>
          {hlName ?? (currentWalletAddress ? shortenAddress(currentWalletAddress) : 'Connected')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem 
          className="py-3 cursor-pointer"
          onClick={() => { window.location.href = '/dashboard' }}
        >
          <User className="mr-2 h-4 w-4" />
          <span>Dashboard</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          className="py-3 cursor-pointer"
          onClick={handleCopyAddress}
        >
          <Copy className={cn("mr-2 h-4 w-4", copyFeedback && "text-green-500")} />
          <span>{copyFeedback ? 'Copied!' : 'Copy address'}</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          className="py-3 cursor-pointer"
          onClick={handleViewOnHypurrScan}
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          <span>View on HypurrScan</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          className="py-3 cursor-pointer text-destructive focus:text-destructive"
          onClick={logout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Disconnect</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 