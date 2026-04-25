'use client'
import {
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { type Abi } from 'viem'
import { ADDRESSES } from '@/lib/constants'
import CampaignFactoryABI from '@/abi/CampaignFactory.json'
import FundTokenABI from '@/abi/FundToken.json'

const FACTORY = { address: ADDRESSES.factory, abi: CampaignFactoryABI as Abi } as const
const TOKEN   = { address: ADDRESSES.fundToken, abi: FundTokenABI as Abi } as const

const OPERATOR_ROLE    = '0x97667070c54ef182b0f5858b034beac1b6f3089aa2d3188bb1e8929f4fa9b929' as const
const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000' as const

// ─── Read: check roles ────────────────────────────────────────────────────────
export function useIsAdmin(address?: `0x${string}`) {
  const { data: isOperator } = useReadContract({
    ...FACTORY,
    functionName: 'hasRole',
    args: address ? [OPERATOR_ROLE, address] : undefined,
    query: { enabled: !!address },
  })

  const { data: isDefaultAdmin } = useReadContract({
    ...FACTORY,
    functionName: 'hasRole',
    args: address ? [DEFAULT_ADMIN_ROLE, address] : undefined,
    query: { enabled: !!address },
  })

  return {
    isOperator:     !!isOperator,
    isDefaultAdmin: !!isDefaultAdmin,
    hasAnyRole:     !!isOperator || !!isDefaultAdmin,
  }
}

// ─── Read: factory overview ───────────────────────────────────────────────────
export function useFactoryOverview() {
  return useReadContracts({
    contracts: [
      { ...FACTORY, functionName: 'paused'            },
      { ...FACTORY, functionName: 'getCampaignCount'  },
      { ...FACTORY, functionName: 's_platformFeeBps'  },
      { ...FACTORY, functionName: 's_feeRecipient'    },
      { ...FACTORY, functionName: 's_maxDurationDays' },
      { ...TOKEN,   functionName: 'totalSupply'        },
    ],
    query: { refetchInterval: 10_000 },
  })
}

// ─── Base write hook with auto-refetch ───────────────────────────────────────
function useAdminWrite() {
  const qc = useQueryClient()
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  // Invalidate all queries when tx confirmed → all UI updates
  if (isSuccess) qc.invalidateQueries()

  return { writeContract, hash, isPending, isConfirming, isSuccess, error, reset }
}

// ─── Write: pause / unpause factory ──────────────────────────────────────────
export function usePauseFactory() {
  const w = useAdminWrite()
  const pause   = () => w.writeContract({ ...FACTORY, functionName: 'pauseFactory'   })
  const unpause = () => w.writeContract({ ...FACTORY, functionName: 'unpauseFactory' })
  return { ...w, pause, unpause }
}

// ─── Write: set platform fee ──────────────────────────────────────────────────
export function useSetPlatformFee() {
  const w = useAdminWrite()
  const setFee = (bps: number) =>
    w.writeContract({ ...FACTORY, functionName: 'setPlatformFee', args: [bps] })
  return { ...w, setFee }
}

// ─── Write: set fee recipient ─────────────────────────────────────────────────
export function useSetFeeRecipient() {
  const w = useAdminWrite()
  const setRecipient = (addr: `0x${string}`) =>
    w.writeContract({ ...FACTORY, functionName: 'setFeeRecipient', args: [addr] })
  return { ...w, setRecipient }
}

// ─── Write: set max duration ──────────────────────────────────────────────────
export function useSetMaxDuration() {
  const w = useAdminWrite()
  const setDuration = (days: number) =>
    w.writeContract({ ...FACTORY, functionName: 'setMaxDuration', args: [days] })
  return { ...w, setDuration }
}

// ─── Write: campaign controls ─────────────────────────────────────────────────
export function useCampaignControls() {
  const w = useAdminWrite()
  const cancelCampaign   = (addr: `0x${string}`) =>
    w.writeContract({ ...FACTORY, functionName: 'cancelCampaign',           args: [addr] })
  const pauseCampaign    = (addr: `0x${string}`) =>
    w.writeContract({ ...FACTORY, functionName: 'pauseCampaign',            args: [addr] })
  const unpauseCampaign  = (addr: `0x${string}`) =>
    w.writeContract({ ...FACTORY, functionName: 'unpauseCampaign',          args: [addr] })
  const revokeTokenRoles = (addr: `0x${string}`) =>
    w.writeContract({ ...FACTORY, functionName: 'revokeCampaignTokenRoles', args: [addr] })
  return { ...w, cancelCampaign, pauseCampaign, unpauseCampaign, revokeTokenRoles }
}

// ─── Write: role management ───────────────────────────────────────────────────
export function useRoleManagement() {
  const w = useAdminWrite()
  const grantOperator  = (addr: `0x${string}`) =>
    w.writeContract({ ...FACTORY, functionName: 'grantRole',  args: [OPERATOR_ROLE, addr] })
  const revokeOperator = (addr: `0x${string}`) =>
    w.writeContract({ ...FACTORY, functionName: 'revokeRole', args: [OPERATOR_ROLE, addr] })
  return { ...w, grantOperator, revokeOperator }
}