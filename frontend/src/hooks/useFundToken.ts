'use client'
import {
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { ADDRESSES } from '@/lib/constants'
import FundTokenABI from '@/abi/FundToken.json'

const TOKEN = { address: ADDRESSES.fundToken, abi: FundTokenABI } as const

// ─── Read: token balance ──────────────────────────────────────────────────────
export function useTokenBalance(address?: `0x${string}`) {
  return useReadContract({
    ...TOKEN,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 10_000 },
  })
}

// ─── Read: current votes ──────────────────────────────────────────────────────
export function useTokenVotes(address?: `0x${string}`) {
  return useReadContract({
    ...TOKEN,
    functionName: 'getVotes',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 10_000 },
  })
}

// ─── Read: delegates ──────────────────────────────────────────────────────────
export function useTokenDelegate(address?: `0x${string}`) {
  return useReadContract({
    ...TOKEN,
    functionName: 'delegates',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })
}

// ─── Read: token overview ─────────────────────────────────────────────────────
export function useTokenStats() {
  return useReadContracts({
    contracts: [
      { ...TOKEN, functionName: 'totalSupply' },
      { ...TOKEN, functionName: 'name' },
      { ...TOKEN, functionName: 'symbol' },
    ],
  })
}

// ─── Write: delegate ──────────────────────────────────────────────────────────
export function useDelegate() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  function delegateTo(delegatee: `0x${string}`) {
    writeContract({ ...TOKEN, functionName: 'delegate', args: [delegatee] })
  }

  /** Self-delegate — activates voting power */
  function selfDelegate(address: `0x${string}`) {
    delegateTo(address)
  }

  return { delegateTo, selfDelegate, hash, isPending, isConfirming, isSuccess, error }
}

// ─── Convenience: full token info for a user ─────────────────────────────────
export function useMyTokenInfo(address?: `0x${string}`) {
  const balance   = useTokenBalance(address)
  const votes     = useTokenVotes(address)
  const delegates = useTokenDelegate(address)

  return {
    balance:   balance.data ?? 0n,
    votes:     votes.data   ?? 0n,
    delegatee: delegates.data as `0x${string}` | undefined,
    isLoading: balance.isLoading || votes.isLoading,
    refetch:   () => { balance.refetch(); votes.refetch(); delegates.refetch() },
  }
}
