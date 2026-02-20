import type { ChainConfig, ChainName } from './types';

// ── Contract addresses ────────────────────────────────────────────────────────

/** MessageHub deployed on Arbitrum Sepolia (421614) */
export const MESSAGE_HUB_ADDRESS = '0x9a9e7Ec4EA29bb63fE7c38E124B253b44fF897Cc';

/** ArbiLinkReceiver addresses on each destination chain */
export const RECEIVER_ADDRESSES: Record<number, string> = {
  11155111: '0x895058E57bBE8c84C2AABA5d61c4C739C5869F71', // Ethereum Sepolia
  84532:    '0xD45efE42904C9a27630A548A1FB6d9F133Cf5D35', // Base Sepolia
  80002:    '0x221B7Cca1C385C6c81e17b086C753328AF41AAAa', // Polygon Amoy
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
  {
    id:              80002,
    name:            'Polygon Amoy',
    shortName:       'polygon',
    rpc:             'https://rpc-amoy.polygon.technology',
    explorer:        'https://amoy.polygonscan.com',
    receiverAddress: RECEIVER_ADDRESSES[80002],
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
