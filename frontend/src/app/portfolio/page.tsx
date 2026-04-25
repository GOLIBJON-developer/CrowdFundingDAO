'use client'
import { useAccount } from 'wagmi'
import Link from 'next/link'
import { useGetCampaignsByCreator, useCampaignInfoBulk } from '@/hooks/useFactory'
import { useGetCampaigns } from '@/hooks/useFactory'
import { useMyTokenInfo } from '@/hooks/useFundToken'
import { useDelegate } from '@/hooks/useFundToken'
import { useReadContracts } from 'wagmi'
import { type Abi } from 'viem'
import CrowdfundingCampaignABI from '@/abi/CrowdfundingCampaign.json'
import { CampaignCard } from '@/components/campaign'
import { AddressChip, TxFeedback, Spinner, ConnectButton } from '@/components/ui'
import { fmtEth } from '@/lib/utils'

export default function PortfolioPage() {
  const { address } = useAccount()
  const { balance: balanceRaw, votes: votesRaw, delegatee, refetch } = useMyTokenInfo(address)
  const balance = (balanceRaw ?? 0n) as bigint
  const votes   = (votesRaw   ?? 0n) as bigint
  const delegateHook = useDelegate()

  // My created campaigns
  const { data: myCampaignAddrs } = useGetCampaignsByCreator(address)
  const { campaigns: myCampaigns } = useCampaignInfoBulk((myCampaignAddrs as `0x${string}`[]) ?? [])

  // All campaigns — find ones where I contributed
  const { data: allAddrs } = useGetCampaigns()
  const allAddresses = (allAddrs as `0x${string}`[]) ?? []

  // Read my contribution from each campaign
  const contribContracts = allAddresses.map((addr) => ({
    address: addr,
    abi: CrowdfundingCampaignABI as Abi,
    functionName: 's_contributions' as const,
    args: address ? [address] : [],
  }))
  const { data: contribData } = useReadContracts({
    contracts: contribContracts,
    query: { enabled: !!address && allAddresses.length > 0 },
  })

  const contributedAddrs = allAddresses.filter((_, i) => {
    const val = contribData?.[i]
    return val?.status === 'success' && (val.result as bigint) > 0n
  })
  const { campaigns: contributedCampaigns } = useCampaignInfoBulk(contributedAddrs)

  const isSelfDelegated = address && delegatee?.toLowerCase() === address.toLowerCase()
  const totalContributed = contribData
    ? allAddresses.reduce((sum, _, i) => {
        const v = contribData[i]
        return sum + (v?.status === 'success' ? (v.result as bigint) : 0n)
      }, 0n)
    : 0n

  if (!address) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <div className="text-4xl mb-6 opacity-20">◎</div>
        <h2 className="font-display italic text-2xl text-zinc-400 mb-4">Connect to view portfolio</h2>
        <ConnectButton />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">

      {/* Header */}
      <div className="mb-10">
        <h1 className="font-display italic text-3xl text-zinc-100 mb-2">My Portfolio</h1>
        <AddressChip address={address} chars={8} className="text-sm" />
      </div>

      {/* Token overview */}
      <div className="p-5 rounded-lg border border-zinc-800 bg-zinc-900/40 mb-8">
        <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider mb-4">FUND Token</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Balance',       value: `${fmtEth(balance, 3)} FUND`, hi: balance > 0n },
            { label: 'Voting Power',  value: `${fmtEth(votes, 3)} FUND`,  hi: votes > 0n },
            { label: 'Delegated To',  value: delegatee ? (isSelfDelegated ? 'Self' : 'Other') : 'None' },
            { label: 'Contributed',   value: `${fmtEth(totalContributed, 3)} ETH`, hi: totalContributed > 0n },
          ].map(({ label, value, hi }) => (
            <div key={label}>
              <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider mb-1">{label}</div>
              <div className={`text-sm font-mono font-semibold ${hi ? 'text-amber-400' : 'text-zinc-400'}`}>{value}</div>
            </div>
          ))}
        </div>

        {/* Delegate prompt */}
        {balance > 0n && !isSelfDelegated && (
          <div className="mt-4 pt-4 border-t border-zinc-800 flex items-center justify-between flex-wrap gap-3">
            <p className="text-xs font-mono text-amber-400/80">
              You have {fmtEth(balance, 2)} FUND but no active voting power. Delegate to activate.
            </p>
            <button
              onClick={() => address && delegateHook.selfDelegate(address)}
              disabled={delegateHook.isPending || delegateHook.isConfirming}
              className="px-4 py-1.5 text-xs font-mono font-semibold bg-amber-500 text-black
                         rounded hover:bg-amber-400 disabled:opacity-40 transition-colors
                         flex items-center gap-2"
            >
              {(delegateHook.isPending || delegateHook.isConfirming) && <Spinner />}
              Activate voting power
            </button>
          </div>
        )}
        {isSelfDelegated && (
          <p className="mt-3 pt-3 border-t border-zinc-800 text-xs font-mono text-emerald-400">
            ✓ Voting power active
          </p>
        )}
        <TxFeedback hash={delegateHook.hash} isPending={delegateHook.isPending}
          isConfirming={delegateHook.isConfirming} isSuccess={delegateHook.isSuccess}
          error={delegateHook.error} successMessage="Delegation confirmed!" />
      </div>

      {/* My Campaigns */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-mono font-semibold text-zinc-300">
            My Campaigns
            <span className="ml-2 text-zinc-600">{myCampaigns.length}</span>
          </h2>
          <Link href="/create"
            className="px-3 py-1.5 text-xs font-mono bg-amber-500 text-black rounded
                       hover:bg-amber-400 transition-colors">
            + Launch New
          </Link>
        </div>
        {myCampaigns.length === 0 ? (
          <div className="py-12 text-center border border-zinc-800 rounded-lg">
            <p className="text-xs font-mono text-zinc-600">You haven't launched any campaigns yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {myCampaigns.map((c) => <CampaignCard key={c.address} campaign={c} />)}
          </div>
        )}
      </section>

      {/* Contributed campaigns */}
      <section>
        <h2 className="text-sm font-mono font-semibold text-zinc-300 mb-4">
          Backed Campaigns
          <span className="ml-2 text-zinc-600">{contributedCampaigns.length}</span>
        </h2>
        {contributedCampaigns.length === 0 ? (
          <div className="py-12 text-center border border-zinc-800 rounded-lg">
            <p className="text-xs font-mono text-zinc-600">You haven't backed any campaigns yet.</p>
            <Link href="/" className="mt-3 inline-block text-xs font-mono text-amber-400 underline">
              Browse campaigns
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {contributedCampaigns.map((c, i) => {
              const addrIdx = allAddresses.indexOf(c.address)
              const myAmt = addrIdx >= 0 && contribData?.[addrIdx]?.status === 'success'
                ? contribData[addrIdx].result as bigint
                : 0n
              return (
                <div key={c.address} className="relative">
                  <CampaignCard campaign={c} />
                  {myAmt > 0n && (
                    <div className="absolute top-3 right-3 px-2 py-0.5 bg-violet-600/20 border border-violet-500/30
                                    rounded text-[10px] font-mono text-violet-400">
                      {fmtEth(myAmt)} ETH
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}