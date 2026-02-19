# Basic Examples

Foundational patterns every ArbiLink integration needs.

## 1 — Send a Message (Node.js script)

```typescript
// send.ts
import { ArbiLink }           from '@arbilink/sdk';
import { Wallet, JsonRpcProvider, formatEther } from 'ethers';
import { encodeFunctionData } from 'viem';

async function main() {
  const provider = new JsonRpcProvider('https://sepolia-rollup.arbitrum.io/rpc');
  const signer   = new Wallet(process.env.PRIVATE_KEY!, provider);
  const arbiLink = new ArbiLink(signer);

  // Encode function call
  const data = encodeFunctionData({
    abi:         [{ name: 'ping', type: 'function', inputs: [] }],
    functionName: 'ping',
    args:        [],
  });

  // Check fee first
  const fee = await arbiLink.calculateFee(11155111);
  console.log(`Fee: ${formatEther(fee)} ETH`);

  // Send
  const id = await arbiLink.sendMessage({
    chainId: 11155111,
    target:  '0xYourContractOnSepolia',
    data,
  });

  console.log(`Sent — message ID: #${id}`);
}

main().catch(console.error);
```

## 2 — Check Message Status

```typescript
import { ArbiLink }        from '@arbilink/sdk';
import { JsonRpcProvider } from 'ethers';

const provider = new JsonRpcProvider('https://sepolia-rollup.arbitrum.io/rpc');
const arbiLink = new ArbiLink(provider);

const msg = await arbiLink.getMessageStatus(42n);

console.log('ID:          ', msg.id);
console.log('Status:      ', msg.status);       // pending | relayed | confirmed | failed
console.log('Sender:      ', msg.sender);
console.log('Destination: ', msg.destination);
console.log('Relayer:     ', msg.relayer);
```

## 3 — Watch Until Confirmed

```typescript
function waitForConfirmation(arbiLink: ArbiLink, messageId: bigint): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error('Timed out after 2 minutes'));
    }, 120_000);

    const unsubscribe = arbiLink.watchMessage(messageId, (msg) => {
      process.stdout.write(`\r  Status: ${msg.status.padEnd(12)}`);

      if (msg.status === 'confirmed') {
        clearTimeout(timeout);
        unsubscribe();
        console.log('\n✅ Delivered!');
        resolve();
      }
      if (msg.status === 'failed') {
        clearTimeout(timeout);
        unsubscribe();
        reject(new Error('Message failed'));
      }
    });
  });
}

// Usage
const id = await arbiLink.sendMessage({ ... });
await waitForConfirmation(arbiLink, id);
```

## 4 — Estimate Fee

```typescript
import { ArbiLink, SUPPORTED_CHAINS } from '@arbilink/sdk';
import { JsonRpcProvider, formatEther } from 'ethers';

const provider = new JsonRpcProvider('https://sepolia-rollup.arbitrum.io/rpc');
const arbiLink = new ArbiLink(provider);

// Estimate for all supported chains
for (const chain of SUPPORTED_CHAINS) {
  const fee = await arbiLink.calculateFee(chain.chainId);
  console.log(`${chain.chainId}: ${formatEther(fee)} ETH`);
}
```

## 5 — Check Total Message Count

```typescript
const count = await arbiLink.messageCount();
console.log(`Total messages sent: ${count}`);
```

## 6 — Get Chain Info

```typescript
const info = await arbiLink.getChainInfo(11155111);

if (info) {
  console.log('Receiver:', info.receiver);
  console.log('Fee:     ', formatEther(info.fee), 'ETH');
  console.log('Active:  ', info.active);
} else {
  console.log('Chain not registered');
}
```
