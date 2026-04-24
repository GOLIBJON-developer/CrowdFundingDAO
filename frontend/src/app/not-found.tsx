import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      <div className="text-7xl font-mono font-bold text-zinc-800 mb-6">404</div>
      <h2 className="font-display italic text-2xl text-zinc-400 mb-3">Page not found</h2>
      <p className="text-sm font-mono text-zinc-600 mb-8 text-center max-w-sm">
        The page you're looking for doesn't exist or the campaign address is invalid.
      </p>
      <Link href="/"
        className="px-5 py-2.5 text-xs font-mono font-semibold bg-amber-500 text-black
                   rounded hover:bg-amber-400 transition-colors">
        Back to Campaigns
      </Link>
    </div>
  )
}