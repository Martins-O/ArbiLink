import type { ChainConfig, ChainName } from './types';

// ── Contract addresses ────────────────────────────────────────────────────────
// Fill these in after running scripts/deploy.sh

/** MessageHub deployed on Arbitrum Sepolia (421614) */
export const MESSAGE_HUB_ADDRESS = '0x0000000000000000000000000000000000000000';

/** ArbiLinkReceiver addresses on each destination chain */
export const RECEIVER_ADDRESSES: Record<number, string> = {
  11155111: '0x0000000000000000000000000000000000000000', // Ethereum Sepolia
  84532:    '0x0000000000000000000000000000000000000000', // Base Sepolia
};

// ── Supported chains ──────────────────────────────────────────────────────────

export const SUPPORTED_CHAINS: ChainConfig[] = [
  {
    id:              11155111,
    name:            'Ethereum Sepolia',
    shortName:       'ethereum',
    rpc:             'https://sepolia.infura.io/v3/',
    explorer:        'https://sepolia.etherscan.io',
    receiverAddress: RECEIVER_ADDRESSES[11155111],
  },
  {
    id:              84532,
    name:            'Base Sepolia',
    shortName:       'base',
    rpc:             'https://sepolia.base.org',
    explorer:        'https://sepolia.basescan.org',
    receiverAddress: RECEIVER_ADDRESSES[84532],
  },
];

/** Map chain short-names to numeric IDs */
export const CHAIN_IDS: Record<ChainName, number> = {
  ethereum: 11155111, // Sepolia
  base:     84532,    // Base Sepolia
  polygon:  80002,    // Amoy testnet
  optimism: 11155420, // Optimism Sepolia
};

// ── Challenge window ──────────────────────────────────────────────────────────

/** Default challenge period in seconds (matches hub deployment param) */
export const DEFAULT_CHALLENGE_PERIOD_SECS = 300; // 5 minutes

// ── Arbitrum Sepolia hub chain ────────────────────────────────────────────────

export const ARBITRUM_SEPOLIA_CHAIN_ID = 421614;
export const ARBITRUM_SEPOLIA_RPC = 'https://sepolia-rollup.arbitrum.io/rpc';
