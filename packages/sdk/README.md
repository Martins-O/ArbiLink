# @arbilink/sdk &middot; [![npm version](https://img.shields.io/npm/v/@arbilink/sdk)](https://www.npmjs.com/package/@arbilink/sdk) [![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Send messages from **Arbitrum Sepolia** to any supported chain with a single function call. Built on the ArbiLink MessageHub — an optimistic cross-chain relay protocol running on [Arbitrum Stylus](https://arbitrum.io/stylus).

## Installation

```bash
npm install @arbilink/sdk ethers
# or
pnpm add @arbilink/sdk ethers
# or
yarn add @arbilink/sdk ethers
```

## Quick Start

```typescript
import { ArbiLink, encodeCall } from '@arbilink/sdk';
import { ethers }                from 'ethers';
import { parseAbi }              from 'viem';

const provider = new ethers.BrowserProvider(window.ethereum);
const signer   = await provider.getSigner();
const arbiLink = new ArbiLink(signer);

const messageId = await arbiLink.sendMessage({
  to:     'ethereum',
  target: '0x742d35Cc...',
  data:   encodeCall({
    abi:          parseAbi(['function mint(address to, uint256 amount)']),
    functionName: 'mint',
    args:         ['0xRecipient...', 1_000n],
  }),
});

console.log('Message sent! ID:', messageId);

const unwatch = arbiLink.watchMessage(messageId, (msg) => {
  console.log('Status update:', msg.status);
  if (msg.status === 'relayed') {
    console.log('Message delivered!');
    unwatch();
  }
});
```

## API Reference

### `new ArbiLink(signerOrProvider)`

| Mode | Arg | Read | Write |
|------|-----|------|-------|
| Full | `ethers.Signer` | ✅ | ✅ |
| Read-only | `ethers.Provider` | ✅ | ❌ |

---

### `sendMessage(params)` → `Promise<bigint>`

| Param | Type | Description |
|-------|------|-------------|
| `to` | `string \| number` | Chain name (`'ethereum'`, `'base'`, `'polygon'`, `'optimism'`) or numeric chain ID |
| `target` | `string` | Contract address on the destination chain |
| `data` | `string` | Encoded calldata (use `encodeCall()` helper) |
| `fee` | `bigint` | *(optional)* Message fee in wei — auto-fetched from the hub if omitted |

```typescript
const messageId = await arbiLink.sendMessage({
  to:     'base',
  target: '0xTarget...',
  data:   '0xcalldata...',
});
```

---

### `getMessageStatus(messageId)` → `Promise<Message>`

```typescript
const msg = await arbiLink.getMessageStatus(1n);

console.log(msg.status);           // 'pending' | 'relayed' | 'failed'
console.log(msg.sender);           // address that sent the message
console.log(msg.destinationChain); // numeric chain ID
console.log(msg.feePaid);          // bigint (wei)
console.log(msg.relayer);          // relayer address (once relayed)
```

---

### `watchMessage(messageId, callback)` → `() => void`

Returns an **unsubscribe** function.

```typescript
const unwatch = arbiLink.watchMessage(messageId, (msg) => {
  if (msg.status === 'failed') {
    unwatch();
  }
});
```

---

### `registerRelayer(stakeOverride?)` / `exitRelayer()`

```typescript
await arbiLink.registerRelayer();                        // hub's minimum stake
await arbiLink.registerRelayer(2_000_000_000_000_000_000n); // 2 ETH
await arbiLink.exitRelayer();                            // withdraw & deregister
```

---

## Utility Functions

| Function | Returns | Example |
|----------|---------|---------|
| `encodeCall({ abi, functionName, args })` | `string` (hex) | `encodeCall({ abi, functionName: 'mint', args: [...] })` |
| `formatMessageId(id)` | `string` | `formatMessageId(42n)` → `'#000042'` |
| `formatEth(wei)` | `string` | `formatEth(1_000_000_000_000_000n)` → `'0.001 ETH'` |
| `statusLabel(status)` | `string` | `statusLabel(0)` → `'pending'` |
| `estimateDeliveryTime(chainId)` | `number` (sec) | `estimateDeliveryTime(11155111)` |

---

## Supported Chains

| Chain | Name | Chain ID | Receiver |
|-------|------|----------|----------|
| Ethereum Sepolia | `'ethereum'` | 11155111 | ✅ Deployed |
| Base Sepolia | `'base'` | 84532 | ✅ Deployed |
| Polygon Amoy | `'polygon'` | 80002 | ✅ Deployed |
| Optimism Sepolia | `'optimism'` | 11155420 | 🔜 Coming soon |

---

## How ArbiLink Works

1. **User** calls `sendMessage()` on the **MessageHub** (Arbitrum Stylus).
2. **Relayers** watch for `MessageSent` events and deliver the message on the destination chain via `ArbiLinkReceiver.receiveMessage()`.
3. The relayer submits an **ECDSA execution proof** and calls `confirmDelivery()` on the hub, opening a **5-minute challenge window**.
4. Anyone can call `challengeMessage()` with a fraud proof during that window. A valid fraud proof **slashes the relayer's stake**.

---

## Examples

### NFT Mint on Ethereum

```typescript
import { ArbiLink, encodeCall } from '@arbilink/sdk';
import { parseAbi } from 'viem';

const arbiLink = new ArbiLink(signer);

const data = encodeCall({
  abi:          parseAbi(['function mint(address to, uint256 tokenId)']),
  functionName: 'mint',
  args:         ['0xRecipient...', 1n],
});

const messageId = await arbiLink.sendMessage({
  to:     'ethereum',
  target: NFT_CONTRACT_ADDRESS,
  data,
});
```

### Token Transfer on Base

```typescript
const messageId = await arbiLink.sendMessage({
  to:     'base',
  target: TOKEN_CONTRACT_ADDRESS,
  data:   encodeCall({
    abi:          parseAbi(['function transfer(address to, uint256 amount)']),
    functionName: 'transfer',
    args:         [recipient, amount],
  }),
});
```

### Read-only polling (no wallet)

```typescript
import { ArbiLink } from '@arbilink/sdk';
import { ethers }   from 'ethers';

const provider = new ethers.JsonRpcProvider('https://sepolia-rollup.arbitrum.io/rpc');
const arbiLink = new ArbiLink(provider);

const msg = await arbiLink.getMessageStatus(42n);
console.log(msg.status);
```

---

## Configuration

After deploying contracts, update `src/constants.ts` with your addresses:

```typescript
export const MESSAGE_HUB_ADDRESS = '0x...';
export const RECEIVER_ADDRESSES: Record<number, string> = {
  11155111: '0x...',
  84532:    '0x...',
  80002:    '0x...',
};
```

---

## License

MIT
