import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Hyperstrike - Conditional Trading Platform',
  description: 'Revolutionary crypto trading platform offering conditional token swapping based on external signals, wallet activities, and market events.',
  icons: {
    icon: [
      { url: '/logo-dark.png', media: '(prefers-color-scheme: light)' },
      { url: '/logo-light.png', media: '(prefers-color-scheme: dark)' }
    ],
    shortcut: [
      { url: '/logo-dark.png', media: '(prefers-color-scheme: light)' },
      { url: '/logo-light.png', media: '(prefers-color-scheme: dark)' }
    ],
    apple: [
      { url: '/logo-dark.png', media: '(prefers-color-scheme: light)' },
      { url: '/logo-light.png', media: '(prefers-color-scheme: dark)' }
    ],
  },
  manifest: '/manifest.json',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style>{`
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
}
        `}</style>
      </head>
      <body suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
