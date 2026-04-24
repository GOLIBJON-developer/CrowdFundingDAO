'use client'
import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      <div className="text-4xl mb-6 opacity-20">⚠</div>
      <h2 className="font-display italic text-2xl text-zinc-400 mb-3">Something went wrong</h2>
      <p className="text-xs font-mono text-zinc-600 mb-6 max-w-md text-center">
        {error.message ?? 'An unexpected error occurred. Check the console for details.'}
      </p>
      <div className="flex gap-3">
        <button onClick={reset}
          className="px-5 py-2.5 text-xs font-mono font-semibold bg-amber-500 text-black
                     rounded hover:bg-amber-400 transition-colors">
          Try again
        </button>
        <a href="/"
          className="px-5 py-2.5 text-xs font-mono border border-zinc-700 text-zinc-400
                     rounded hover:border-zinc-500 hover:text-zinc-200 transition-colors">
          Go home
        </a>
      </div>
    </div>
  )
}