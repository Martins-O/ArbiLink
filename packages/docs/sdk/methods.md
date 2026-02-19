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
| `chainId` | `number` | Yes | Destination chain ID |
| `target` | `string` | Yes | Contract address on the destination chain |
| `data` | `string` | Yes | ABI-encoded function call data |

### Returns

`Promise<bigint>` — the message ID assigned by the hub contract.

### Example

```typescript
import { encodeFunctionData } from 'viem';

const data = encodeFunctionData({
  abi:         nftAbi,
  functionName: 'mint',
  args:        [recipient, tokenId],
});

const messageId = await arbiLink.sendMessage({
  chainId: 11155111,
  target:  NFT_CONTRACT,
  data,
});

console.log(`Message ID: ${messageId}`);
```

### Errors

| Error | Cause |
|-------|-------|
| `NOT_CONNECTED` | Called with a Provider instead of Signer |
| `ChainNotSupported` | `chainId` not registered in MessageHub |
| `InsufficientFee` | The transaction `value` was below the required fee |

::: tip Fee calculation
The fee is calculated automatically from `calculateFee()`. You do not need to pass it manually — the SDK handles this internally.
:::

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

console.log(msg.status);      // 'pending' | 'relayed' | 'confirmed' | 'failed'
console.log(msg.sender);      // '0xabc...'
console.log(msg.destination); // 11155111
console.log(msg.relayer);     // '0xdef...' or ZeroAddress if not yet relayed
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
// → Fee: 0.0001 ETH (~$0.23)
```

---

## `watchMessage(messageId, callback)`

Subscribe to real-time status updates for a message.

```typescript
watchMessage(
  messageId: bigint,
  callback: (message: Message) => void
): () => void
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `messageId` | `bigint` | The message ID to watch |
| `callback` | `(message: Message) => void` | Called on every status change |

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

::: tip Polling interval
`watchMessage` polls `getMessageStatus` every **3 seconds**. For lower latency, use `getMessageStatus` directly in a tighter loop.
:::

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

## `getChainInfo(chainId)`

Get configuration for a registered destination chain.

```typescript
async getChainInfo(chainId: number): Promise<ChainConfig | null>
```

### Returns

`ChainConfig | null` — `null` if the chain is not registered.

```typescript
const info = await arbiLink.getChainInfo(11155111);
if (info) {
  console.log(info.receiver);  // ArbiLinkReceiver address on that chain
  console.log(info.fee);       // Base fee in wei
  console.log(info.active);    // Whether the chain is accepting messages
}
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

::: warning Signer required
This method requires a Signer (not a Provider).
:::

### Parameters

| Parameter | Type | Required | Default |
|-----------|------|----------|---------|
| `stakeOverride` | `bigint` | No | `RELAYER_STAKE` constant (0.1 ETH) |

### Example

```typescript
import { parseEther } from 'ethers';

// Register with the default stake (0.1 ETH)
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

::: warning Cooldown period
There is a cooldown before stake is returned. Check `getChainInfo` for the current cooldown duration.
:::

### Example

```typescript
await arbiLink.exitRelayer();
console.log('Deregistered — stake will be returned after cooldown.');
```
