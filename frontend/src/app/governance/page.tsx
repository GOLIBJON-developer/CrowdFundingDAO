'use client'
import { useState } from 'react'
import { useAccount } from 'wagmi'
import {
  useGovernorSettings,
  useProposalState,
  useProposalVotes,
  useHasVoted,
  useCastVote,
  usePropose,
} from '@/hooks/useGovernance'
import { useMyTokenInfo } from '@/hooks/useFundToken'
import { useDelegate } from '@/hooks/useFundToken'
import { ProposalStateBadge, TxFeedback, Spinner, ConnectButton } from '@/components/ui'
import { fmtEth } from '@/lib/utils'

// Hardcoded recent proposal IDs for demo — in production, index from events
const DEMO_PROPOSAL_IDS: bigint[] = []

export default function GovernancePage() {
  const { address } = useAccount()
  const { balance, votes, delegatee } = useMyTokenInfo(address)
  const { votingDelay, votingPeriod, threshold, quorumNum } = useGovernorSettings()
  const delegateHook = useDelegate()
  const proposeHook = usePropose()

  const [proposalIdInput, setProposalIdInput] = useState('')
  const [lookedUpId, setLookedUpId] = useState<bigint | undefined>()
  const [newFee, setNewFee] = useState('')
  const [propDesc, setPropDesc] = useState('')
  const [cancelAddr, setCancelAddr] = useState('')
  const [cancelDesc, setCancelDesc] = useState('')
  const [propType, setPropType] = useState<'fee' | 'cancel'>('fee')
  const [voteReason, setVoteReason] = useState('')

  const { data: propState } = useProposalState(lookedUpId)
  const { data: propVotes } = useProposalVotes(lookedUpId)
  const { data: hasVoted } = useHasVoted(lookedUpId, address)
  const castVote = useCastVote()

  const isSelfDelegated = address && delegatee?.toLowerCase() === address.toLowerCase()
  const hasVotingPower = votes > 0n
  const hasEnoughToPropose = threshold.data !== undefined && votes >= (threshold.data as bigint)

  const fmtDuration = (secs?: bigint) => {
    if (!secs) return '—'
    const days = Number(secs) / 86400
    return days >= 1 ? `${days.toFixed(0)} days` : `${Math.round(Number(secs) / 3600)}h`
  }

  const votesSplit = propVotes as [bigint, bigint, bigint] | undefined

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">

      {/* Header */}
      <div className="mb-10">
        <h1 className="font-display italic text-3xl text-zinc-100 mb-2">DAO Governance</h1>
        <p className="text-sm font-mono text-zinc-500">
          FUND token holders vote on protocol decisions. 1 FUND = 1 vote.
        </p>
      </div>

      {/* Governor params */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        {[
          { label: 'Voting Delay',  value: fmtDuration(votingDelay.data as bigint) },
          { label: 'Voting Period', value: fmtDuration(votingPeriod.data as bigint) },
          { label: 'Threshold',     value: threshold.data ? `${fmtEth(threshold.data as bigint)} FUND` : '—' },
          { label: 'Quorum',        value: quorumNum.data ? `${quorumNum.data}%` : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/30">
            <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider mb-1">{label}</div>
            <div className="text-sm font-mono font-semibold text-zinc-200">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left: My Voting Power */}
        <div className="space-y-4">
          <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-wider">My Voting Power</h2>

          {!address ? (
            <div className="p-5 rounded-lg border border-zinc-800 text-center">
              <p className="text-xs font-mono text-zinc-600 mb-4">Connect to manage your votes</p>
              <ConnectButton />
            </div>
          ) : (
            <div className="p-5 rounded-lg border border-zinc-800 bg-zinc-900/40 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded bg-zinc-800/50">
                  <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider mb-1">FUND Balance</div>
                  <div className="text-lg font-mono font-semibold text-zinc-100">{fmtEth(balance, 2)}</div>
                </div>
                <div className="p-3 rounded bg-zinc-800/50">
                  <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider mb-1">Vote Weight</div>
                  <div className={`text-lg font-mono font-semibold ${hasVotingPower ? 'text-amber-400' : 'text-zinc-600'}`}>
                    {fmtEth(votes, 2)}
                  </div>
                </div>
              </div>

              {/* Delegation */}
              {balance > 0n && !isSelfDelegated && (
                <div className="p-3 rounded border border-amber-500/20 bg-amber-500/5">
                  <p className="text-xs font-mono text-amber-400 mb-2">
                    ⚠ Delegate to yourself to activate your {fmtEth(balance, 2)} FUND voting power.
                  </p>
                  <button
                    onClick={() => address && delegateHook.selfDelegate(address)}
                    disabled={delegateHook.isPending || delegateHook.isConfirming}
                    className="px-3 py-1.5 text-xs font-mono font-semibold bg-amber-500 text-black
                               rounded hover:bg-amber-400 transition-colors disabled:opacity-40
                               flex items-center gap-2"
                  >
                    {(delegateHook.isPending || delegateHook.isConfirming) && <Spinner />}
                    Self-delegate
                  </button>
                  <TxFeedback hash={delegateHook.hash} isPending={delegateHook.isPending}
                    isConfirming={delegateHook.isConfirming} isSuccess={delegateHook.isSuccess}
                    error={delegateHook.error} successMessage="Delegation confirmed!" />
                </div>
              )}

              {isSelfDelegated && (
                <p className="text-xs font-mono text-emerald-400">✓ Voting power active (self-delegated)</p>
              )}
            </div>
          )}

          {/* Proposal lookup */}
          <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-wider pt-2">Look Up Proposal</h2>
          <div className="p-5 rounded-lg border border-zinc-800 bg-zinc-900/40 space-y-3">
            <input
              value={proposalIdInput}
              onChange={(e) => setProposalIdInput(e.target.value)}
              placeholder="Proposal ID (uint256)"
              className="w-full bg-zinc-800/60 border border-zinc-700 rounded px-3 py-2
                         text-xs font-mono text-zinc-300 placeholder-zinc-600
                         focus:outline-none focus:border-amber-500/50 transition-colors"
            />
            <button
              onClick={() => {
                try { setLookedUpId(BigInt(proposalIdInput)) } catch {}
              }}
              className="px-4 py-1.5 text-xs font-mono bg-zinc-700 text-zinc-200
                         rounded hover:bg-zinc-600 transition-colors"
            >
              Look up
            </button>

            {lookedUpId !== undefined && (
              <div className="space-y-3 pt-2 border-t border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-zinc-500">State</span>
                  {propState !== undefined
                    ? <ProposalStateBadge state={propState as number} />
                    : <span className="text-xs font-mono text-zinc-700">—</span>
                  }
                </div>

                {votesSplit && (
                  <>
                    {[
                      { label: 'Against', votes: votesSplit[0], color: 'text-rose-400' },
                      { label: 'For',     votes: votesSplit[1], color: 'text-emerald-400' },
                      { label: 'Abstain', votes: votesSplit[2], color: 'text-zinc-500' },
                    ].map(({ label, votes: v, color }) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-xs font-mono text-zinc-600">{label}</span>
                        <span className={`text-xs font-mono font-semibold ${color}`}>{fmtEth(v, 2)} FUND</span>
                      </div>
                    ))}
                  </>
                )}

                {/* Vote buttons — only when Active (state=1) */}
                {propState === 1 && address && !hasVoted && (
                  <div className="flex gap-2 pt-1">
                    {([
                      { label: 'For',     support: 1 as const, cls: 'bg-emerald-600 text-white hover:bg-emerald-500' },
                      { label: 'Against', support: 0 as const, cls: 'bg-rose-600 text-white hover:bg-rose-500' },
                      { label: 'Abstain', support: 2 as const, cls: 'bg-zinc-700 text-zinc-200 hover:bg-zinc-600' },
                    ] as const).map(({ label, support, cls }) => (
                      <button
                        key={label}
                        onClick={() => castVote.castVote(lookedUpId, support)}
                        disabled={castVote.isPending || castVote.isConfirming}
                        className={`flex-1 py-1.5 text-xs font-mono font-semibold rounded
                                    transition-colors disabled:opacity-40 ${cls}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
                {hasVoted && (
                  <p className="text-xs font-mono text-emerald-400">✓ You have voted on this proposal</p>
                )}
                <TxFeedback hash={castVote.hash} isPending={castVote.isPending}
                  isConfirming={castVote.isConfirming} isSuccess={castVote.isSuccess}
                  error={castVote.error} successMessage="Vote cast!" />
              </div>
            )}
          </div>
        </div>

        {/* Right: Create Proposal */}
        <div className="space-y-4">
          <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Create Proposal</h2>

          {!address || !hasEnoughToPropose ? (
            <div className="p-5 rounded-lg border border-zinc-800 bg-zinc-900/40">
              <p className="text-xs font-mono text-zinc-600">
                {!address
                  ? 'Connect wallet to create proposals.'
                  : `Need ≥ ${threshold.data ? fmtEth(threshold.data as bigint, 0) : '1'} FUND to propose.`}
              </p>
            </div>
          ) : (
            <div className="p-5 rounded-lg border border-zinc-800 bg-zinc-900/40 space-y-4">
              {/* Proposal type selector */}
              <div className="flex gap-2">
                {(['fee', 'cancel'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setPropType(t)}
                    className={`flex-1 py-2 text-xs font-mono rounded border transition-colors ${
                      propType === t
                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                        : 'border-zinc-700 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {t === 'fee' ? 'Change Fee' : 'Cancel Campaign'}
                  </button>
                ))}
              </div>

              {propType === 'fee' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-mono text-zinc-600 uppercase tracking-wider mb-1.5">
                      New Fee (basis points, e.g. 300 = 3%)
                    </label>
                    <input
                      type="number" min="0" max="1000" value={newFee}
                      onChange={(e) => setNewFee(e.target.value)}
                      placeholder="250"
                      className="w-full bg-zinc-800/60 border border-zinc-700 rounded px-3 py-2
                                 text-xs font-mono text-zinc-300 placeholder-zinc-600
                                 focus:outline-none focus:border-amber-500/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-zinc-600 uppercase tracking-wider mb-1.5">
                      Description
                    </label>
                    <textarea
                      rows={2} value={propDesc} onChange={(e) => setPropDesc(e.target.value)}
                      placeholder="Rationale for changing the fee…"
                      className="w-full bg-zinc-800/60 border border-zinc-700 rounded px-3 py-2
                                 text-xs font-mono text-zinc-300 placeholder-zinc-600 resize-none
                                 focus:outline-none focus:border-amber-500/50 transition-colors"
                    />
                  </div>
                  <button
                    onClick={() => proposeHook.proposeSetFee(Number(newFee), propDesc)}
                    disabled={proposeHook.isPending || proposeHook.isConfirming || !newFee || !propDesc}
                    className="w-full py-2 text-xs font-mono font-semibold bg-amber-500 text-black
                               rounded hover:bg-amber-400 disabled:opacity-40 transition-colors
                               flex items-center justify-center gap-2"
                  >
                    {(proposeHook.isPending || proposeHook.isConfirming) && <Spinner />}
                    Submit Proposal
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-mono text-zinc-600 uppercase tracking-wider mb-1.5">
                      Campaign Address
                    </label>
                    <input
                      value={cancelAddr} onChange={(e) => setCancelAddr(e.target.value)}
                      placeholder="0x…"
                      className="w-full bg-zinc-800/60 border border-zinc-700 rounded px-3 py-2
                                 text-xs font-mono text-zinc-300 placeholder-zinc-600
                                 focus:outline-none focus:border-amber-500/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-zinc-600 uppercase tracking-wider mb-1.5">
                      Reason
                    </label>
                    <textarea
                      rows={2} value={cancelDesc} onChange={(e) => setCancelDesc(e.target.value)}
                      placeholder="Why should this campaign be cancelled?"
                      className="w-full bg-zinc-800/60 border border-zinc-700 rounded px-3 py-2
                                 text-xs font-mono text-zinc-300 placeholder-zinc-600 resize-none
                                 focus:outline-none focus:border-amber-500/50 transition-colors"
                    />
                  </div>
                  <button
                    onClick={() => proposeHook.proposeCancelCampaign(cancelAddr as `0x${string}`, cancelDesc)}
                    disabled={proposeHook.isPending || proposeHook.isConfirming || !cancelAddr || !cancelDesc}
                    className="w-full py-2 text-xs font-mono font-semibold bg-rose-600 text-white
                               rounded hover:bg-rose-500 disabled:opacity-40 transition-colors
                               flex items-center justify-center gap-2"
                  >
                    {(proposeHook.isPending || proposeHook.isConfirming) && <Spinner />}
                    Propose Cancellation
                  </button>
                </div>
              )}

              <TxFeedback hash={proposeHook.hash} isPending={proposeHook.isPending}
                isConfirming={proposeHook.isConfirming} isSuccess={proposeHook.isSuccess}
                error={proposeHook.error} successMessage="Proposal submitted!" />
            </div>
          )}

          {/* Info box */}
          <div className="p-4 rounded-lg border border-zinc-800/60 bg-zinc-900/20 space-y-2">
            <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider mb-2">Governance Flow</p>
            {[
              ['1', 'propose()', 'Submit a proposal (need ≥ threshold FUND)'],
              ['2', 'Voting delay', 'Wait before voting opens'],
              ['3', 'castVote()', 'Vote FOR / AGAINST / ABSTAIN'],
              ['4', 'queue()', 'If succeeded, queue in Timelock'],
              ['5', 'execute()', 'Execute after timelock delay'],
            ].map(([step, fn, desc]) => (
              <div key={step} className="flex gap-3 items-start">
                <span className="text-[10px] font-mono text-zinc-700 w-3 shrink-0">{step}</span>
                <span className="text-[10px] font-mono text-amber-500/70 w-20 shrink-0">{fn}</span>
                <span className="text-[10px] font-mono text-zinc-600">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}