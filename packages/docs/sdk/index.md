# SDK Overview

`@arbilink/sdk` is the official TypeScript SDK for sending and tracking cross-chain messages via ArbiLink.

## Installation

```bash
pnpm add @arbilink/sdk ethers
```

## Exports

```typescript
// Main class
export { ArbiLink } from '@arbilink/sdk';

// Types
export type {
  SendMessageParams,
  Message,
  MessageStatus,
  ChainConfig,
} from '@arbilink/sdk';

// Errors
export { ArbiLinkError } from '@arbilink/sdk';

// Constants
export {
  ARBITRUM_SEPOLIA_CHAIN_ID,
  SUPPORTED_CHAINS,
  CHAIN_IDS,
  MESSAGE_HUB_ADDRESS,
  RECEIVER_ADDRESSES,
} from '@arbilink/sdk';

// Utilities
export {
  encodeCall,
  formatMessageId,
  formatEth,
  statusLabel,
  resolveChainId,
  estimateDeliveryTime,
} from '@arbilink/sdk';
```

## Quick Reference

| Method | Description |
|--------|-------------|
| `new ArbiLink(signerOrProvider)` | Create an SDK instance |
| `sendMessage(params)` | Send a cross-chain message |
| `getMessageStatus(id)` | Get current status of a message |
| `calculateFee(chainId)` | Get the fee to send to a chain |
| `watchMessage(id, cb)` | Subscribe to message status updates |
| `messageCount()` | Total messages sent through the hub |
| `getChainInfo(chainId)` | Get registered chain configuration |
| `isActiveRelayer(address)` | Check if an address is a staked relayer |
| `registerRelayer(stake?)` | Register as a relayer |
| `exitRelayer()` | Deregister and withdraw stake |

## Supported Chains

| Chain | Chain ID | Status |
|-------|----------|--------|
| Arbitrum Sepolia (hub) | 421614 | Hub |
| Ethereum Sepolia | 11155111 | Supported |
| Base Sepolia | 84532 | Supported |

## Design Philosophy

The SDK is designed to be:

- **Minimal** — no extra dependencies beyond ethers
- **Type-safe** — all inputs and outputs are fully typed
- **Composable** — works with any ethers Signer or Provider
- **Error-informative** — descriptive errors with chain context

## References

- [ArbiLink Class](/sdk/arbilink-class)
- [Methods](/sdk/methods)
- [Types](/sdk/types)
- [Errors](/sdk/errors)
