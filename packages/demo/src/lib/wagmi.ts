import { getDefaultConfig }  from '@rainbow-me/rainbowkit'
import { http }              from 'wagmi'
import { arbitrumSepolia, baseSepolia, sepolia, polygonAmoy } from 'wagmi/chains'

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? 'demo'

export const config = getDefaultConfig({
  appName:   'ArbiLink Demo',
  projectId,
  chains:    [arbitrumSepolia, sepolia, baseSepolia, polygonAmoy],
  transports: {
    [arbitrumSepolia.id]: http(
      import.meta.env.VITE_INFURA_KEY
        ? `https://arbitrum-sepolia.infura.io/v3/${import.meta.env.VITE_INFURA_KEY}`
        : 'https://sepolia-rollup.arbitrum.io/rpc'
    ),
    [sepolia.id]:         http('https://rpc.sepolia.org'),
    [baseSepolia.id]:     http('https://sepolia.base.org'),
    [polygonAmoy.id]:     http('https://rpc-amoy.polygon.technology'),
  },
})
