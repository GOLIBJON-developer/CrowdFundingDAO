import { sepolia, mainnet, hardhat } from 'wagmi/chains'
import type { Chain } from 'viem'

// ─── Chain ───────────────────────────────────────────────────────────────────
export const SUPPORTED_CHAINS = [sepolia, hardhat] as const

export const DEFAULT_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_CHAIN_ID ?? 11155111
)

// ─── Contract Addresses ───────────────────────────────────────────────────────
export const ADDRESSES = {
  factory:   (process.env.NEXT_PUBLIC_FACTORY_ADDRESS    ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
  fundToken: (process.env.NEXT_PUBLIC_FUND_TOKEN_ADDRESS ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
  governor:  (process.env.NEXT_PUBLIC_GOVERNOR_ADDRESS   ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
  timelock:  (process.env.NEXT_PUBLIC_TIMELOCK_ADDRESS   ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
} as const

// ─── Campaign State ───────────────────────────────────────────────────────────
export const CAMPAIGN_STATE = {
  0: 'ACTIVE',
  1: 'SUCCESSFUL',
  2: 'FAILED',
  3: 'CANCELLED',
} as const

export type CampaignStateKey = keyof typeof CAMPAIGN_STATE
export type CampaignStateName = (typeof CAMPAIGN_STATE)[CampaignStateKey]

// ─── Proposal State (OZ Governor) ────────────────────────────────────────────
export const PROPOSAL_STATE = {
  0: 'Pending',
  1: 'Active',
  2: 'Canceled',
  3: 'Defeated',
  4: 'Succeeded',
  5: 'Queued',
  6: 'Expired',
  7: 'Executed',
} as const

// ─── Config ───────────────────────────────────────────────────────────────────
export const PLATFORM_FEE_DENOMINATOR = 10_000n
export const MAX_TITLE_LENGTH = 80
export const MAX_DESCRIPTION_LENGTH = 500
export const EXPLORER_URL = {
  [sepolia.id]: 'https://sepolia.etherscan.io',
  [hardhat.id]: '',
}