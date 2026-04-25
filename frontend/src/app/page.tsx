'use client'
import { useState } from 'react'
import { useGetCampaigns, useCampaignInfoBulk, useFactoryStats } from '@/hooks/useFactory'
import { CampaignCard } from '@/components/campaign'
import { fmtEth, fmtFeeBps } from '@/lib/utils'

const STATES = ['All', 'Active', 'Successful', 'Failed', 'Cancelled'] as const
type FilterState = typeof STATES[number]

export default function HomePage() {
  const [filter, setFilter] = useState<FilterState>('All')
  const { data: addresses, isLoading: loadingAddrs } = useGetCampaigns()
  const { campaigns, isLoading: loadingInfo } = useCampaignInfoBulk((addresses as `0x${string}`[]) ?? [])
  const { data: stats } = useFactoryStats()

  const totalRaised = campaigns.reduce((a, c) => a + c.totalRaised, 0n)
  const platformFee = stats?.[1]?.result as number | undefined

  const filtered = campaigns.filter((c) => {
    if (filter === 'All')        return true
    if (filter === 'Active')     return c.state === 0
    if (filter === 'Successful') return c.state === 1
    if (filter === 'Failed')     return c.state === 2
    if (filter === 'Cancelled')  return c.state === 3
    return true
  })

  const isLoading = loadingAddrs || loadingInfo

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">

      {/* Hero */}
      <div className="mb-14 max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/20
                        bg-amber-500/5 text-amber-400 text-xs font-mono mb-6 tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          Decentralized · Permissionless · On-chain
        </div>
        <h1 className="font-display italic text-4xl sm:text-5xl text-zinc-100 leading-tight mb-4">
          Fund what matters,<br />
          <span className="text-gradient-amber">governed by all.</span>
        </h1>
        <p className="text-sm font-mono text-zinc-500 leading-relaxed">
          Launch campaigns backed by smart contracts. Contributors receive governance tokens.
          The community decides what gets funded.
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        {[
          { label: 'Campaigns',    value: campaigns.length.toString() },
          { label: 'Total Raised', value: `${fmtEth(totalRaised)} ETH` },
          { label: 'Active Now',   value: campaigns.filter((c) => c.state === 0).length.toString() },
          { label: 'Platform Fee', value: platformFee !== undefined ? fmtFeeBps(platformFee) : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/30">
            <div className="text-xs font-mono text-zinc-600 uppercase tracking-wider mb-1">{label}</div>
            <div className="text-lg font-mono font-semibold text-zinc-100">{value}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-6 flex-wrap">
        {STATES.map((s) => {
          const count = s === 'All' ? campaigns.length
            : campaigns.filter((c) =>
                s === 'Active'     ? c.state === 0 :
                s === 'Successful' ? c.state === 1 :
                s === 'Failed'     ? c.state === 2 :
                                     c.state === 3
              ).length
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 text-xs font-mono rounded transition-colors ${
                filter === s
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
              }`}
            >
              {s}
              <span className="ml-1.5 text-[10px] text-zinc-600">{count}</span>
            </button>
          )
        })}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-56 rounded-lg border border-zinc-800 bg-zinc-900/30 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-24 text-center">
          <div className="text-4xl mb-4 opacity-20">◎</div>
          <p className="text-sm font-mono text-zinc-600">
            {campaigns.length === 0 ? 'No campaigns yet. Be the first to launch one.' : 'No campaigns match this filter.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((campaign, i) => (
            <CampaignCard
              key={campaign.address}
              campaign={campaign}
              style={{ animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>
      )}
    </div>
  )
}