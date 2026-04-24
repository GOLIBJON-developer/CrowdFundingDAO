'use client'
import { explorerUrl } from '@/lib/utils'
import { shortAddress } from '@/lib/utils'

interface TxFeedbackProps {
  hash?: `0x${string}`
  isPending?: boolean
  isConfirming?: boolean
  isSuccess?: boolean
  error?: Error | null
  successMessage?: string
}

export function TxFeedback({
  hash,
  isPending,
  isConfirming,
  isSuccess,
  error,
  successMessage = 'Transaction confirmed!',
}: TxFeedbackProps) {
  if (!isPending && !isConfirming && !isSuccess && !error) return null

  return (
    <div className="mt-3 p-3 rounded border text-xs font-mono">
      {isPending && (
        <div className="text-amber-400 border-amber-500/20 bg-amber-500/5 border rounded p-2 flex items-center gap-2">
          <span className="animate-spin inline-block">⟳</span>
          Confirm in wallet…
        </div>
      )}
      {isConfirming && hash && (
        <div className="text-violet-400 border-violet-500/20 bg-violet-500/5 border rounded p-2 flex items-center gap-2">
          <span className="animate-pulse">◉</span>
          Confirming…{' '}
          <a
            href={explorerUrl(hash)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-violet-300"
          >
            {shortAddress(hash, 6)}
          </a>
        </div>
      )}
      {isSuccess && (
        <div className="text-emerald-400 border-emerald-500/20 bg-emerald-500/5 border rounded p-2">
          ✓ {successMessage}
          {hash && (
            <>
              {' '}
              <a
                href={explorerUrl(hash)}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                View tx
              </a>
            </>
          )}
        </div>
      )}
      {error && (
        <div className="text-rose-400 border-rose-500/20 bg-rose-500/5 border rounded p-2">
          ✗ {(error as any)?.shortMessage ?? error.message}
        </div>
      )}
    </div>
  )
}

/** Inline spinner */
export function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin h-4 w-4 ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}
