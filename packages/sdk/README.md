# @arbilink/sdk

Cross-chain messaging made simple. Send messages from **Arbitrum** to any supported chain with a single function call.

Built on top of the ArbiLink MessageHub — an optimistic cross-chain relay protocol running on Arbitrum Stylus.

## Installation

```bash
npm install @arbilink/sdk ethers
# or
yarn add @arbilink/sdk ethers
```

## Quick Start

```typescript
import { ArbiLink, encodeCall } from '@arbilink/sdk';
import { ethers }                from 'ethers';
import { parseAbi }              from 'viem';

// 1. Connect a signer (must be on Arbitrum Sepolia)
const provider = new ethers.BrowserProvider(window.ethereum);
const signer   = await provider.getSigner();

// 2. Initialise
const arbiLink = new ArbiLink(signer);

// 3. Send a cross-chain message
const messageId = await arbiLink.sendMessage({
  to:     'ethereum',           // destination chain name or numeric ID
  target: '0x742d35Cc...',     // contract to call on the destination chain
  data:   encodeCall({
    abi:          parseAbi(['function mint(address to, uint256 amount)']),
    functionName: 'mint',
    args:         ['0xRecipient...', 1_000n],
  }),
});

console.log('Message sent! ID:', messageId);

// 4. Watch for delivery
const unwatch = arbiLink.watchMessage(messageId, (msg) => {
  console.log('Status update:', msg.status);
  if (msg.status === 'confirmed') {
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

Send a cross-chain message. Returns the message ID.

```typescript
const messageId = await arbiLink.sendMessage({
  to:     'base',           // 'ethereum' | 'base' | 'polygon' | 'optimism' | chainId
  target: '0xTarget...',
  data:   '0xcalldata...',
  fee:    1_000_000_000_000_000n, // optional – fetched from hub if omitted
});
```

---

### `getMessageStatus(messageId)` → `Promise<Message>`

```typescript
const msg = await arbiLink.getMessageStatus(1n);

console.log(msg.status);           // 'pending' | 'relayed' | 'confirmed' | 'failed'
console.log(msg.sender);           // address that sent the message
console.log(msg.destinationChain); // numeric chain ID
console.log(msg.feePaid);          // bigint (wei)
console.log(msg.relayer);          // relayer address (once confirmed)
```

---

### `calculateFee(chainId)` → `Promise<bigint>`

```typescript
const fee = await arbiLink.calculateFee(11155111);
console.log(formatEth(fee)); // "0.001 ETH"
```

---

### `watchMessage(messageId, callback)` → `() => void`

Subscribe to `MessageConfirmed` and `MessageChallenged` events.
Returns an **unsubscribe** function.

```typescript
const unwatch = arbiLink.watchMessage(messageId, (msg) => {
  if (msg.status === 'confirmed' || msg.status === 'failed') {
    unwatch();
  }
});
```

---

### `getChainInfo(chainId)` → `Promise<{ enabled, receiverAddress, baseFee } | null>`

```typescript
const info = await arbiLink.getChainInfo(11155111);
console.log(info?.enabled);          // true
console.log(info?.receiverAddress);  // '0x...'
console.log(info?.baseFee);          // bigint
```

---

### `registerRelayer(stakeOverride?)` / `exitRelayer()`

```typescript
// Register with the hub's minimum stake
await arbiLink.registerRelayer();

// Or override the stake amount
await arbiLink.registerRelayer(2_000_000_000_000_000_000n); // 2 ETH

// Withdraw stake and deregister
await arbiLink.exitRelayer();
```

---

## Utility Functions

```typescript
import {
  encodeCall,
  formatMessageId,
  formatEth,
  statusLabel,
  estimateDeliveryTime,
} from '@arbilink/sdk';

encodeCall({ abi, functionName, args });  // → '0x...'
formatMessageId(42n);                      // → '#000042'
formatEth(1_000_000_000_000_000n);        // → '0.001 ETH'
statusLabel('confirmed');                  // → 'Confirmed'
estimateDeliveryTime(11155111);            // → seconds (int)
```

---

## Supported Chains

| Chain | Name | Chain ID | Status |
|-------|------|----------|--------|
| Ethereum Sepolia | `'ethereum'` | 11155111 | ✅ Supported |
| Base Sepolia | `'base'` | 84532 | ✅ Supported |
| Polygon Amoy | `'polygon'` | 80002 | 🔜 Coming soon |
| Optimism Sepolia | `'optimism'` | 11155420 | 🔜 Coming soon |

---

## Full Examples

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
const data = encodeCall({
  abi:          parseAbi(['function transfer(address to, uint256 amount)']),
  functionName: 'transfer',
  args:         [recipient, amount],
});

const messageId = await arbiLink.sendMessage({
  to:     'base',
  target: TOKEN_CONTRACT_ADDRESS,
  data,
});
```

### Read-only status polling (no wallet required)

```typescript
import { ArbiLink } from '@arbilink/sdk';
import { ethers }   from 'ethers';

const provider = new ethers.JsonRpcProvider('https://sepolia-rollup.arbitrum.io/rpc');
const arbiLink  = new ArbiLink(provider);

const msg = await arbiLink.getMessageStatus(42n);
console.log(msg.status); // 'confirmed'
```

---

## How ArbiLink Works

1. **User** calls `sendMessage()` on the **MessageHub** (Arbitrum Stylus).
2. **Relayers** watch for `MessageSent` events and deliver the message on the destination chain via `ArbiLinkReceiver.receiveMessage()`.
3. The relayer submits an **ECDSA execution proof** and calls `confirm_delivery()` on the hub, opening a **5-minute challenge window**.
4. Anyone can call `challenge_message()` with a fraud proof during that window. A valid fraud proof **slashes the relayer's stake**.
5. After the window closes without a challenge, `finalize_message()` marks the message as **confirmed**.

---

## Configuration

After running `scripts/deploy.sh`, update `src/constants.ts` with your deployed addresses:

```typescript
// packages/sdk/src/constants.ts
export const MESSAGE_HUB_ADDRESS = '0xYourMessageHubAddress';

export const RECEIVER_ADDRESSES: Record<number, string> = {
  11155111: '0xYourEthReceiver',
  84532:    '0xYourBaseReceiver',
};
```

---

## License

MIT
