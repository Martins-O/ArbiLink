# Troubleshooting

## SDK Errors

### `NOT_CONNECTED` — Write method called without a Signer

```
ArbiLinkError [NOT_CONNECTED]: A Signer is required for this operation
```

**Fix:** Create `ArbiLink` with a Signer, not a Provider:

```typescript
// ❌ Wrong — read-only
const arbiLink = new ArbiLink(new JsonRpcProvider(rpc));
await arbiLink.sendMessage(...); // throws NOT_CONNECTED

// ✅ Correct — has signer
const signer = await provider.getSigner();
const arbiLink = new ArbiLink(signer);
```

---

### `CHAIN_NOT_SUPPORTED` — Unsupported destination chain

```
ArbiLinkError [CHAIN_NOT_SUPPORTED]: Chain 1 is not registered in MessageHub
```

**Fix:** Use a supported chain ID. Check `SUPPORTED_CHAINS`:

```typescript
import { SUPPORTED_CHAINS } from '@arbilink/sdk';
console.log(SUPPORTED_CHAINS.map(c => c.chainId));
// [11155111, 84532]
```

Supported chains: Ethereum Sepolia (`11155111`), Base Sepolia (`84532`).

---

### `INSUFFICIENT_FEE` — Transaction value too low

```
Error: execution reverted: InsufficientFee(provided, required)
```

**Fix:** The SDK calculates fees automatically — this usually means the fee changed between estimation and send. Retry the transaction:

```typescript
// The SDK handles fee calculation internally
// If you're calling the contract directly, use get_fee():
const fee = await hub.get_fee(chainId);
await hub.send_message(chainId, target, data, { value: fee });
```

---

### Message stuck at `pending`

**Symptoms:** `watchMessage` callback keeps receiving `status: 'pending'` with no progress.

**Causes & fixes:**

| Cause | Fix |
|-------|-----|
| No active relayer on the network | Run the relayer node locally (see README) |
| Wrong RPC endpoint | Verify `https://sepolia-rollup.arbitrum.io/rpc` responds |
| Message ID incorrect | Double-check the ID returned by `sendMessage` |
| Message failed silently | Check `get_message(id)` directly on the hub contract |

---

### TypeScript: `Cannot find module '@arbilink/sdk'`

**Fix:** Add the package and install:

```bash
pnpm add @arbilink/sdk ethers
```

If using pnpm workspaces, verify `pnpm-workspace.yaml` includes the SDK package:

```yaml
packages:
  - 'packages/*'
```

---

### `WalletClient` import error (wagmi)

```
Module '"wagmi"' has no exported member 'WalletClient'
```

**Fix:** Import `WalletClient` from `viem`, not `wagmi`:

```typescript
// ❌ Wrong
import type { WalletClient } from 'wagmi';

// ✅ Correct
import type { WalletClient } from 'viem';
```

---

### Vite: `@arbilink/sdk` not resolving (CommonJS vs ESM)

If Vite throws errors about CommonJS modules, add an alias in `vite.config.ts`:

```typescript
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@arbilink/sdk': path.resolve(__dirname, '../sdk/src/index.ts'),
    },
  },
});
```

---

## Contract Errors

### `receiveMessage` reverts on destination

| Revert reason | Cause | Fix |
|---------------|-------|-----|
| `Unauthorized` | `msg.sender` is not the registered relayer | Relayer not approved in receiver contract |
| `Already processed` | Duplicate delivery | Message was already delivered |
| Target call reverted | Your contract's function reverted | Debug the target contract independently |

---

### Foundry tests failing

**`vm.envString` not loading `.env`**:

```bash
# Load .env in Foundry tests
source .env && forge test
# or
forge test --ffi
```

**Contract not found at address**:

Verify the receiver address in your test matches the deployed contract:

```bash
cat deployment-info.json | jq '.receiver_ethereum'
```

---

## Network Issues

### Arbitrum Sepolia RPC timeout

Try alternative public endpoints:

```
https://sepolia-rollup.arbitrum.io/rpc
https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY
https://arbitrum-sepolia.blockpi.network/v1/rpc/public
```

### Transaction not found after `sendMessage`

Arbitrum Sepolia can occasionally reorganise. Wait ~30 seconds and retry `getMessageStatus`.

---

## Still stuck?

Open an issue at [github.com/Martins-O/ArbiLink/issues](https://github.com/Martins-O/ArbiLink/issues) with:

- SDK version (`pnpm list @arbilink/sdk`)
- Error message + stack trace
- Code snippet that reproduces the issue
- Chain IDs involved
