# Events

All events emitted by ArbiLink contracts.

## MessageHub Events (Arbitrum Sepolia)

### `MessageSent`

Emitted when a new cross-chain message is created.

```solidity
event MessageSent(
    uint256 indexed messageId,
    address indexed sender,
    uint256         chainId,
    address         target,
    uint256         fee,
    uint256         timestamp
);
```

**Listen with ethers v6:**
```typescript
import { ethers }                        from 'ethers';
import { MESSAGE_HUB_ADDRESS }           from '@arbilink/sdk';

const provider = new ethers.JsonRpcProvider('https://sepolia-rollup.arbitrum.io/rpc');
const hub = new ethers.Contract(
  MESSAGE_HUB_ADDRESS,
  ['event MessageSent(uint256 indexed messageId, address indexed sender, uint256 chainId, address target, uint256 fee, uint256 timestamp)'],
  provider,
);

hub.on('MessageSent', (messageId, sender, chainId, target, fee, ts) => {
  console.log(`New message #${messageId} from ${sender} → chain ${chainId}`);
});

// Stop listening
// hub.off('MessageSent', handler);
```

---

### `MessageConfirmed`

Emitted when a relayer claims successful delivery.

```solidity
event MessageConfirmed(
    uint256 indexed messageId,
    address indexed relayer,
    uint256         timestamp
);
```

---

### `MessageChallenged`

Emitted when a delivery claim is disputed.

```solidity
event MessageChallenged(
    uint256 indexed messageId,
    address indexed challenger,
    uint256         deadline
);
```

---

### `MessageFinalized`

Emitted when the challenge window closes and delivery is final.

```solidity
event MessageFinalized(
    uint256 indexed messageId,
    bool            success
);
```

---

### `RelayerRegistered`

```solidity
event RelayerRegistered(address indexed relayer, uint256 stake);
```

---

### `RelayerExited`

```solidity
event RelayerExited(address indexed relayer, uint256 stakeReturned);
```

---

### `RelayerSlashed`

```solidity
event RelayerSlashed(address indexed relayer, uint256 slashAmount, uint256 messageId);
```

---

### `ChainAdded`

```solidity
event ChainAdded(uint256 indexed chainId, address receiver, uint256 fee);
```

---

## ArbiLinkReceiver Events (Destination Chains)

### `MessageReceived`

Emitted on successful message execution on the destination chain.

```solidity
event MessageReceived(
    uint256 indexed messageId,
    address indexed sender,
    address indexed target,
    bool            success
);
```

---

### `MessageAlreadyProcessed`

Emitted when a duplicate delivery is attempted (replay protection).

```solidity
event MessageAlreadyProcessed(uint256 indexed messageId);
```

---

## Listening for Events Across Chains

```typescript
import { ethers }               from 'ethers';
import { RECEIVER_ADDRESSES }   from '@arbilink/sdk';

const ETHEREUM_SEPOLIA = 11155111;

const ethProvider = new ethers.JsonRpcProvider('https://rpc.sepolia.org');
const receiver = new ethers.Contract(
  RECEIVER_ADDRESSES[ETHEREUM_SEPOLIA],
  ['event MessageReceived(uint256 indexed messageId, address indexed sender, address indexed target, bool success)'],
  ethProvider,
);

receiver.on('MessageReceived', (messageId, sender, target, success) => {
  console.log(`[Ethereum] Message #${messageId} executed — success: ${success}`);
});
```

## Querying Historical Events

```typescript
// Get all messages sent in the last 1000 blocks
const currentBlock = await provider.getBlockNumber();
const events = await hub.queryFilter(
  hub.filters.MessageSent(),
  currentBlock - 1000,
  currentBlock,
);

console.log(`Found ${events.length} messages in the last 1000 blocks`);
```
