import { cn, stateName, stateColor, type StateColor } from '@/lib/utils'

const colorMap: Record<StateColor, string> = {
  amber:   'bg-amber-500/10 text-amber-400 border-amber-500/25 before:bg-amber-400',
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25 before:bg-emerald-400',
  rose:    'bg-rose-500/10 text-rose-400 border-rose-500/25 before:bg-rose-400',
  zinc:    'bg-zinc-500/10 text-zinc-400 border-zinc-500/25 before:bg-zinc-400',
  violet:  'bg-violet-500/10 text-violet-400 border-violet-500/25 before:bg-violet-400',
}

interface StatusBadgeProps {
  state: number
  paused?: boolean   // ← NEW: shows PAUSED overlay when true
  className?: string
  pulse?: boolean
}

export function StatusBadge({ state, paused = false, className, pulse = true }: StatusBadgeProps) {
  // PAUSED overrides everything visually
  if (paused) {
    return (
      <span className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium',
        'border rounded-sm uppercase tracking-wider font-mono',
        'bg-orange-500/10 text-orange-400 border-orange-500/25',
        'before:block before:w-1.5 before:h-1.5 before:rounded-full before:bg-orange-400',
        className
      )}>
        PAUSED
      </span>
    )
  }

  const color = stateColor(state)
  const name  = stateName(state)
  const isPulsing = pulse && state === 0

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium',
      'border rounded-sm uppercase tracking-wider font-mono',
      'before:block before:w-1.5 before:h-1.5 before:rounded-full',
      colorMap[color],
      isPulsing && 'before:animate-pulse',
      className
    )}>
      {name}
    </span>
  )
}

// ─── Proposal state badge ─────────────────────────────────────────────────────
const proposalColors: Record<number, string> = {
  0: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/25',
  1: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
  2: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/25',
  3: 'bg-rose-500/10 text-rose-400 border-rose-500/25',
  4: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
  5: 'bg-violet-500/10 text-violet-400 border-violet-500/25',
  6: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/25',
  7: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25',
}

const proposalNames: Record<number, string> = {
  0: 'Pending', 1: 'Active',   2: 'Canceled',
  3: 'Defeated', 4: 'Succeeded', 5: 'Queued',
  6: 'Expired',  7: 'Executed',
}

export function ProposalStateBadge({ state }: { state: number }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 text-xs font-mono font-medium',
      'border rounded-sm uppercase tracking-wider',
      proposalColors[state] ?? proposalColors[0]
    )}>
      {proposalNames[state] ?? 'Unknown'}
    </span>
  )
}