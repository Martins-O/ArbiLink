# Methods

Complete reference for all `ArbiLink` instance methods.

---

## `sendMessage(params)`

Send a cross-chain message from Arbitrum to a destination chain.

```typescript
async sendMessage(params: SendMessageParams): Promise<bigint>
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `to` | `number \| ChainName` | Yes | Destination chain ID or short name (`'ethereum'`, `'base'`, `'polygon'`, `'optimism'`) |
| `target` | `string` | Yes | Contract address on the destination chain |
| `data` | `string` | Yes | ABI-encoded function call data (use `encodeCall()`) |
| `fee` | `bigint` | No | Override the auto-calculated fee — fetched from hub if omitted |

### Returns

`Promise<bigint>` — the message ID assigned by the hub contract.

### Example

```typescript
const messageId = await arbiLink.sendMessage({
  to:     'ethereum',
  target: NFT_CONTRACT,
  data:   encodeCall({
    abi:          nftAbi,
    functionName: 'mint',
    args:         [recipient, tokenId],
  }),
});

console.log(`Message ID: ${messageId}`);
```

---

## `getMessageStatus(messageId)`

Get the current status and details of a message.

```typescript
async getMessageStatus(messageId: bigint): Promise<Message>
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `messageId` | `bigint` | The message ID returned by `sendMessage` |

### Returns

`Promise<Message>` — see [Types](/sdk/types) for the full `Message` shape.

### Example

```typescript
const msg = await arbiLink.getMessageStatus(42n);

console.log(msg.status);            // 'pending' | 'relayed' | 'failed'
console.log(msg.sender);            // '0xabc...'
console.log(msg.destinationChain);  // 11155111
```

---

## `watchMessage(messageId, callback)`

Subscribe to real-time status updates for a message.

```typescript
watchMessage(
  messageId: bigint,
  callback: (message: Message) => void,
  options?: WatchOptions,
): () => void
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `messageId` | `bigint` | The message ID to watch |
| `callback` | `(message: Message) => void` | Called on every status change |
| `options` | `WatchOptions` | *(optional)* `pollIntervalMs` for WebSocket fallback |

### Returns

An **unsubscribe** function — call it to stop listening.

### Example

```typescript
const unsubscribe = arbiLink.watchMessage(messageId, (msg) => {
  console.log(`Status: ${msg.status}`);

  if (msg.status === 'failed') {
    unsubscribe(); // Stop polling
  }
});

// Or stop after 60 seconds
setTimeout(unsubscribe, 60_000);
```

---

## `minStake()`

Get the minimum stake (wei) required to register as a relayer.

```typescript
async minStake(): Promise<bigint>
```

### Example

```typescript
const stake = await arbiLink.minStake();
console.log(`Min stake: ${formatEther(stake)} ETH`);
```

---

## `getRelayerInfo(address)`

Fetch relayer details including active status and stake.

```typescript
async getRelayerInfo(address: string): Promise<RelayerInfo>
```

### Example

```typescript
const info = await arbiLink.getRelayerInfo('0xabc...');
console.log(info.active);  // boolean
console.log(info.stake);   // bigint (wei)
```

---

## `protocolFeeBalance()`

Get the accumulated protocol fee balance in wei.

```typescript
async protocolFeeBalance(): Promise<bigint>
```

---

## `registerRelayer(stakeOverride?)`

Register the signer as a relayer by staking ETH.

```typescript
async registerRelayer(stakeOverride?: bigint): Promise<void>
```

### Parameters

| Parameter | Type | Required | Default |
|-----------|------|----------|---------|
| `stakeOverride` | `bigint` | No | Fetched from hub (`minStake()`) |

### Example

```typescript
import { parseEther } from 'ethers';

// Register with the minimum stake
await arbiLink.registerRelayer();

// Register with a custom stake
await arbiLink.registerRelayer(parseEther('0.5'));
```

---

## `exitRelayer()`

Deregister as a relayer and withdraw stake.

```typescript
async exitRelayer(): Promise<void>
```

### Example

```typescript
await arbiLink.exitRelayer();
console.log('Deregistered — stake returned.');
```

---

## `withdrawProtocolFees()`

Withdraw accumulated protocol fees. Only callable by the hub owner.

```typescript
async withdrawProtocolFees(): Promise<void>
```

### Example

```typescript
await arbiLink.withdrawProtocolFees();
```
