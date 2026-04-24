import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number // 0-100
  className?: string
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
  state?: number // campaign state for color
}

export function ProgressBar({
  value,
  className,
  showLabel = false,
  size = 'md',
  state = 0,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))

  const colors: Record<number, string> = {
    0: 'bg-amber-500',
    1: 'bg-emerald-500',
    2: 'bg-rose-500',
    3: 'bg-zinc-500',
  }

  const heights = { sm: 'h-1', md: 'h-2', lg: 'h-3' }
  const barColor = colors[state] ?? colors[0]

  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs text-zinc-400 font-mono">Progress</span>
          <span className="text-xs font-mono font-semibold text-zinc-200">
            {clamped.toFixed(1)}%
          </span>
        </div>
      )}
      <div className={cn('w-full bg-zinc-800 rounded-full overflow-hidden', heights[size])}>
        <div
          className={cn('h-full rounded-full transition-all duration-700', barColor)}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}
