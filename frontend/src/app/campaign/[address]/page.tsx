'use client'
import { useParams } from 'next/navigation'
import { useAccount } from 'wagmi'
import { useCampaignInfo, useCampaignStats, useMyContribution } from '@/hooks/useCampaign'
import { ContributePanel, ActionPanel } from '@/components/campaign'
import { StatusBadge, ProgressBar, AddressChip } from '@/components/ui'
import { fmtEth, fmtCountdown, fmtDate, calcProgress } from '@/lib/utils'

export default function CampaignPage() {
  const { address: campaignAddr } = useParams<{ address: string }>()
  const { address: userAddr } = useAccount()

  const { campaign, isLoading } = useCampaignInfo(campaignAddr as `0x${string}`)
  const { data: stats }         = useCampaignStats(campaignAddr as `0x${string}`)
  const { data: myContrib }     = useMyContribution(campaignAddr as `0x${string}`, userAddr)

  // stats[2] = isAcceptingContributions, stats[4] = paused()
  const isAccepting  = stats?.[2]?.result as boolean | undefined
  const isPaused     = stats?.[4]?.result as boolean | undefined

  const progress       = campaign ? calcProgress(campaign.totalRaised, campaign.goal) : 0
  const myContribution = (myContrib as bigint | undefined) ?? 0n

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-4 animate-pulse">
        <div className="flex gap-3">
          <div className="h-6 w-20 bg-zinc-800 rounded" />
          <div className="h-6 w-40 bg-zinc-800 rounded" />
        </div>
        <div className="h-10 w-3/4 bg-zinc-800 rounded" />
        <div className="h-4 w-full bg-zinc-800/60 rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-40 bg-zinc-800/40 rounded-lg border border-zinc-800" />
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-zinc-800/40 rounded-lg border border-zinc-800" />
              ))}
            </div>
          </div>
          <div className="h-52 bg-zinc-800/40 rounded-lg border border-zinc-800" />
        </div>
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <p className="text-sm font-mono text-zinc-600">Campaign not found.</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          {/* Show PAUSED badge separately alongside state badge */}
          <StatusBadge state={campaign.state} paused={isPaused} />
          {/* If paused, also show the underlying state */}
          {isPaused && campaign.state === 0 && (
            <StatusBadge state={campaign.state} paused={false} />
          )}
          <AddressChip address={campaign.address} label="contract" chars={6} />
        </div>
        <h1 className="font-display italic text-3xl sm:text-4xl text-zinc-100 leading-tight mb-3">
          {campaign.title}
        </h1>
        <p className="text-sm font-mono text-zinc-500 leading-relaxed max-w-2xl">
          {campaign.description}
        </p>
        {/* Paused warning banner */}
        {isPaused && (
          <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded border
                          border-orange-500/25 bg-orange-500/5 text-orange-400 text-xs font-mono">
            ⚠ This campaign is currently paused by the admin. Contributions are temporarily disabled.
          </div>
        )}
      </div>

      {/* Layout: main + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Main */}
        <div className="lg:col-span-2 space-y-6">

          {/* Progress card */}
          <div className="p-6 rounded-lg border border-zinc-800 bg-zinc-900/40">
            <div className="flex items-end justify-between mb-4">
              <div>
                <div className="text-3xl font-mono font-bold text-zinc-100">
                  {fmtEth(campaign.totalRaised)}
                  <span className="text-lg text-zinc-500 ml-1">ETH</span>
                </div>
                <div className="text-xs font-mono text-zinc-600 mt-0.5">
                  raised of {fmtEth(campaign.goal)} ETH goal
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-mono font-bold text-amber-400">
                  {progress.toFixed(1)}%
                </div>
                <div className="text-xs font-mono text-zinc-600">funded</div>
              </div>
            </div>
            <ProgressBar value={progress} state={campaign.state} size="lg" />
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              {
                label: 'Goal',
                value: `${fmtEth(campaign.goal)} ETH`,
              },
              {
                label: 'Time Left',
                value: fmtCountdown(campaign.deadline),
                highlight: campaign.state === 0,
              },
              {
                label: 'Deadline',
                value: fmtDate(campaign.deadline),
              },
              {
                label: 'Creator',
                value: null,
                addr: campaign.creator,
              },
              {
                label: 'Withdrawn',
                value: campaign.withdrawn ? 'Yes' : 'No',
              },
              {
                label: 'Your Contribution',
                value: `${fmtEth(myContribution)} ETH`,
                highlight: myContribution > 0n,
              },
            ].map(({ label, value, addr, highlight }) => (
              <div key={label} className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/20">
                <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider mb-1">
                  {label}
                </div>
                {addr ? (
                  <AddressChip address={addr} chars={5} />
                ) : (
                  <div
                    className={`text-sm font-mono font-medium ${
                      highlight ? 'text-amber-400' : 'text-zinc-300'
                    }`}
                  >
                    {value}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <ContributePanel
            campaignAddress={campaignAddr as `0x${string}`}
            isAccepting={isAccepting ?? false}
            isPaused={isPaused ?? false}
          />
          <ActionPanel campaign={campaign} myContribution={myContribution} />
        </div>
      </div>
    </div>
  )
}