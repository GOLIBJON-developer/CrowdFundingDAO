'use client'
import { useState } from 'react'
import { useAccount } from 'wagmi'
import { useContribute, useMyContribution } from '@/hooks/useCampaign'
import { TxFeedback, Spinner } from '@/components/ui'
import { fmtEth } from '@/lib/utils'

interface ContributePanelProps {
  campaignAddress: `0x${string}`
  isAccepting: boolean
  onSuccess?: () => void
}

export function ContributePanel({ campaignAddress, isAccepting, onSuccess }: ContributePanelProps) {
  const [amount, setAmount] = useState('')
  const { address } = useAccount()
  const { contribute, hash, isPending, isConfirming, isSuccess, error, reset } = useContribute(campaignAddress)
  const { data: myContribution } = useMyContribution(campaignAddress, address)
  const PRESETS = ['0.01', '0.05', '0.1', '0.5', '1']

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) return
    contribute(amount)
  }

  if (isSuccess) {
    return (
      <div className="p-4 rounded-lg border border-emerald-500/25 bg-emerald-500/5">
        <p className="text-emerald-400 font-mono text-sm font-medium mb-1">✓ Contribution confirmed</p>
        <p className="text-zinc-500 font-mono text-xs">You received FUND governance tokens.</p>
        <button onClick={() => { reset(); setAmount(''); onSuccess?.() }}
          className="mt-3 text-xs font-mono text-zinc-400 hover:text-zinc-200 underline">
          Contribute more
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/40">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-mono font-semibold text-zinc-200">Back this campaign</h3>
        {address && myContribution !== undefined && (myContribution as bigint) > 0n && (
          <span className="text-xs font-mono text-zinc-500">
            Your total: <span className="text-amber-400">{fmtEth(myContribution as bigint)} ETH</span>
          </span>
        )}
      </div>
      {!isAccepting ? (
        <p className="text-xs font-mono text-zinc-600 py-2">Not accepting contributions.</p>
      ) : !address ? (
        <p className="text-xs font-mono text-zinc-500 py-2">Connect wallet to contribute.</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-1.5 flex-wrap">
            {PRESETS.map((p) => (
              <button key={p} type="button" onClick={() => setAmount(p)}
                className={`px-2.5 py-1 text-xs font-mono rounded border transition-colors ${
                  amount === p
                    ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                    : 'border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                }`}>
                {p}
              </button>
            ))}
          </div>
          <div className="relative">
            <input type="number" step="0.001" min="0.001" value={amount}
              onChange={(e) => setAmount(e.target.value)} placeholder="0.0"
              className="w-full bg-zinc-800/60 border border-zinc-700 rounded px-3 py-2.5
                         text-sm font-mono text-zinc-100 pr-12 placeholder-zinc-600
                         focus:outline-none focus:border-amber-500/50 transition-colors" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-zinc-500">ETH</span>
          </div>
          <button type="submit" disabled={isPending || isConfirming || !amount}
            className="w-full py-2.5 text-xs font-mono font-semibold rounded
                       bg-amber-500 text-black hover:bg-amber-400
                       disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors flex items-center justify-center gap-2">
            {(isPending || isConfirming) && <Spinner />}
            {isPending ? 'Confirm in wallet…' : isConfirming ? 'Confirming…' : 'Contribute'}
          </button>
          <TxFeedback hash={hash} isPending={isPending} isConfirming={isConfirming} error={error} />
        </form>
      )}
    </div>
  )
}