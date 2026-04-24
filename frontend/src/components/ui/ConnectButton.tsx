'use client'
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi'
import { shortAddress } from '@/lib/utils'
import { DEFAULT_CHAIN_ID } from '@/lib/constants'

export function ConnectButton() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()

  const wrongChain = isConnected && chainId !== DEFAULT_CHAIN_ID

  if (wrongChain) {
    return (
      <button
        onClick={() => switchChain({ chainId: DEFAULT_CHAIN_ID })}
        className="px-4 py-2 text-xs font-mono font-medium bg-rose-500/10 text-rose-400 
                   border border-rose-500/25 rounded hover:bg-rose-500/20 transition-colors"
      >
        Switch Network
      </button>
    )
  }

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <span className="px-3 py-1.5 text-xs font-mono text-zinc-300 bg-zinc-800 border border-zinc-700 rounded">
          {shortAddress(address)}
        </span>
        <button
          onClick={() => disconnect()}
          className="px-3 py-1.5 text-xs font-mono text-zinc-400 hover:text-zinc-200
                     border border-zinc-700 rounded hover:border-zinc-500 transition-colors"
        >
          Disconnect
        </button>
      </div>
    )
  }

  const injected = connectors.find((c) => c.type === 'injected')

  return (
    <button
      onClick={() => injected && connect({ connector: injected })}
      disabled={isPending}
      className="px-4 py-2 text-xs font-mono font-semibold bg-amber-500 text-black 
                 rounded hover:bg-amber-400 transition-colors disabled:opacity-50"
    >
      {isPending ? 'Connecting…' : 'Connect Wallet'}
    </button>
  )
}