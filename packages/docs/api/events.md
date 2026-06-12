# Events

All events emitted by ArbiLink contracts.

## MessageHub Events (Arbitrum Sepolia)

### `MessageSent`

Emitted when a new cross-chain message is created.

```solidity
event MessageSent(
    uint256 indexed messageId,
    address indexed sender,
    uint256         destinationChain,
    address         target,
    bytes           data,
    uint256         fee,
    uint256         timestamp
);
```

### `MessageRelayed`

Emitted when a relayer claims successful delivery on the destination chain.

```solidity
event MessageRelayed(
    uint256 indexed messageId,
    address indexed relayer
);
```

### `MessageConfirmed`

Emitted after the challenge window closes and delivery is finalized.

```solidity
event MessageConfirmed(
    uint256 indexed messageId,
    address indexed relayer,
    uint256         timestamp
);
```

### `MessageChallenged`

Emitted when a delivery claim is disputed.

```solidity
event MessageChallenged(
    uint256 indexed messageId,
    address indexed challenger,
    uint256         deadline
);
```

### `MessageFinalized`

Emitted when the challenge window closes (success or failure).

```solidity
event MessageFinalized(
    uint256 indexed messageId,
    bool            success
);
```

### `RelayerRegistered`

```solidity
event RelayerRegistered(address indexed relayer, uint256 stake);
```

### `RelayerExited`

```solidity
event RelayerExited(address indexed relayer, uint256 stakeReturned);
```

### `RelayerSlashed`

```solidity
event RelayerSlashed(address indexed relayer, uint256 slashAmount, uint256 messageId);
```

### `ChainAdded`

```solidity
event ChainAdded(uint256 indexed chainId, address receiver, uint256 fee);
```

### `ChainRemoved`

```solidity
event ChainRemoved(uint256 indexed chainId);
```

### `Initialized`

Emitted when the hub contract is initialized (UUPS proxy pattern).

```solidity
event Initialized(uint64 version);
```

### `OwnershipTransferStarted`

```solidity
event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
```

### `OwnershipTransferred`

```solidity
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
```

### `MinStakeUpdated`

```solidity
event MinStakeUpdated(uint256 oldStake, uint256 newStake);
```

### `ChallengePeriodUpdated`

```solidity
event ChallengePeriodUpdated(uint256 oldPeriod, uint256 newPeriod);
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

### `MessageAlreadyProcessed`

Emitted when a duplicate delivery is attempted (replay protection).

```solidity
event MessageAlreadyProcessed(uint256 indexed messageId);
```

### `ContractPaused`

Emitted when the receiver is emergency-stopped.

```solidity
event ContractPaused();
```

### `ContractUnpaused`

Emitted when the receiver resumes operation.

```solidity
event ContractUnpaused();
```

### `MessageHubUpdated`

Emitted when the authoritative MessageHub address is changed.

```solidity
event MessageHubUpdated(address indexed oldHub, address indexed newHub);
```

### `OwnershipTransferStarted`

```solidity
event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
```

### `OwnershipTransferred`

```solidity
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
```

---

## Listening for Events

### Relayer Events on the Hub

```typescript
import { ethers }             from 'ethers';
import { MESSAGE_HUB_ADDRESS } from '@arbilink/sdk';
import { MessageHubABI }       from '@arbilink/sdk';

const provider = new ethers.JsonRpcProvider('https://sepolia-rollup.arbitrum.io/rpc');
const hub = new ethers.Contract(MESSAGE_HUB_ADDRESS, MessageHubABI, provider);

// Listen for new messages
hub.on('MessageSent', (messageId, sender, chainId, target, data, fee, ts) => {
  console.log(`New message #${messageId} from ${sender} → chain ${chainId}`);
});

// Listen for confirmations
hub.on('MessageConfirmed', (messageId, relayer, timestamp) => {
  console.log(`Message #${messageId} confirmed by relayer ${relayer}`);
});

// Stop listening
// hub.off('MessageSent', handler);
```

### Delivery Events on Destination

```typescript
import { ethers }             from 'ethers';
import { RECEIVER_ADDRESSES } from '@arbilink/sdk';
import { ReceiverABI }         from '@arbilink/sdk';

const ETHEREUM_SEPOLIA = 11155111;

const ethProvider = new ethers.JsonRpcProvider('https://rpc.sepolia.org');
const receiver = new ethers.Contract(
  RECEIVER_ADDRESSES[ETHEREUM_SEPOLIA],
  ReceiverABI,
  ethProvider,
);

receiver.on('MessageReceived', (messageId, sender, target, success) => {
  console.log(`[Ethereum] Message #${messageId} executed — success: ${success}`);
});
```

### Querying Historical Events

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
