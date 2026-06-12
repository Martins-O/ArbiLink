# Errors

The SDK throws `ArbiLinkError` for recoverable errors. The error message describes the issue; `err.cause` contains the underlying error if available.

## Error Class

```typescript
import { ArbiLinkError } from '@arbilink/sdk';

try {
  await arbiLink.sendMessage({ ... });
} catch (err) {
  if (err instanceof ArbiLinkError) {
    console.error(err.message);
    if (err.cause) console.error('Cause:', err.cause);
  }
}
```

## Common Scenarios

| Message Pattern | Likely Cause | Resolution |
|-----------------|--------------|------------|
| `"This operation requires a Signer…"` | Write method called with Provider | Use a Signer instance |
| `"Failed to send message to chain …"` | Chain not registered, or fee too low | Use a supported chain or call `calculateFee()` first |
| `"Failed to fetch status for message …"` | Unknown message ID | Verify the message ID |
| `"MessageSent event not found in receipt"` | Hub contract address mismatch | Check `MESSAGE_HUB_ADDRESS` |
| `"Signer has no attached provider"` | Signer created without a connected provider | Ensure signer has a network connection |

## Handling Errors

```typescript
import { ArbiLink, ArbiLinkError } from '@arbilink/sdk';

async function safeSend(arbiLink: ArbiLink, params: SendMessageParams) {
  try {
    return await arbiLink.sendMessage(params);
  } catch (err) {
    if (err instanceof ArbiLinkError) {
      console.error('ArbiLink error:', err.message);
      if (err.message.includes('Signer')) {
        console.error('Connect your wallet before sending.');
      } else if (err.message.includes('chain')) {
        console.error(`Chain not supported or fee incorrect.`);
      }
    }
    throw err;
  }
}
```

## Contract Errors

The underlying `MessageHub` contract defines these revert errors, accessible via `err.cause`:

```solidity
error ChainNotSupported(uint256 chainId);
error InsufficientFee(uint256 provided, uint256 required);
error InvalidInput(string reason);
error MessageAlreadyProcessed(uint256 messageId);
error NotAuthorized();
error RelayerNotActive(address relayer);
error RelayerAlreadyRegistered(address relayer);
error ChallengeWindowActive(uint256 deadline);
```

The SDK wraps these into `ArbiLinkError` with a descriptive message. Check `err.cause` for the raw contract error if you need the exact revert data.
