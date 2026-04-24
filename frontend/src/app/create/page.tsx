'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount } from 'wagmi'
import { useCreateCampaign } from '@/hooks/useFactory'
import { useFactoryStats } from '@/hooks/useFactory'
import { TxFeedback, ConnectButton } from '@/components/ui'
import { fmtFeeBps, MAX_TITLE_LENGTH, MAX_DESCRIPTION_LENGTH } from '@/lib/utils'
import { parseEther } from 'viem'

const DURATION_PRESETS = [
  { label: '7 days',  days: 7  },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
  { label: '60 days', days: 60 },
  { label: '90 days', days: 90 },
]

export default function CreatePage() {
  const router = useRouter()
  const { address } = useAccount()
  const { createCampaign, hash, isPending, isConfirming, isSuccess, error } = useCreateCampaign()
  const { data: stats } = useFactoryStats()

  const [form, setForm] = useState({
    title: '',
    description: '',
    goalEth: '',
    days: 30,
  })

  const platformFee = stats?.[1]?.result as number | undefined
  const deadlineTs = Math.floor(Date.now() / 1000) + form.days * 86400

  function set(key: string, val: string | number) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.goalEth || !form.description) return
    createCampaign({
      goalEth: form.goalEth,
      deadlineTimestamp: deadlineTs,
      title: form.title,
      description: form.description,
    })
  }

  if (isSuccess) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/25
                        flex items-center justify-center text-2xl mx-auto mb-6">✓</div>
        <h2 className="font-display italic text-2xl text-zinc-100 mb-3">Campaign launched!</h2>
        <p className="text-sm font-mono text-zinc-500 mb-8">
          Your campaign is now live on the blockchain and accepting contributions.
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => router.push('/')}
            className="px-5 py-2 text-xs font-mono bg-zinc-800 text-zinc-200 rounded hover:bg-zinc-700 transition-colors">
            View all campaigns
          </button>
        </div>
        <TxFeedback hash={hash} isSuccess={isSuccess} />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-10">
        <h1 className="font-display italic text-3xl text-zinc-100 mb-2">Launch a campaign</h1>
        <p className="text-sm font-mono text-zinc-500">
          Create a crowdfunding campaign. Contributors receive FUND governance tokens proportional to their ETH.
        </p>
      </div>

      {!address ? (
        <div className="p-8 rounded-lg border border-zinc-800 bg-zinc-900/30 text-center">
          <p className="text-sm font-mono text-zinc-500 mb-5">Connect your wallet to launch a campaign.</p>
          <ConnectButton />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Title */}
          <div>
            <label className="block text-xs font-mono text-zinc-400 uppercase tracking-wider mb-2">
              Campaign Title
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              maxLength={MAX_TITLE_LENGTH}
              placeholder="Build a public good…"
              required
              className="w-full bg-zinc-800/60 border border-zinc-700 rounded px-4 py-3
                         font-display italic text-lg text-zinc-100 placeholder-zinc-700
                         focus:outline-none focus:border-amber-500/50 transition-colors"
            />
            <div className="flex justify-end mt-1">
              <span className="text-[10px] font-mono text-zinc-700">
                {form.title.length}/{MAX_TITLE_LENGTH}
              </span>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-mono text-zinc-400 uppercase tracking-wider mb-2">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              maxLength={MAX_DESCRIPTION_LENGTH}
              rows={4}
              placeholder="Describe what you're building and why it matters…"
              required
              className="w-full bg-zinc-800/60 border border-zinc-700 rounded px-4 py-3
                         text-sm font-mono text-zinc-100 placeholder-zinc-700 resize-none
                         focus:outline-none focus:border-amber-500/50 transition-colors"
            />
            <div className="flex justify-end mt-1">
              <span className="text-[10px] font-mono text-zinc-700">
                {form.description.length}/{MAX_DESCRIPTION_LENGTH}
              </span>
            </div>
          </div>

          {/* Goal + Duration row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Funding goal */}
            <div>
              <label className="block text-xs font-mono text-zinc-400 uppercase tracking-wider mb-2">
                Funding Goal (ETH)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={form.goalEth}
                  onChange={(e) => set('goalEth', e.target.value)}
                  placeholder="1.0"
                  required
                  className="w-full bg-zinc-800/60 border border-zinc-700 rounded px-4 py-3
                             text-sm font-mono text-zinc-100 pr-12 placeholder-zinc-700
                             focus:outline-none focus:border-amber-500/50 transition-colors"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-zinc-500">ETH</span>
              </div>
              {platformFee !== undefined && form.goalEth && (
                <p className="text-[10px] font-mono text-zinc-600 mt-1">
                  Platform takes {fmtFeeBps(platformFee)} on success ≈{' '}
                  {(Number(form.goalEth) * platformFee / 10000).toFixed(4)} ETH
                </p>
              )}
            </div>

            {/* Duration */}
            <div>
              <label className="block text-xs font-mono text-zinc-400 uppercase tracking-wider mb-2">
                Duration
              </label>
              <div className="flex flex-wrap gap-1.5">
                {DURATION_PRESETS.map(({ label, days }) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => set('days', days)}
                    className={`px-2.5 py-1.5 text-xs font-mono rounded border transition-colors ${
                      form.days === days
                        ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                        : 'border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] font-mono text-zinc-600 mt-2">
                Ends: {new Date(deadlineTs * 1000).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric'
                })}
              </p>
            </div>
          </div>

          {/* Summary box */}
          {form.title && form.goalEth && (
            <div className="p-4 rounded-lg border border-zinc-700/50 bg-zinc-800/30 space-y-2">
              <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3">Summary</p>
              {[
                ['Title',       form.title],
                ['Goal',        `${form.goalEth} ETH`],
                ['Duration',    `${form.days} days`],
                ['Deadline',    new Date(deadlineTs * 1000).toLocaleDateString()],
                ['Platform fee', platformFee !== undefined ? fmtFeeBps(platformFee) : '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-xs font-mono text-zinc-600">{k}</span>
                  <span className="text-xs font-mono text-zinc-300 text-right max-w-[60%] truncate">{v}</span>
                </div>
              ))}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isPending || isConfirming || !form.title || !form.goalEth || !form.description}
            className="w-full py-3 text-sm font-mono font-semibold rounded
                       bg-amber-500 text-black hover:bg-amber-400
                       disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors flex items-center justify-center gap-2"
          >
            {(isPending || isConfirming) && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
            )}
            {isPending ? 'Confirm in wallet…' : isConfirming ? 'Deploying campaign…' : 'Launch Campaign'}
          </button>

          <TxFeedback hash={hash} isPending={isPending} isConfirming={isConfirming} error={error} />
        </form>
      )}
    </div>
  )
}