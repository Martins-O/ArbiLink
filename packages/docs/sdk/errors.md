# Errors

The SDK throws `ArbiLinkError` for all recoverable errors. Each error has a `code` field for programmatic handling.

## Error Class

```typescript
import { ArbiLinkError } from '@arbilink/sdk';

try {
  await arbiLink.sendMessage({ ... });
} catch (err) {
  if (err instanceof ArbiLinkError) {
    console.error(`[${err.code}] ${err.message}`);
    console.error('Details:', err.details);
    console.error('Cause:', err.cause);
  }
}
```

## Error Codes

| Code | Trigger | Resolution |
|------|---------|------------|
| `NOT_CONNECTED` | Write method called with Provider | Use a Signer instance |
| `CHAIN_NOT_SUPPORTED` | `chainId` not registered in MessageHub | Use a chain from `SUPPORTED_CHAINS` |
| `INSUFFICIENT_FEE` | Transaction value below required fee | Call `calculateFee()` first |
| `SEND_FAILED` | Transaction reverted during `sendMessage` | Check gas, fee, and target address |
| `RELAYER_ALREADY_REGISTERED` | `registerRelayer` called when already registered | Call `exitRelayer()` first |
| `RELAYER_NOT_REGISTERED` | `exitRelayer` called on non-relayer address | Address is not a registered relayer |
| `MESSAGE_NOT_FOUND` | `getMessageStatus` for an unknown ID | Verify the message ID |
| `UNKNOWN` | Unexpected contract error | Check `err.cause` for the underlying error |

## Handling Specific Errors

```typescript
import { ArbiLink, ArbiLinkError } from '@arbilink/sdk';

async function safeSend(arbiLink: ArbiLink, params: SendMessageParams) {
  try {
    return await arbiLink.sendMessage(params);

  } catch (err) {
    if (!(err instanceof ArbiLinkError)) throw err;

    switch (err.code) {
      case 'NOT_CONNECTED':
        console.error('Connect your wallet before sending.');
        break;

      case 'CHAIN_NOT_SUPPORTED':
        console.error(`Chain ${params.chainId} is not supported.`);
        console.error('Supported chains:', SUPPORTED_CHAINS.map(c => c.chainId));
        break;

      case 'INSUFFICIENT_FEE':
        console.error('Fee too low — recalculating…');
        const fee = await arbiLink.calculateFee(params.chainId);
        // Retry with correct fee (SDK handles this automatically)
        return await arbiLink.sendMessage(params);

      default:
        console.error(`Unexpected error [${err.code}]:`, err.message);
        throw err;
    }
  }
}
```

## Contract Errors

The underlying `MessageHub` contract defines these revert errors:

```solidity
error ChainNotSupported(uint256 chainId);
error InsufficientFee(uint256 provided, uint256 required);
error MessageAlreadyProcessed(uint256 messageId);
error NotAuthorized();
error RelayerNotActive(address relayer);
error RelayerAlreadyRegistered(address relayer);
error ChallengeWindowActive(uint256 deadline);
```

These are mapped to `ArbiLinkError` codes automatically by the SDK. You can access the raw contract error via `err.cause`.
