import { clsx, type ClassValue } from 'clsx'
import { twMerge }               from 'tailwind-merge'
import { BrowserProvider, JsonRpcSigner } from 'ethers'
import type { WalletClient }     from 'viem'

/** Merge Tailwind classes without conflicts */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Bridge wagmi v2 WalletClient → ethers v6 Signer */
export function walletClientToSigner(walletClient: WalletClient): JsonRpcSigner {
  const { account, chain, transport } = walletClient
  const network = {
    chainId:    chain!.id,
    name:       chain!.name,
    ensAddress: chain!.contracts?.ensRegistry?.address,
  }
  const provider = new BrowserProvider(transport as any, network)
  return new JsonRpcSigner(provider, account!.address)
}

/** Shorten an Ethereum address for display */
export function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

/** Format a message ID with leading zeros */
export function fmtId(id: bigint): string {
  return `#${id.toString().padStart(6, '0')}`
}

/** Format wei as human-readable ETH */
export function fmtEth(wei: bigint): string {
  const eth = Number(wei) / 1e18
  return `${eth.toFixed(4).replace(/\.?0+$/, '')} ETH`
}

/** Chain ID → display name */
export const CHAIN_NAMES: Record<number, string> = {
  421614:   'Arbitrum Sepolia',
  11155111: 'Ethereum Sepolia',
  84532:    'Base Sepolia',
  80002:    'Polygon Amoy',
  11155420: 'Optimism Sepolia',
}
