'use client'
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContracts,
} from 'wagmi'
import { parseEther } from 'viem'
import { ADDRESSES } from '@/lib/constants'
import CampaignFactoryABI from '@/abi/CampaignFactory.json'
import CrowdfundingCampaignABI from '@/abi/CrowdfundingCampaign.json'
import { parseCampaignInfo, type CampaignInfo } from '@/lib/utils'

const FACTORY = { address: ADDRESSES.factory, abi: CampaignFactoryABI } as const

// ─── Read: all campaign addresses ────────────────────────────────────────────
export function useGetCampaigns() {
  return useReadContract({ ...FACTORY, functionName: 'getCampaigns' })
}

// ─── Read: factory stats ──────────────────────────────────────────────────────
export function useFactoryStats() {
  return useReadContracts({
    contracts: [
      { ...FACTORY, functionName: 'getCampaignCount' },
      { ...FACTORY, functionName: 's_platformFeeBps' },
      { ...FACTORY, functionName: 's_feeRecipient' },
      { ...FACTORY, functionName: 's_maxDurationDays' },
    ],
  })
}

// ─── Read: campaigns by creator ──────────────────────────────────────────────
export function useGetCampaignsByCreator(creator?: `0x${string}`) {
  return useReadContract({
    ...FACTORY,
    functionName: 'getCampaignsByCreator',
    args: creator ? [creator] : undefined,
    query: { enabled: !!creator },
  })
}

// ─── Read: paginated campaigns ───────────────────────────────────────────────
export function useGetCampaignsPaginated(offset: bigint, limit: bigint) {
  return useReadContract({
    ...FACTORY,
    functionName: 'getCampaignsPaginated',
    args: [offset, limit],
  })
}

// ─── Read: is a campaign ──────────────────────────────────────────────────────
export function useIsCampaign(address?: `0x${string}`) {
  return useReadContract({
    ...FACTORY,
    functionName: 's_isCampaign',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })
}

// ─── Write: create campaign ───────────────────────────────────────────────────
export function useCreateCampaign() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  function createCampaign(params: {
    goalEth: string
    deadlineTimestamp: number
    title: string
    description: string
  }) {
    writeContract({
      ...FACTORY,
      functionName: 'createCampaign',
      args: [
        parseEther(params.goalEth),
        BigInt(params.deadlineTimestamp),
        params.title,
        params.description,
      ],
    })
  }

  return { createCampaign, hash, isPending, isConfirming, isSuccess, error }
}

// ─── Read: bulk campaign info ─────────────────────────────────────────────────
export function useCampaignInfoBulk(addresses: `0x${string}`[]) {
  const contracts = addresses.map((address) => ({
    address,
    abi: CrowdfundingCampaignABI,
    functionName: 'getCampaignInfo' as const,
  }))

  const result = useReadContracts({
    contracts,
    query: { enabled: addresses.length > 0 },
  })

  const campaigns: CampaignInfo[] = []
  if (result.data) {
    result.data.forEach((item, i) => {
      if (item.status === 'success' && item.result) {
        campaigns.push(
          parseCampaignInfo(addresses[i], item.result as any)
        )
      }
    })
  }

  return { ...result, campaigns }
}