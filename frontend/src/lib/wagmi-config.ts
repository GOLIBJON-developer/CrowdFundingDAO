import { createConfig, http } from 'wagmi'
import { sepolia, hardhat } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

export const wagmiConfig = createConfig({
  chains: [sepolia, hardhat],
  connectors: [injected()],
  transports: {
    [sepolia.id]: http(process.env.NEXT_PUBLIC_RPC_URL),
    [hardhat.id]: http('http://localhost:8545'),
  },
  ssr: true,
})