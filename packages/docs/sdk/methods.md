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

console.log(msg.status);            // 'pending' | 'relayed' | 'confirmed' | 'failed'
console.log(msg.sender);            // '0xabc...'
console.log(msg.destinationChain);  // 11155111
console.log(msg.relayer);           // '0xdef...' or undefined if not yet relayed
```

---

## `calculateFee(chainId)`

Calculate the current fee in wei required to send a message to a given chain.

```typescript
async calculateFee(chainId: number): Promise<bigint>
```

### Example

```typescript
import { formatEther } from 'ethers';

const fee = await arbiLink.calculateFee(11155111);
console.log(`Fee: ${formatEther(fee)} ETH`);
// → Fee: 0.0001 ETH
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

  if (msg.status === 'confirmed' || msg.status === 'failed') {
    unsubscribe(); // Stop polling
  }
});

// Or stop after 60 seconds
setTimeout(unsubscribe, 60_000);
```

---

## `messageCount()`

Get the total number of messages sent through the hub.

```typescript
async messageCount(): Promise<bigint>
```

### Example

```typescript
const total = await arbiLink.messageCount();
console.log(`Total messages: ${total}`);
```

---

## `owner()`

Get the hub owner address.

```typescript
async owner(): Promise<string>
```

### Example

```typescript
const owner = await arbiLink.owner();
console.log(`Hub owner: ${owner}`);
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

## `challengePeriod()`

Get the current challenge period in seconds.

```typescript
async challengePeriod(): Promise<bigint>
```

### Example

```typescript
const period = await arbiLink.challengePeriod();
console.log(`Challenge window: ${period}s`);
```

---

## `getChainInfo(chainId)`

Get configuration for a registered destination chain.

```typescript
async getChainInfo(chainId: number): Promise<...>
```

### Example

```typescript
const info = await arbiLink.getChainInfo(11155111);
```

---

## `getRelayerInfo(address)`

Fetch relayer details including stake and delivery count.

```typescript
async getRelayerInfo(address: string): Promise<RelayerInfo>
```

### Example

```typescript
const info = await arbiLink.getRelayerInfo('0xabc...');
console.log(info.active);               // boolean
console.log(info.stake);                // bigint (wei)
console.log(info.successfulDeliveries); // bigint
```

---

## `isActiveRelayer(address)`

Check whether an address is currently a registered, staked relayer.

```typescript
async isActiveRelayer(address: string): Promise<boolean>
```

### Example

```typescript
const active = await arbiLink.isActiveRelayer('0xabc...');
console.log(`Is active relayer: ${active}`);
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
