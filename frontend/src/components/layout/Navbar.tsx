'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@/components/ui'
import { cn ,fmtEth} from '@/lib/utils'
import { useMyTokenInfo } from '@/hooks/useFundToken'
import { useIsAdmin } from '@/hooks/useAdmin'
const NAV_LINKS = [
  { href: '/',            label: 'Campaigns' },
  { href: '/create',      label: 'Launch'    },
  { href: '/governance',  label: 'Govern'    },
  { href: '/portfolio',   label: 'Portfolio' },
]

export function Navbar() {
  const pathname = usePathname()
  const { address } = useAccount()
  const { balance, votes } = useMyTokenInfo(address)
  const { hasAnyRole } = useIsAdmin(address)

  const allLinks = [
    ...NAV_LINKS,
    ...(hasAnyRole ? [{ href: '/admin', label: 'Admin' }] : []),
  ] 
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800/60 bg-[#09090B]/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-6">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <span className="w-6 h-6 rounded bg-amber-500 flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1L11 10H1L6 1Z" fill="black"/>
            </svg>
          </span>
          <span className="font-display text-base text-zinc-100 italic hidden sm:block">
            Fund<span className="text-amber-400 not-italic font-mono text-sm">DAO</span>
          </span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-0.5">
          {allLinks.map(({ href, label }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
            const isAdmin = href === '/admin'
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'px-3 py-1.5 text-xs font-mono rounded transition-colors',
                  active
                    ? isAdmin
                      ? 'text-violet-400 bg-violet-500/10'
                      : 'text-amber-400 bg-amber-500/10'
                    : isAdmin
                      ? 'text-zinc-500 hover:text-violet-300 hover:bg-violet-800/20'
                      : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50'
                )}
              >
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Right: token info + wallet */}
        <div className="flex items-center gap-3">
          {address && (balance as bigint) > 0n && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-800/60 border border-zinc-700/50">
              <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wide">FUND</span>
              <span className="text-xs font-mono font-semibold text-amber-400">{fmtEth((balance as bigint), 2)}</span>
            </div>
          )}
          <ConnectButton />
        </div>
      </div>
    </header>
  )
}