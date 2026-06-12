# ArbiLink Class

The `ArbiLink` class is the primary entry point for the SDK.

## Constructor

```typescript
new ArbiLink(signerOrProvider: ethers.Signer | ethers.Provider)
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `signerOrProvider` | `ethers.Signer \| ethers.Provider` | An ethers v6 Signer (for write operations) or Provider (read-only) |

### Examples

**With a browser wallet (write-capable):**
```typescript
import { ArbiLink } from '@arbilink/sdk';
import { BrowserProvider } from 'ethers';

const provider = new BrowserProvider(window.ethereum);
const signer   = await provider.getSigner();
const arbiLink = new ArbiLink(signer);
```

**With a private key (scripts):**
```typescript
import { Wallet, JsonRpcProvider } from 'ethers';

const provider = new JsonRpcProvider('https://sepolia-rollup.arbitrum.io/rpc');
const signer   = new Wallet(process.env.PRIVATE_KEY!, provider);
const arbiLink = new ArbiLink(signer);
```

**Read-only:**
```typescript
import { JsonRpcProvider } from 'ethers';

const provider  = new JsonRpcProvider('https://sepolia-rollup.arbitrum.io/rpc');
const arbiLink  = new ArbiLink(provider);
```

**With wagmi v2:**
```typescript
import { useWalletClient } from 'wagmi';
import { BrowserProvider, JsonRpcSigner } from 'ethers';
import { ArbiLink } from '@arbilink/sdk';

function useArbiLink() {
  const { data: walletClient } = useWalletClient();

  return useMemo(() => {
    if (!walletClient) return null;

    const { account, chain, transport } = walletClient;
    const network  = { chainId: chain!.id as number, name: chain!.name };
    const provider = new BrowserProvider(transport, network) as any;
    const signer   = new JsonRpcSigner(provider, account!.address);

    return new ArbiLink(signer);
  }, [walletClient]);
}
```

## Detecting Signer vs Provider

The SDK distinguishes signer from provider by checking for the `getAddress` method:

```typescript
const isSigner = 'getAddress' in signerOrProvider;
```

Write operations (`sendMessage`, `registerRelayer`, `exitRelayer`, `withdrawProtocolFees`) throw an `ArbiLinkError` with message `"This operation requires a Signer…"` if called on a read-only instance.

## Connection Check

```typescript
import { ArbiLink } from '@arbilink/sdk';

const readOnly = new ArbiLink(provider);

// Will throw ArbiLinkError: "This operation requires a Signer..."
await readOnly.sendMessage({ ... });
```

## Multiple Chains

The `ArbiLink` class always talks to Arbitrum Sepolia (chain 421614) as the hub. The `to` parameter in `sendMessage` specifies the **destination** chain, not the source.

```typescript
// Source is always Arbitrum Sepolia
// Destination is the chain you pass in `to`
await arbiLink.sendMessage({
  to:     84532,       // Destination: Base Sepolia
  target: '0x...',
  data:   '0x...',
});
```

You can also use chain short names:

```typescript
await arbiLink.sendMessage({
  to:     'base',
  target: '0x...',
  data:   '0x...',
});
```
