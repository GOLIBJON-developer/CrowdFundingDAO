'use client'
import Link from 'next/link'
import { StatusBadge, ProgressBar, AddressChip } from '@/components/ui'
import { fmtEth, fmtCountdown, calcProgress, type CampaignInfo, cn } from '@/lib/utils'

interface CampaignCardProps {
  campaign: CampaignInfo
  style?: React.CSSProperties
}

export function CampaignCard({ campaign, style }: CampaignCardProps) {
  const progress = calcProgress(campaign.totalRaised, campaign.goal)
  const timeLeft = fmtCountdown(campaign.deadline)

  return (
    <Link
      href={`/campaign/${campaign.address}`}
      className="group block p-5 rounded-lg border border-zinc-800 bg-zinc-900/40 card-hover animate-fade-up"
      style={style}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <h3 className="font-display italic text-zinc-100 text-lg leading-tight line-clamp-2 flex-1">
          {campaign.title}
        </h3>
        <StatusBadge state={campaign.state} className="shrink-0 mt-0.5" />
      </div>
      <p className="text-xs text-zinc-500 font-mono leading-relaxed line-clamp-2 mb-5">
        {campaign.description}
      </p>
      <div className="mb-4">
        <ProgressBar value={progress} state={campaign.state} size="sm" />
        <div className="flex justify-between mt-2">
          <div>
            <span className="text-base font-mono font-semibold text-zinc-100">
              {fmtEth(campaign.totalRaised)} ETH
            </span>
            <span className="text-xs text-zinc-600 font-mono ml-1">
              / {fmtEth(campaign.goal)} goal
            </span>
          </div>
          <span className="text-xs font-mono text-zinc-500">{progress.toFixed(1)}%</span>
        </div>
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
        <AddressChip address={campaign.creator} label="by" chars={4} />
        <span className={cn(
          'text-xs font-mono',
          campaign.state === 0 ? 'text-amber-500' : 'text-zinc-600'
        )}>
          {timeLeft}
        </span>
      </div>
    </Link>
  )
}