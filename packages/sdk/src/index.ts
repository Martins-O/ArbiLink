// Main SDK class
export { ArbiLink } from './ArbiLink';

// Types
export type {
  ChainId,
  ChainName,
  ChainConfig,
  Message,
  MessageStatus,
  RelayerInfo,
  SendMessageParams,
  WatchOptions,
} from './types';
export { ArbiLinkError } from './types';

// Utilities
export {
  encodeCall,
  formatMessageId,
  formatEth,
  statusLabel,
  resolveChainId,
  estimateDeliveryTime,
  parseStatusCode,
} from './utils';

// Constants
export {
  MESSAGE_HUB_ADDRESS,
  RECEIVER_ADDRESSES,
  SUPPORTED_CHAINS,
  CHAIN_IDS,
  ARBITRUM_SEPOLIA_CHAIN_ID,
  ARBITRUM_SEPOLIA_RPC,
  DEFAULT_CHALLENGE_PERIOD_SECS,
} from './constants';

// ABIs (useful for integrators building their own wrappers)
export { default as MessageHubABI } from './abi/MessageHub.json';
export { default as ReceiverABI }   from './abi/Receiver.json';
