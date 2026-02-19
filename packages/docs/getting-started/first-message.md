# Your First Cross-Chain Message

A complete end-to-end walkthrough — from writing a receiver contract to watching your message arrive on the destination chain.

## What We'll Build

We'll send a message from **Arbitrum Sepolia** that calls a `setValue(uint256)` function on a contract deployed on **Ethereum Sepolia**.

## Part 1 — Deploy a Receiver Contract

Any contract can receive ArbiLink messages. The only requirement is that `ArbiLinkReceiver` is registered as the caller of your contract (it uses `msg.sender`).

Create `SimpleStorage.sol` on Ethereum Sepolia:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SimpleStorage {
    uint256 public value;
    address public arbiLinkReceiver; // only the ArbiLinkReceiver can write

    event ValueSet(uint256 newValue, address caller);

    constructor(address _receiver) {
        arbiLinkReceiver = _receiver;
    }

    function setValue(uint256 _value) external {
        require(msg.sender == arbiLinkReceiver, "Not authorized");
        value = _value;
        emit ValueSet(_value, msg.sender);
    }
}
```

Deploy it and note the address:

```bash
# Using Foundry
forge create SimpleStorage \
  --rpc-url https://rpc.sepolia.org \
  --private-key $PRIVATE_KEY \
  --constructor-args 0xARBILINK_RECEIVER_ON_SEPOLIA
```

::: tip ArbiLinkReceiver addresses
Check `/api/contracts` for the deployed `ArbiLinkReceiver` address on each chain.
:::

## Part 2 — Send the Message

```typescript
import { ArbiLink }           from '@arbilink/sdk';
import { ethers }             from 'ethers';
import { encodeFunctionData } from 'viem';

// Connect to Arbitrum Sepolia
const provider = new ethers.JsonRpcProvider('https://sepolia-rollup.arbitrum.io/rpc');
const signer   = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
const arbiLink = new ArbiLink(signer);

const SIMPLE_STORAGE_ADDRESS = '0xYourSimpleStorageAddress';
const NEW_VALUE              = 12345n;

// Encode the function call
const data = encodeFunctionData({
  abi: [{
    name:    'setValue',
    type:    'function',
    inputs:  [{ name: '_value', type: 'uint256' }],
    outputs: [],
  }],
  functionName: 'setValue',
  args: [NEW_VALUE],
});

// Send cross-chain message
const messageId = await arbiLink.sendMessage({
  chainId: 11155111,               // Ethereum Sepolia
  target:  SIMPLE_STORAGE_ADDRESS,
  data,
});

console.log(`✅ Message sent — ID: #${messageId}`);
```

## Part 3 — Track Delivery

```typescript
console.log('Waiting for delivery…');

const unsubscribe = arbiLink.watchMessage(messageId, async (msg) => {
  const ts = new Date().toLocaleTimeString();

  switch (msg.status) {
    case 'pending':
      console.log(`[${ts}] Pending — waiting for relayer`);
      break;

    case 'relayed':
      console.log(`[${ts}] Relayed — submitted to Ethereum Sepolia`);
      break;

    case 'confirmed':
      console.log(`[${ts}] ✅ Confirmed — message delivered!`);
      unsubscribe();

      // Verify on destination chain
      await verifyOnDestination(SIMPLE_STORAGE_ADDRESS, NEW_VALUE);
      break;

    case 'failed':
      console.error(`[${ts}] ❌ Failed — message was not delivered`);
      unsubscribe();
      break;
  }
});
```

## Part 4 — Verify on Destination

```typescript
async function verifyOnDestination(contractAddress: string, expected: bigint) {
  const ethProvider = new ethers.JsonRpcProvider('https://rpc.sepolia.org');

  const storage = new ethers.Contract(
    contractAddress,
    ['function value() view returns (uint256)'],
    ethProvider,
  );

  const value = await storage.value();
  console.log(`On-chain value: ${value}`);
  console.log(`Match: ${value === expected ? '✅' : '❌'}`);
}
```

## Expected Output

```
✅ Message sent — ID: #42
Waiting for delivery…
[12:34:01] Pending — waiting for relayer
[12:34:03] Relayed — submitted to Ethereum Sepolia
[12:34:15] ✅ Confirmed — message delivered!
On-chain value: 12345
Match: ✅
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| `InsufficientFee` error | Fee value too low | Call `calculateFee()` and pass it as `value` |
| `ChainNotSupported` error | chainId not registered | Use a supported chain from `SUPPORTED_CHAINS` |
| Status stuck at `pending` | No active relayer | Relayer network starting up; wait or run local relayer |
| Transaction reverts on destination | Wrong receiver address | Verify `arbiLinkReceiver` matches the deployed receiver address |

## Next Steps

- [SDK Methods Reference](/sdk/methods) — all available methods
- [Cross-Chain NFT Guide](/guides/nft-minting) — real-world NFT minting example
- [Advanced Patterns](/guides/advanced-patterns) — error handling, retries, batch messages
