# Quick Start

Send your first cross-chain message in under 5 minutes.

## Prerequisites

- ArbiLink SDK installed (`pnpm add @arbilink/sdk ethers`)
- A wallet with Arbitrum Sepolia ETH ([faucet](https://faucet.arbitrum.io))
- Node.js 18+

## Step 1 — Create an ArbiLink instance

```typescript
import { ArbiLink }       from '@arbilink/sdk';
import { ethers }         from 'ethers';

// Using MetaMask or any injected wallet
const provider = new ethers.BrowserProvider(window.ethereum);
const signer   = await provider.getSigner();

const arbiLink = new ArbiLink(signer);
```

::: tip Using a private key (scripts/tests)
```typescript
import { Wallet, JsonRpcProvider } from 'ethers';

const provider = new JsonRpcProvider('https://sepolia-rollup.arbitrum.io/rpc');
const signer   = new Wallet(process.env.PRIVATE_KEY!, provider);
const arbiLink = new ArbiLink(signer);
```
:::

## Step 2 — Check the fee

```typescript
const ETHEREUM_SEPOLIA_CHAIN_ID = 11155111;

// Fee is in wei
const fee = await arbiLink.calculateFee(ETHEREUM_SEPOLIA_CHAIN_ID);
console.log(`Fee: ${ethers.formatEther(fee)} ETH`);
// → Fee: 0.0001 ETH
```

## Step 3 — Encode your function call

```typescript
import { encodeFunctionData } from 'viem';

// Example: call `store(uint256)` on a SimpleStorage contract
const data = encodeFunctionData({
  abi: [{ name: 'store', type: 'function', inputs: [{ type: 'uint256' }] }],
  functionName: 'store',
  args: [42n],
});
```

## Step 4 — Send the message

```typescript
const messageId = await arbiLink.sendMessage({
  chainId: ETHEREUM_SEPOLIA_CHAIN_ID,
  target:  '0xYourContractOnEthereumSepolia',
  data,
});

console.log(`Message sent! ID: ${messageId}`);
// → Message sent! ID: 1n
```

## Step 5 — Track delivery

```typescript
// Poll once
const message = await arbiLink.getMessageStatus(messageId);
console.log(message.status); // 'pending' | 'relayed' | 'confirmed' | 'failed'

// Or watch in real time
const unsubscribe = arbiLink.watchMessage(messageId, (msg) => {
  console.log(`Status: ${msg.status}`);

  if (msg.status === 'confirmed') {
    console.log('✅ Message delivered!');
    unsubscribe();
  }
});
```

## Full Example

```typescript
import { ArbiLink }                from '@arbilink/sdk';
import { ethers }                  from 'ethers';
import { encodeFunctionData }      from 'viem';

async function sendCrossChainMessage() {
  // 1. Setup
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer   = await provider.getSigner();
  const arbiLink = new ArbiLink(signer);

  // 2. Prepare
  const chainId = 11155111; // Ethereum Sepolia
  const target  = '0x742d35Cc6634C0532925a3b844BC454e4438f44e';
  const data    = encodeFunctionData({
    abi: [{ name: 'execute', type: 'function', inputs: [] }],
    functionName: 'execute',
    args: [],
  });

  // 3. Check fee
  const fee = await arbiLink.calculateFee(chainId);
  console.log(`Sending for ${ethers.formatEther(fee)} ETH`);

  // 4. Send
  const messageId = await arbiLink.sendMessage({ chainId, target, data });
  console.log(`Sent → message #${messageId}`);

  // 5. Watch
  const unsubscribe = arbiLink.watchMessage(messageId, (msg) => {
    console.log(`[${new Date().toISOString()}] ${msg.status}`);
    if (msg.status === 'confirmed' || msg.status === 'failed') {
      unsubscribe();
    }
  });
}

sendCrossChainMessage().catch(console.error);
```

## What Happens Next

After calling `sendMessage()`:

1. A `MessageSent` event is emitted on Arbitrum Sepolia
2. A relayer picks it up within seconds
3. The relayer calls `ArbiLinkReceiver.receiveMessage()` on your destination chain
4. Your `target` contract's function is called with your `data`
5. Status transitions: `pending` → `relayed` → `confirmed`

The whole process takes **~12 seconds** under normal network conditions.
