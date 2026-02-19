# Types

All TypeScript types exported from `@arbilink/sdk`.

---

## `MessageStatus`

```typescript
type MessageStatus = 'pending' | 'relayed' | 'confirmed' | 'failed';
```

| Value | Description |
|-------|-------------|
| `'pending'` | Message sent on Arbitrum, waiting for a relayer |
| `'relayed'` | Relayer submitted the message to the destination chain |
| `'confirmed'` | Challenge window passed — delivery is final |
| `'failed'` | Message was challenged or could not be delivered |

---

## `Message`

Full message object returned by `getMessageStatus` and `watchMessage`.

```typescript
interface Message {
  id:          bigint;
  sender:      string;        // Address that called sendMessage()
  destination: number;        // Destination chain ID
  target:      string;        // Target contract address
  data:        string;        // ABI-encoded call data
  value:       bigint;        // ETH value sent with message (usually 0)
  fee:         bigint;        // Fee paid to the relayer (in wei)
  timestamp:   bigint;        // Block timestamp when sent
  relayer:     string;        // Relayer address (ZeroAddress if pending)
  status:      MessageStatus;
}
```

### Example

```typescript
const msg = await arbiLink.getMessageStatus(1n);

console.log(msg.id);          // 1n
console.log(msg.sender);      // '0xabc...'
console.log(msg.destination); // 11155111
console.log(msg.target);      // '0x742d...'
console.log(msg.status);      // 'confirmed'
console.log(msg.relayer);     // '0xdef...'
```

---

## `SendMessageParams`

Parameters for `arbiLink.sendMessage()`.

```typescript
interface SendMessageParams {
  chainId: number;   // Destination chain ID
  target:  string;   // Target contract address on destination chain
  data:    string;   // ABI-encoded function call (use encodeFunctionData from viem)
}
```

---

## `ChainConfig`

Configuration for a registered destination chain, returned by `getChainInfo()`.

```typescript
interface ChainConfig {
  chainId:  number;   // EVM chain ID
  receiver: string;   // ArbiLinkReceiver address on this chain
  fee:      bigint;   // Base fee in wei
  active:   boolean;  // Whether this chain is accepting messages
}
```

---

## `ArbiLinkError`

Custom error class thrown by the SDK.

```typescript
class ArbiLinkError extends Error {
  code:    string;           // Machine-readable error code
  details: string | null;    // Human-readable detail message
  cause:   unknown | null;   // Underlying error (if any)
}
```

See [Errors](/sdk/errors) for all error codes and how to handle them.

---

## Constants

```typescript
/** Chain ID of the MessageHub (Arbitrum Sepolia) */
const ARBITRUM_SEPOLIA_CHAIN_ID: number;   // 421614

/** All chains the SDK knows about */
const SUPPORTED_CHAINS: ChainConfig[];

/** Map of chain name → chain ID */
const CHAIN_IDS: Record<string, number>;

/** MessageHub contract address on Arbitrum Sepolia */
const MESSAGE_HUB_ADDRESS: string;

/** ArbiLinkReceiver address on each destination chain */
const RECEIVER_ADDRESSES: Record<number, string>;
```

### Example

```typescript
import {
  ARBITRUM_SEPOLIA_CHAIN_ID,
  CHAIN_IDS,
  RECEIVER_ADDRESSES,
} from '@arbilink/sdk';

console.log(ARBITRUM_SEPOLIA_CHAIN_ID);           // 421614
console.log(CHAIN_IDS.ethereum);                   // 11155111
console.log(RECEIVER_ADDRESSES[11155111]);         // '0x...'
```
