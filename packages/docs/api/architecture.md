# Architecture

Deep dive into how ArbiLink works under the hood.

## System Overview

```
Arbitrum Sepolia (Source Chain)
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  User / dApp                                            │
│     │                                                   │
│     │  sendMessage(chainId, target, data)               │
│     ▼                                                   │
│  MessageHub.sol (Rust / Stylus / WASM)                  │
│     │  - Validates chainId is registered                │
│     │  - Validates fee ≥ minimum                        │
│     │  - Assigns messageId (auto-increment)             │
│     │  - Stores message in mapping                      │
│     │  - Emits MessageSent event                        │
│     │  - Sets status = PENDING                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
                     │
                     │  Off-chain: Relayer watches MessageSent
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Relayer Node (off-chain, staked)                       │
│     │  - Listens to Arbitrum Sepolia events             │
│     │  - Picks up MessageSent                           │
│     │  - Signs execution proof (ECDSA)                  │
│     │  - Calls receiveMessage() on destination          │
└─────────────────────────────────────────────────────────┘
                     │
                     ▼
Destination Chain (Ethereum / Base / Polygon / …)
┌─────────────────────────────────────────────────────────┐
│  ArbiLinkReceiver.sol                                   │
│     │  - Verifies ECDSA proof from relayer              │
│     │  - Checks message not already processed           │
│     │  - Calls target.call(data)                        │
│     │  - Records receipt                                │
│     │  - Emits MessageReceived                          │
│     ▼                                                   │
│  Your Contract (target)                                 │
│     │  - Executes arbitrary logic                       │
│     │  - msg.sender = ArbiLinkReceiver                  │
└─────────────────────────────────────────────────────────┘
                     │
                     │  Relayer reports back
                     ▼
┌─────────────────────────────────────────────────────────┐
│  MessageHub (Arbitrum Sepolia)                          │
│     │  - confirm_delivery(messageId)                    │
│     │  - Starts 5-min challenge window                  │
│     │  - After window: status = CONFIRMED               │
│     │  - Relayer stake returned + fee paid              │
└─────────────────────────────────────────────────────────┘
```

## Message Lifecycle

| Phase | Contract | Event | Duration |
|-------|----------|-------|----------|
| **Sent** | MessageHub | `MessageSent` | Instant |
| **Relayed** | ArbiLinkReceiver | `MessageReceived` | ~2–5 seconds |
| **Challenge Window** | MessageHub | — | 300 seconds |
| **Confirmed** | MessageHub | `MessageFinalized` | After window |

## Security Model

### Optimistic Delivery

ArbiLink uses an **optimistic** approach — messages are executed immediately on the destination, then secured retroactively.

1. Relayer executes the message
2. Relayer calls `confirm_delivery(messageId)` on MessageHub
3. A 5-minute challenge window opens
4. Anyone can call `challenge_message(messageId)` if they believe the delivery was fraudulent
5. If challenged, the MessageHub verifies against the execution proof
6. If invalid: relayer is **slashed**, stake goes to challenger
7. If valid: challenge is rejected, window continues
8. After window closes: `finalize_message()` → `CONFIRMED`, stake returned

### Relayer Incentives

```
Relayer earns:  message.fee (paid by sender)
Relayer risks:  RELAYER_STAKE (0.1 ETH) — slashed on fraud

Expected value (honest):    fee × messages_delivered
Expected value (fraudulent): slashAmount × P(caught)

Since P(caught) ≈ 1 (permissionless challenge), fraud is irrational.
```

### Replay Protection

`ArbiLinkReceiver` maintains a `processedMessages` mapping:

```solidity
mapping(uint256 => bool) public processedMessages;

function receiveMessage(uint256 messageId, ...) external {
    require(!processedMessages[messageId], "Already processed");
    processedMessages[messageId] = true;
    // ... execute
}
```

### ECDSA Execution Proof

Every delivery requires a signature proving the message was actually executed:

```
proof = ECDSA.sign(
    keccak256(abi.encodePacked(messageId, target, data, success)),
    relayerPrivateKey
)
```

The receiver verifies `proof` against the registered relayer address before executing.

## Arbitrum Stylus (Rust)

`MessageHub` is written in **Rust** and compiled to WASM via the Stylus SDK:

```rust
#[stylus_sdk::prelude::public]
impl MessageHub {
    pub fn send_message(
        &mut self,
        chain_id: U256,
        target: Address,
        data: Bytes,
    ) -> Result<U256, Vec<u8>> {
        let fee = self.get_fee(chain_id)?;
        require!(msg::value() >= fee, InsufficientFee);

        let id = self.message_count.get() + U256::from(1);
        self.message_count.set(id);

        // Store and emit …
        Ok(id)
    }
}
```

**Stylus advantages over Solidity for this use case:**

| Metric | Solidity | Stylus (Rust) |
|--------|----------|---------------|
| Gas (send_message) | ~80,000 | ~8,000 |
| Bytecode size | ~12 KB | ~45 KB (compressed WASM) |
| Memory safety | No | Yes (Rust borrow checker) |
| Execution speed | EVM | WASM (~10×) |

## SDK Design

The `@arbilink/sdk` abstracts the ABI calls and provides:

1. **Fee calculation** — calls `get_fee()` and caches result
2. **Message encoding** — handles ABI encoding of `send_message` params
3. **Event parsing** — extracts `messageId` from `MessageSent` log
4. **Status polling** — wraps `get_message()` with exponential backoff
5. **Watch subscriptions** — `setInterval` wrapper around `getMessageStatus`

```typescript
// Internally, sendMessage does:
const tx     = await this.hub.send_message(chainId, target, data, { value: fee });
const receipt = await tx.wait();
const log    = receipt.logs.find(l => hubInterface.parseLog(l)?.name === 'MessageSent');
const [id]   = hubInterface.parseLog(log).args;
return id;
```
