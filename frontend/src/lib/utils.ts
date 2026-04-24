import { formatEther, formatUnits } from 'viem'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import {
  CAMPAIGN_STATE,
  type CampaignStateKey,
  type CampaignStateName,
  EXPLORER_URL,
  DEFAULT_CHAIN_ID,
} from './constants'

// ─── Tailwind ─────────────────────────────────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Address ──────────────────────────────────────────────────────────────────
export function shortAddress(address: string, chars = 4): string {
  if (!address) return ''
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`
}

export function explorerUrl(hash: string, type: 'tx' | 'address' = 'tx'): string {
  const base = EXPLORER_URL[DEFAULT_CHAIN_ID as keyof typeof EXPLORER_URL] ?? ''
  return base ? `${base}/${type}/${hash}` : '#'
}

// ─── Formatting ───────────────────────────────────────────────────────────────
export function fmtEth(wei: bigint, decimals = 4): string {
  return Number(formatEther(wei)).toFixed(decimals).replace(/\.?0+$/, '')
}

export function fmtEthFull(wei: bigint): string {
  return formatEther(wei)
}

/** basis points → percentage string e.g. 250 → "2.5%" */
export function fmtFeeBps(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`
}

export function fmtCountdown(deadlineTs: number): string {
  const diff = deadlineTs - Math.floor(Date.now() / 1000)
  if (diff <= 0) return 'Ended'
  const d = Math.floor(diff / 86400)
  const h = Math.floor((diff % 86400) / 3600)
  const m = Math.floor((diff % 3600) / 60)
  if (d > 0) return `${d}d ${h}h left`
  if (h > 0) return `${h}h ${m}m left`
  return `${m}m left`
}

export function fmtDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

// ─── Campaign state helpers ───────────────────────────────────────────────────
export function stateName(state: number): CampaignStateName {
  return CAMPAIGN_STATE[state as CampaignStateKey] ?? 'UNKNOWN'
}

export type StateColor = 'amber' | 'emerald' | 'rose' | 'zinc' | 'violet'

export function stateColor(state: number): StateColor {
  switch (state) {
    case 0: return 'amber'    // ACTIVE
    case 1: return 'emerald'  // SUCCESSFUL
    case 2: return 'rose'     // FAILED
    case 3: return 'zinc'     // CANCELLED
    default: return 'zinc'
  }
}

// ─── Progress ─────────────────────────────────────────────────────────────────
export function calcProgress(raised: bigint, goal: bigint): number {
  if (goal === 0n) return 0
  return Math.min(100, Number((raised * 10000n) / goal) / 100)
}

// ─── Campaign info type ───────────────────────────────────────────────────────
export interface CampaignInfo {
  address: `0x${string}`
  creator: `0x${string}`
  goal: bigint
  totalRaised: bigint
  deadline: number
  state: number
  withdrawn: boolean
  title: string
  description: string
}

export function parseCampaignInfo(
  address: `0x${string}`,
  raw: readonly [string, bigint, bigint, number, number, boolean, string, string]
): CampaignInfo {
  return {
    address,
    creator:      raw[0] as `0x${string}`,
    goal:         raw[1],
    totalRaised:  raw[2],
    deadline:     Number(raw[3]),
    state:        raw[4],
    withdrawn:    raw[5],
    title:        raw[6],
    description:  raw[7],
  }
}