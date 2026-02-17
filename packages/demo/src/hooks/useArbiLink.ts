import { useMemo }           from 'react'
import { useWalletClient }   from 'wagmi'
import { JsonRpcProvider }   from 'ethers'
import { ArbiLink }          from '@arbilink/sdk'
import { walletClientToSigner } from '@/lib/utils'

const ARB_SEPOLIA_RPC = 'https://sepolia-rollup.arbitrum.io/rpc'

/**
 * Returns:
 *  - `arbiLink`      — write-capable SDK instance (null when wallet not connected)
 *  - `readArbiLink`  — read-only SDK instance (always available via public RPC)
 *  - `isConnected`   — whether a wallet is connected
 */
export function useArbiLink() {
  const { data: walletClient } = useWalletClient()

  const arbiLink = useMemo(() => {
    if (!walletClient) return null
    try {
      const signer = walletClientToSigner(walletClient)
      return new ArbiLink(signer)
    } catch {
      return null
    }
  }, [walletClient])

  const readArbiLink = useMemo(() => {
    const provider = new JsonRpcProvider(ARB_SEPOLIA_RPC)
    return new ArbiLink(provider)
  }, [])

  return {
    arbiLink,
    readArbiLink,
    isConnected: !!walletClient,
  }
}
