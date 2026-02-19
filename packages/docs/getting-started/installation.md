# Installation

## Requirements

- Node.js 18+
- An Arbitrum Sepolia RPC endpoint
- A wallet funded with Arbitrum Sepolia ETH (for sending messages)

## Install the SDK

::: code-group

```bash [npm]
npm install @arbilink/sdk ethers
```

```bash [pnpm]
pnpm add @arbilink/sdk ethers
```

```bash [yarn]
yarn add @arbilink/sdk ethers
```

:::

::: tip ethers v6 required
The SDK is built against **ethers v6**. If your project uses ethers v5, install `ethers@6` separately and use it only for the SDK.
:::

## Peer Dependencies

The SDK has the following peer dependencies:

| Package | Version | Required |
|---------|---------|----------|
| `ethers` | `^6.9.0` | Yes |
| `viem` | `^2.0.0` | Optional (for `encodeCall` utility) |

## wagmi / RainbowKit Users

If you're using wagmi v2, bridge the wallet client to an ethers signer using the included utility:

```typescript
import { walletClientToSigner } from '@arbilink/sdk/utils';
import { useWalletClient } from 'wagmi';

function useArbiLink() {
  const { data: walletClient } = useWalletClient();

  return useMemo(() => {
    if (!walletClient) return null;
    const signer = walletClientToSigner(walletClient);
    return new ArbiLink(signer);
  }, [walletClient]);
}
```

## Read-Only Mode

The SDK also works without a signer for read-only operations:

```typescript
import { ArbiLink }        from '@arbilink/sdk';
import { JsonRpcProvider } from 'ethers';

const provider  = new JsonRpcProvider('https://sepolia-rollup.arbitrum.io/rpc');
const arbiLink  = new ArbiLink(provider);

// Read-only operations
const fee    = await arbiLink.calculateFee(11155111);
const msg    = await arbiLink.getMessageStatus(42n);
const count  = await arbiLink.messageCount();
```

## TypeScript

The SDK ships with full TypeScript declarations. No extra `@types` package needed.

```typescript
import type {
  SendMessageParams,
  Message,
  MessageStatus,
  ChainConfig,
  ArbiLinkError,
} from '@arbilink/sdk';
```

## Verify Installation

```typescript
import { ArbiLink, ARBITRUM_SEPOLIA_CHAIN_ID } from '@arbilink/sdk';

console.log('ArbiLink SDK loaded. Hub chain:', ARBITRUM_SEPOLIA_CHAIN_ID);
// → ArbiLink SDK loaded. Hub chain: 421614
```
