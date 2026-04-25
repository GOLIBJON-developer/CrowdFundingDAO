import type { Metadata } from 'next'
import { Providers } from './providers'
import { Navbar } from '@/components/layout/Navbar'
import './globals.css'

export const metadata: Metadata = {
  title: 'FundDAO — Decentralized Crowdfunding',
  description: 'Launch and fund campaigns with on-chain governance',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <Providers>
          <Navbar />
          <main className="min-h-[calc(100vh-56px)]">
            {children}
          </main>
          <footer className="border-t border-zinc-800/60 py-6 mt-20">
            <div className="max-w-6xl mx-auto px-4 flex items-center justify-between">
              <span className="font-display italic text-zinc-600 text-sm">FundDAO</span>
              <span className="text-xs font-mono text-zinc-700">
                Powered by Ethereum · OpenZeppelin Governor
              </span>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  )
}