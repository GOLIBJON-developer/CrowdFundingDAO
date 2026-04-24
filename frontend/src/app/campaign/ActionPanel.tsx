'use client'
import { useAccount } from 'wagmi'
import { useFinalize, useWithdraw, useRefund, useCancel } from '@/hooks/useCampaign'
import { TxFeedback, Spinner } from '@/components/ui'
import { fmtEth, type CampaignInfo } from '@/lib/utils'

interface ActionPanelProps {
  campaign: CampaignInfo
  myContribution: bigint
}

export function ActionPanel({ campaign, myContribution }: ActionPanelProps) {
  const { address } = useAccount()
  const finalize = useFinalize(campaign.address)
  const withdraw = useWithdraw(campaign.address)
  const refund   = useRefund(campaign.address)
  const cancel   = useCancel(campaign.address)

  const isCreator = address?.toLowerCase() === campaign.creator.toLowerCase()
  const isPastDeadline = Date.now() / 1000 > campaign.deadline

  const actions = [
    {
      label: 'Finalize Campaign',
      desc: 'Deadline passed. Anyone can call this.',
      show: campaign.state === 0 && isPastDeadline,
      pending: finalize.isPending || finalize.isConfirming,
      fn: finalize.finalize,
      fb: finalize,
      cls: 'bg-amber-500 text-black hover:bg-amber-400',
    },
    {
      label: `Withdraw ${fmtEth(campaign.totalRaised)} ETH`,
      desc: 'Campaign succeeded — your funds are ready.',
      show: campaign.state === 1 && isCreator && !campaign.withdrawn,
      pending: withdraw.isPending || withdraw.isConfirming,
      fn: withdraw.withdraw,
      fb: withdraw,
      cls: 'bg-emerald-600 text-white hover:bg-emerald-500',
    },
    {
      label: `Refund ${fmtEth(myContribution)} ETH`,
      desc: 'Campaign failed or cancelled — get your ETH back + tokens burned.',
      show: (campaign.state === 2 || campaign.state === 3) && myContribution > 0n,
      pending: refund.isPending || refund.isConfirming,
      fn: refund.refund,
      fb: refund,
      cls: 'bg-violet-600 text-white hover:bg-violet-500',
    },
    {
      label: 'Cancel Campaign',
      desc: 'Cancel your campaign. Contributors will be able to refund.',
      show: campaign.state === 0 && isCreator,
      pending: cancel.isPending || cancel.isConfirming,
      fn: cancel.cancel,
      fb: cancel,
      cls: 'border border-rose-500/40 text-rose-400 hover:bg-rose-500/10',
    },
  ]

  const visible = actions.filter((a) => a.show)
  if (visible.length === 0) return null

  return (
    <div className="space-y-3">
      {visible.map((a) => (
        <div key={a.label} className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/40">
          <p className="text-xs font-mono text-zinc-500 mb-3">{a.desc}</p>
          <button onClick={a.fn} disabled={a.pending}
            className={`w-full py-2.5 text-xs font-mono font-semibold rounded
                        disabled:opacity-40 disabled:cursor-not-allowed
                        transition-colors flex items-center justify-center gap-2 ${a.cls}`}>
            {a.pending && <Spinner />}
            {a.label}
          </button>
          <TxFeedback hash={a.fb.hash} isPending={a.fb.isPending}
            isConfirming={a.fb.isConfirming} isSuccess={a.fb.isSuccess} error={a.fb.error} />
        </div>
      ))}
    </div>
  )
}