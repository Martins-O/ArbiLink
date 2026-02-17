import { getDefaultConfig }  from '@rainbow-me/rainbowkit'
import { http }              from 'wagmi'
import { arbitrumSepolia, baseSepolia, sepolia } from 'wagmi/chains'

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? 'demo'

export const config = getDefaultConfig({
  appName:   'ArbiLink Demo',
  projectId,
  chains:    [arbitrumSepolia, sepolia, baseSepolia],
  transports: {
    [arbitrumSepolia.id]: http('https://sepolia-rollup.arbitrum.io/rpc'),
    [sepolia.id]:         http('https://rpc.sepolia.org'),
    [baseSepolia.id]:     http('https://sepolia.base.org'),
  },
})
