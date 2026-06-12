# Smart Contracts

Reference for all ArbiLink smart contracts.

## MessageHub (Arbitrum Sepolia)

The core Rust/Stylus contract that manages messages, relayers, and chains.

**Address:** `0x9a9e7Ec4EA29bb63fE7c38E124B253b44fF897Cc`
**Chain:** Arbitrum Sepolia (421614)
**Language:** Rust (Arbitrum Stylus / WASM)

### Write Functions

#### `sendMessage`
```solidity
function sendMessage(
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

**Value:** Must be `≥ calculateFee(chainId)`. Excess is refunded.

**Reverts** with `InvalidInput` if `target` is `Address::ZERO`.

---

#### `confirmDelivery`
```solidity
function confirmDelivery(uint256 messageId) external
```

Called by relayers to record successful delivery. Only callable by registered relayers.

---

#### `challengeMessage`
```solidity
function challengeMessage(uint256 messageId) external
```

Challenge a claimed delivery. Callable by anyone during the challenge window.

---

#### `finalizeMessage`
```solidity
function finalizeMessage(uint256 messageId) external
```

Finalize a message after the challenge window. Releases relayer stake return.

---

#### `registerRelayer`
```solidity
function registerRelayer() external payable
```

Register as a relayer. Must send `≥ minStake()`.

---

#### `exitRelayer`
```solidity
function exitRelayer() external
```

Deregister as a relayer. Stake is returned.

---

#### `addChain`
```solidity
function addChain(uint256 chainId, address receiver, uint256 fee) external
```

Owner-only. Register a new destination chain.

---

#### `removeChain`
```solidity
function removeChain(uint256 chainId) external
```

Owner-only. Disable a destination chain. Emits `ChainRemoved`.

---

#### `setMinStake`
```solidity
function setMinStake(uint256 newStake) external
```

Owner-only. Update the minimum relayer stake. Emits `MinStakeUpdated`.

---

#### `setChallengePeriod`
```solidity
function setChallengePeriod(uint256 newPeriod) external
```

Owner-only. Update the fraud-proof challenge window duration. Emits `ChallengePeriodUpdated`.

---

#### `transferOwnership`
```solidity
function transferOwnership(address newOwner) external
```

Owner-only. Initiates transfer to a new owner. Emits `OwnershipTransferStarted`.

---

#### `acceptOwnership`
```solidity
function acceptOwnership() external
```

Pending owner completes the ownership transfer. Emits `OwnershipTransferred`.

---

#### `withdrawProtocolFees`
```solidity
function withdrawProtocolFees() external
```

Owner-only. Withdraw accumulated protocol fees.

---

### Read Functions

#### `calculateFee`
```solidity
function calculateFee(uint256 chainId) external view returns (uint256)
```

Returns the current fee in wei to send to `chainId`.

---

#### `getMessage`
```solidity
function getMessage(uint256 messageId) external view returns (
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

#### `getMessageStatus`
```solidity
function getMessageStatus(uint256 messageId) external view returns (uint8)
```

Returns the numeric status code (`0`=Pending, `1`=Relayed, `2`=Confirmed, `3`=Failed).

---

#### `messageCount`
```solidity
function messageCount() external view returns (uint256)
```

Total messages sent through the hub.

---

#### `owner`
```solidity
function owner() external view returns (address)
```

---

#### `pendingOwner`
```solidity
function pendingOwner() external view returns (address)
```

---

#### `minStake`
```solidity
function minStake() external view returns (uint256)
```

Minimum stake in wei required to register as a relayer.

---

#### `challengePeriod`
```solidity
function challengePeriod() external view returns (uint256)
```

Challenge window duration in seconds.

---

#### `isActiveRelayer`
```solidity
function isActiveRelayer(address relayer) external view returns (bool)
```

---

#### `getRelayerInfo`
```solidity
function getRelayerInfo(address relayer) external view returns (
    bool    active,
    uint256 stake,
    uint256 successfulDeliveries
)
```

---

### Events

See the [Events](/api/events) page for the full event reference.

---

## ArbiLinkReceiver (Destination Chains)

Solidity contract deployed on each destination chain. Receives and executes messages.

**Language:** Solidity ^0.8.20
**Deployed on:** Ethereum Sepolia, Base Sepolia, Polygon Amoy

### Write Functions

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

**Gas bound:** Target call gas is capped at `MAX_CALL_GAS` (100,000).

---

#### `pause`
```solidity
function pause() external
```

Owner-only. Emergency stop — prevents `receiveMessage` from executing. Emits `ContractPaused`.

---

#### `unpause`
```solidity
function unpause() external
```

Owner-only. Resume message execution after a pause. Emits `ContractUnpaused`.

---

#### `setMessageHub`
```solidity
function setMessageHub(address newHub) external
```

Owner-only. Update the authoritative MessageHub address used for ECDSA proof verification.

---

#### `transferOwnership`
```solidity
function transferOwnership(address newOwner) external
```

Owner-only. Initiates two-step ownership transfer.

---

#### `acceptOwnership`
```solidity
function acceptOwnership() external
```

Pending owner completes the ownership transfer.

---

### Read Functions

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

#### `messageHub`
```solidity
function messageHub() external view returns (address)
```

The authoritative MessageHub address used for ECDSA proof verification.

---

#### `paused`
```solidity
function paused() external view returns (bool)
```

---

#### `owner`
```solidity
function owner() external view returns (address)
```

---

#### `pendingOwner`
```solidity
function pendingOwner() external view returns (address)
```

---

### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `MAX_CALL_GAS` | 100,000 | Max gas forwarded to the target contract call |

### Security

- **Stake-based relayer network** — only registered, staked relayers can call `receiveMessage`
- **Replay protection** — `processedMessages[id]` mapping prevents re-execution
- **ECDSA proof** — every delivery requires a valid signature verifiable to the MessageHub address
- **Pausable** — owner can emergency-stop message execution
- **CEI pattern** — effects before interactions in all state-changing functions
- **Gas bound** — target calls are limited to `MAX_CALL_GAS` to prevent DoS

---

## Deployed Addresses

| Contract | Chain | Chain ID | Address |
|----------|-------|----------|---------|
| MessageHub | Arbitrum Sepolia | 421614 | [`0x9a9e7Ec4EA29bb63fE7c38E124B253b44fF897Cc`](https://sepolia.arbiscan.io/address/0x9a9e7Ec4EA29bb63fE7c38E124B253b44fF897Cc) |
| ArbiLinkReceiver | Ethereum Sepolia | 11155111 | [`0x895058E57bBE8c84C2AABA5d61c4C739C5869F71`](https://sepolia.etherscan.io/address/0x895058E57bBE8c84C2AABA5d61c4C739C5869F71) |
| ArbiLinkReceiver | Base Sepolia | 84532 | [`0xD45efE42904C9a27630A548A1FB6d9F133Cf5D35`](https://sepolia.basescan.org/address/0xD45efE42904C9a27630A548A1FB6d9F133Cf5D35) |
| ArbiLinkReceiver | Polygon Amoy | 80002 | [`0x221B7Cca1C385C6c81e17b086C753328AF41AAAa`](https://amoy.polygonscan.com/address/0x221B7Cca1C385C6c81e17b086C753328AF41AAAa) |

::: tip
Run `cat deployment-info.json` after deploying with `scripts/deploy.sh` to get all addresses.
:::
