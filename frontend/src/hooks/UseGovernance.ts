'use client'
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { encodeAbiParameters, parseAbiParameters, keccak256, toBytes } from 'viem'
import { ADDRESSES, PROPOSAL_STATE } from '@/lib/constants'
import CrowdfundingGovernorABI from '@/abi/CrowdfundingGovernor.json'
import CampaignFactoryABI from '@/abi/CampaignFactory.json'

const GOV = { address: ADDRESSES.governor, abi: CrowdfundingGovernorABI } as const

// ─── Read: governor settings ──────────────────────────────────────────────────
export function useGovernorSettings() {
  const votingDelay = useReadContract({ ...GOV, functionName: 'votingDelay' })
  const votingPeriod = useReadContract({ ...GOV, functionName: 'votingPeriod' })
  const threshold = useReadContract({ ...GOV, functionName: 'proposalThreshold' })
  const quorumNum = useReadContract({ ...GOV, functionName: 'quorumNumerator' })

  return { votingDelay, votingPeriod, threshold, quorumNum }
}

// ─── Read: proposal state ─────────────────────────────────────────────────────
export function useProposalState(proposalId?: bigint) {
  return useReadContract({
    ...GOV,
    functionName: 'state',
    args: proposalId ? [proposalId] : undefined,
    query: { enabled: !!proposalId, refetchInterval: 15_000 },
  })
}

// ─── Read: proposal votes ─────────────────────────────────────────────────────
export function useProposalVotes(proposalId?: bigint) {
  return useReadContract({
    ...GOV,
    functionName: 'proposalVotes',
    args: proposalId ? [proposalId] : undefined,
    query: { enabled: !!proposalId, refetchInterval: 15_000 },
  })
}

// ─── Read: has voted ──────────────────────────────────────────────────────────
export function useHasVoted(proposalId?: bigint, voter?: `0x${string}`) {
  return useReadContract({
    ...GOV,
    functionName: 'hasVoted',
    args: proposalId && voter ? [proposalId, voter] : undefined,
    query: { enabled: !!proposalId && !!voter },
  })
}

// ─── Write: propose ───────────────────────────────────────────────────────────
export function usePropose() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  /** Propose changing the platform fee */
  function proposeSetFee(newFeeBps: number, description: string) {
    const calldata = encodeAbiParameters(
      parseAbiParameters('uint16'),
      [newFeeBps]
    )
    // Prepend function selector for setPlatformFee(uint16)
    const selector = '0x' + Buffer.from(
      keccak256(toBytes('setPlatformFee(uint16)')).slice(2, 10)
    ).toString()

    writeContract({
      ...GOV,
      functionName: 'propose',
      args: [
        [ADDRESSES.factory],
        [0n],
        [('0x' + keccak256(toBytes('setPlatformFee(uint16)')).slice(2, 10) + calldata.slice(2)) as `0x${string}`],
        description,
      ],
    })
  }

  /** Propose cancelling a campaign */
  function proposeCancelCampaign(campaignAddress: `0x${string}`, description: string) {
    const calldata = encodeAbiParameters(
      parseAbiParameters('address'),
      [campaignAddress]
    )
    writeContract({
      ...GOV,
      functionName: 'propose',
      args: [
        [ADDRESSES.factory],
        [0n],
        [('0x' + keccak256(toBytes('cancelCampaign(address)')).slice(2, 10) + calldata.slice(2)) as `0x${string}`],
        description,
      ],
    })
  }

  return { proposeSetFee, proposeCancelCampaign, hash, isPending, isConfirming, isSuccess, error }
}

// ─── Write: cast vote ─────────────────────────────────────────────────────────
export function useCastVote() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  function castVote(proposalId: bigint, support: 0 | 1 | 2) {
    writeContract({ ...GOV, functionName: 'castVote', args: [proposalId, support] })
  }

  return { castVote, hash, isPending, isConfirming, isSuccess, error }
}

// ─── Write: cast vote with reason ─────────────────────────────────────────────
export function useCastVoteWithReason() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  function castVote(proposalId: bigint, support: 0 | 1 | 2, reason: string) {
    writeContract({
      ...GOV,
      functionName: 'castVoteWithReason',
      args: [proposalId, support, reason],
    })
  }

  return { castVote, hash, isPending, isConfirming, isSuccess, error }
}

// ─── Write: queue ─────────────────────────────────────────────────────────────
export function useQueueProposal() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  function queue(
    targets: `0x${string}`[],
    values: bigint[],
    calldatas: `0x${string}`[],
    descriptionHash: `0x${string}`
  ) {
    writeContract({
      ...GOV,
      functionName: 'queue',
      args: [targets, values, calldatas, descriptionHash],
    })
  }

  return { queue, hash, isPending, isConfirming, isSuccess, error }
}

// ─── Write: execute ───────────────────────────────────────────────────────────
export function useExecuteProposal() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  function execute(
    targets: `0x${string}`[],
    values: bigint[],
    calldatas: `0x${string}`[],
    descriptionHash: `0x${string}`
  ) {
    writeContract({
      ...GOV,
      functionName: 'execute',
      args: [targets, values, calldatas, descriptionHash],
      value: 0n,
    })
  }

  return { execute, hash, isPending, isConfirming, isSuccess, error }
}