# Smart Contracts

Reference for all ArbiLink smart contracts.

## MessageHub (Arbitrum Sepolia)

The core Rust/Stylus contract that manages messages, relayers, and chains.

**Address:** `0x` *(see deployment-info.json after running `scripts/deploy.sh`)*
**Chain:** Arbitrum Sepolia (421614)
**Language:** Rust (Arbitrum Stylus / WASM)

### Functions

#### `send_message`
```solidity
function send_message(
    uint256 chainId,
    address target,
    bytes   calldata data
) external payable returns (uint256 messageId)
```

Sends a cross-chain message. Emits `MessageSent`.

| Parameter | Type | Description |
|-----------|------|-------------|
| `chainId` | `uint256` | Destination EVM chain ID |
| `target` | `address` | Target contract on destination chain |
| `data` | `bytes` | ABI-encoded call data |

**Value:** Must be `≥ get_fee(chainId)`. Excess is refunded.

---

#### `confirm_delivery`
```solidity
function confirm_delivery(uint256 messageId) external
```

Called by relayers to record successful delivery. Only callable by registered relayers.

---

#### `challenge_message`
```solidity
function challenge_message(uint256 messageId) external
```

Challenge a claimed delivery. Callable by anyone during the 5-minute challenge window.

---

#### `finalize_message`
```solidity
function finalize_message(uint256 messageId) external
```

Finalize a message after the challenge window. Releases relayer stake return.

---

#### `get_fee`
```solidity
function get_fee(uint256 chainId) external view returns (uint256)
```

Returns the current fee in wei to send to `chainId`.

---

#### `get_message`
```solidity
function get_message(uint256 messageId) external view returns (
    address sender,
    uint256 destination,
    address target,
    bytes   memory data,
    uint256 value,
    uint256 fee,
    uint256 timestamp,
    address relayer,
    uint8   status
)
```

---

#### `register_relayer`
```solidity
function register_relayer() external payable
```

Register as a relayer. Must send `RELAYER_STAKE` (0.1 ETH).

---

#### `exit_relayer`
```solidity
function exit_relayer() external
```

Deregister as a relayer. Stake returned after cooldown.

---

#### `add_chain`
```solidity
function add_chain(
    uint256 chainId,
    address receiver,
    uint256 fee
) external
```

Owner-only. Register a new destination chain.

---

### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `RELAYER_STAKE` | 0.1 ETH | Minimum stake to become a relayer |
| `CHALLENGE_WINDOW` | 300 seconds | Fraud-proof window after delivery claim |
| `MAX_FEE` | 0.01 ETH | Maximum fee per message |

---

## ArbiLinkReceiver (Destination Chains)

Solidity contract deployed on each destination chain. Receives and executes messages.

**Language:** Solidity ^0.8.20
**Deployed on:** Ethereum Sepolia, Base Sepolia

### Key Functions

#### `receiveMessage`
```solidity
function receiveMessage(
    uint256        messageId,
    address        sender,
    bytes calldata data,
    address        target,
    bytes calldata executionProof
) external returns (bool success)
```

Called by relayers to deliver and execute a cross-chain message.

| Parameter | Type | Description |
|-----------|------|-------------|
| `messageId` | `uint256` | Unique message ID from MessageHub |
| `sender` | `address` | Original sender on Arbitrum |
| `data` | `bytes` | ABI-encoded call to execute on `target` |
| `target` | `address` | Contract to call |
| `executionProof` | `bytes` | ECDSA proof of valid delivery |

---

#### `isProcessed`
```solidity
function isProcessed(uint256 messageId) external view returns (bool)
```

Returns `true` if a message has already been executed (replay protection).

---

#### `getReceipt`
```solidity
function getReceipt(uint256 messageId) external view returns (
    bool    success,
    uint256 executedAt,
    address executedBy
)
```

Returns the execution receipt for a delivered message.

---

### Security

- **Relayer allowlist** — only approved relayers can call `receiveMessage`
- **Replay protection** — `processedMessages[id]` mapping prevents re-execution
- **ECDSA proof** — every delivery requires a valid signature from the MessageHub
- **CEI pattern** — effects before interactions in all state-changing functions

---

## Deployed Addresses

| Contract | Chain | Chain ID | Address |
|----------|-------|----------|---------|
| MessageHub | Arbitrum Sepolia | 421614 | *See deployment-info.json* |
| ArbiLinkReceiver | Ethereum Sepolia | 11155111 | *See deployment-info.json* |
| ArbiLinkReceiver | Base Sepolia | 84532 | *See deployment-info.json* |

::: tip
Run `cat deployment-info.json` after deploying with `scripts/deploy.sh` to get all addresses.
:::
