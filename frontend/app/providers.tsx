'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/theme-provider';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

function PrivyProviderWithTheme({ children }: { children: React.ReactNode }) {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render Privy until we know the theme to avoid hydration issues
  if (!mounted) {
    return (
      <div className="min-h-screen bg-background">
        {children}
        <Toaster />
      </div>
    );
  }

  const currentTheme = resolvedTheme || theme || 'light';
  
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ''}
      config={{
        loginMethods: ['wallet', 'email'],
        appearance: {
          theme: currentTheme === 'dark' ? 'dark' : 'light',
          accentColor: '#A076F9',
          showWalletLoginFirst: true,
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
        externalWallets: {
          // MetaMask and other popular wallets work without additional config
        },
      }}
    >
      {children}
      <Toaster />
    </PrivyProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="Hyperstrike-theme"
    >
      <PrivyProviderWithTheme>
        {children}
      </PrivyProviderWithTheme>
    </ThemeProvider>
  );
} 