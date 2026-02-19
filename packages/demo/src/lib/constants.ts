import type { Demo, Chain } from './types';

export const DEMOS: Demo[] = [
  {
    id: 'nft',
    icon: '🎨',
    name: 'Cross-Chain NFT Mint',
    description: 'Mint an NFT on Ethereum from Arbitrum',
    gradient: 'from-purple-500 to-pink-500',
  },
  {
    id: 'token',
    icon: '💰',
    name: 'Cross-Chain Token Transfer',
    description: 'Send USDC from Arbitrum to Base',
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'vote',
    icon: '🗳️',
    name: 'Cross-Chain DAO Vote',
    description: 'Vote on Ethereum DAO from Arbitrum',
    gradient: 'from-green-500 to-emerald-500',
  },
];

export const CHAINS: Chain[] = [
  {
    id: 'ethereum',
    name: 'Ethereum',
    icon: 'Ξ',
    color: 'border-blue-500 bg-blue-500/10',
  },
  {
    id: 'base',
    name: 'Base',
    icon: '🔵',
    color: 'border-cyan-500 bg-cyan-500/10',
  },
  {
    id: 'polygon',
    name: 'Polygon',
    icon: '⬡',
    color: 'border-purple-500 bg-purple-500/10',
  },
  {
    id: 'optimism',
    name: 'Optimism',
    icon: '⭕',
    color: 'border-red-500 bg-red-500/10',
  },
];

export const COMPARISON_WITHOUT = [
  'Build same dApp on 10 chains',
  'Manage 10 separate deployments',
  '10 security audits required',
  'Complex bridge integrations',
  '$4.50 per message (expensive)',
  'Weeks of development time',
  'Users fragmented across chains',
];

export const COMPARISON_WITH = [
  'Build once on Arbitrum',
  'One deployment, one codebase',
  'Single security audit',
  'One SDK call: arbiLink.sendMessage()',
  '$0.23 per message (95% cheaper)',
  'Hours of development',
  'Reach users on all chains',
];
