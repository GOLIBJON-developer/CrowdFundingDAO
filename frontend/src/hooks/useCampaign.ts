'use client'
import {
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { parseEther } from 'viem'
import CrowdfundingCampaignABI from '@/abi/CrowdfundingCampaign.json'
import { parseCampaignInfo, type CampaignInfo } from '@/lib/utils'

// ─── Campaign contract helper ─────────────────────────────────────────────────
const campaignContract = (address: `0x${string}`) => ({
  address,
  abi: CrowdfundingCampaignABI,
})

// ─── Read: full campaign info ─────────────────────────────────────────────────
export function useCampaignInfo(address?: `0x${string}`) {
  const result = useReadContract({
    ...campaignContract(address!),
    functionName: 'getCampaignInfo',
    query: { enabled: !!address, refetchInterval: 10_000 },
  })

  const campaign: CampaignInfo | null =
    result.data && address
      ? parseCampaignInfo(address, result.data as any)
      : null

  return { ...result, campaign }
}

// ─── Read: multiple campaign fields ──────────────────────────────────────────
export function useCampaignStats(address?: `0x${string}`) {
  return useReadContracts({
    contracts: [
      { ...campaignContract(address!), functionName: 'fundingProgress' },
      { ...campaignContract(address!), functionName: 'timeRemaining' },
      { ...campaignContract(address!), functionName: 'isAcceptingContributions' },
      { ...campaignContract(address!), functionName: 's_state' },
    ],
    query: { enabled: !!address, refetchInterval: 10_000 },
  })
}

// ─── Read: user contribution ─────────────────────────────────────────────────
export function useMyContribution(campaignAddress?: `0x${string}`, userAddress?: `0x${string}`) {
  return useReadContract({
    ...campaignContract(campaignAddress!),
    functionName: 's_contributions',
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!campaignAddress && !!userAddress, refetchInterval: 10_000 },
  })
}

// ─── Write: contribute ────────────────────────────────────────────────────────
export function useContribute(campaignAddress?: `0x${string}`) {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  function contribute(ethAmount: string) {
    if (!campaignAddress) return
    writeContract({
      ...campaignContract(campaignAddress),
      functionName: 'contribute',
      value: parseEther(ethAmount),
    })
  }

  return { contribute, hash, isPending, isConfirming, isSuccess, error, reset }
}

// ─── Write: finalize ──────────────────────────────────────────────────────────
export function useFinalize(campaignAddress?: `0x${string}`) {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  function finalize() {
    if (!campaignAddress) return
    writeContract({ ...campaignContract(campaignAddress), functionName: 'finalize' })
  }

  return { finalize, hash, isPending, isConfirming, isSuccess, error }
}

// ─── Write: withdraw ──────────────────────────────────────────────────────────
export function useWithdraw(campaignAddress?: `0x${string}`) {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  function withdraw() {
    if (!campaignAddress) return
    writeContract({ ...campaignContract(campaignAddress), functionName: 'withdraw' })
  }

  return { withdraw, hash, isPending, isConfirming, isSuccess, error }
}

// ─── Write: refund ────────────────────────────────────────────────────────────
export function useRefund(campaignAddress?: `0x${string}`) {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  function refund() {
    if (!campaignAddress) return
    writeContract({ ...campaignContract(campaignAddress), functionName: 'refund' })
  }

  return { refund, hash, isPending, isConfirming, isSuccess, error }
}

// ─── Write: cancel ────────────────────────────────────────────────────────────
export function useCancel(campaignAddress?: `0x${string}`) {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  function cancel() {
    if (!campaignAddress) return
    writeContract({ ...campaignContract(campaignAddress), functionName: 'cancel' })
  }

  return { cancel, hash, isPending, isConfirming, isSuccess, error }
}