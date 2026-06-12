# Types

All TypeScript types exported from `@arbilink/sdk`.

---

## `ChainId`

```typescript
type ChainId = 11155111 | 84532 | 80002 | 11155420;
```

---

## `ChainName`

```typescript
type ChainName = 'ethereum' | 'base' | 'polygon' | 'optimism';
```

---

## `ChainConfig`

Configuration for a supported chain.

```typescript
interface ChainConfig {
  id: number;
  name: string;              // e.g. 'Ethereum Sepolia'
  shortName: ChainName;      // e.g. 'ethereum'
  rpc: string;               // Public RPC endpoint
  explorer: string;          // Block explorer URL
  receiverAddress: string;   // ArbiLinkReceiver address on this chain
}
```

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
  id: bigint;
  status: MessageStatus;
  sender?: string;            // Address that called sendMessage()
  destinationChain?: number;  // Destination chain ID
  target?: string;            // Target contract address on destination chain
  data?: string;              // ABI-encoded call data
  feePaid?: bigint;           // Protocol fee paid (in wei)
  relayer?: string;           // Relayer address (present once relayed/confirmed)
}
```

Fields are populated from on-chain events. Recent messages have all fields; older archived messages may have partial data.

### Example

```typescript
const msg = await arbiLink.getMessageStatus(1n);

console.log(msg.id);                // 1n
console.log(msg.sender);            // '0xabc...'
console.log(msg.destinationChain);  // 11155111
console.log(msg.target);            // '0x742d...'
console.log(msg.status);            // 'confirmed'
console.log(msg.relayer);           // '0xdef...'
```

---

## `SendMessageParams`

Parameters for `arbiLink.sendMessage()`.

```typescript
interface SendMessageParams {
  to: number | ChainName;  // Destination chain — numeric ID or short name ('ethereum', 'base', 'polygon', 'optimism')
  target: string;          // Target contract address on the destination chain
  data: string;            // ABI-encoded function call (use encodeCall() helper)
  fee?: bigint;            // Override the auto-calculated fee (wei). Fetched from hub if omitted.
}
```

---

## `WatchOptions`

```typescript
interface WatchOptions {
  pollIntervalMs?: number;  // Poll interval in ms when WebSocket is unavailable (default: 3000)
}
```

---

## `RelayerInfo`

Relayer status and statistics, returned by `getRelayerInfo()`.

```typescript
interface RelayerInfo {
  active: boolean;
  stake: bigint;
  successfulDeliveries: bigint;
}
```

---

## `ArbiLinkError`

Custom error class thrown by the SDK.

```typescript
class ArbiLinkError extends Error {
  message: string;
  cause?: unknown;         // Underlying error (contract revert, network error, etc.)
}
```

The SDK does not use error codes. Check the error message or `cause` for details:

```typescript
try {
  await arbiLink.sendMessage({ ... });
} catch (err) {
  if (err instanceof ArbiLinkError) {
    console.error(err.message);       // Human-readable description
    console.error(err.cause);         // Raw error (contract revert, etc.)
  }
}
```

See [Errors](/sdk/errors) for common error scenarios.

---

## Constants

```typescript
/** Chain ID of the MessageHub (Arbitrum Sepolia) */
const ARBITRUM_SEPOLIA_CHAIN_ID: number;   // 421614

/** Default RPC for Arbitrum Sepolia */
const ARBITRUM_SEPOLIA_RPC: string;        // 'https://sepolia-rollup.arbitrum.io/rpc'

/** All chains the SDK knows about */
const SUPPORTED_CHAINS: ChainConfig[];

/** Map of chain name → chain ID */
const CHAIN_IDS: Record<ChainName, number>;

/** MessageHub contract address on Arbitrum Sepolia */
const MESSAGE_HUB_ADDRESS: string;

/** ArbiLinkReceiver address on each destination chain */
const RECEIVER_ADDRESSES: Record<number, string>;

/** Default challenge period in seconds (matches hub deployment param) */
const DEFAULT_CHALLENGE_PERIOD_SECS: number;  // 300
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
console.log(RECEIVER_ADDRESSES[11155111]);         // '0x8950...'
```
