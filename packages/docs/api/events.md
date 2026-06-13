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
    uint256         fee
);
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

### MessageSent Events on the Hub

```typescript
import { ethers }             from 'ethers';
import { MESSAGE_HUB_ADDRESS } from '@arbilink/sdk';
import { MessageHubABI }       from '@arbilink/sdk';

const provider = new ethers.JsonRpcProvider('https://sepolia-rollup.arbitrum.io/rpc');
const hub = new ethers.Contract(MESSAGE_HUB_ADDRESS, MessageHubABI, provider);

hub.on('MessageSent', (messageId, sender, chainId, target, data, fee) => {
  console.log(`New message #${messageId} from ${sender} → chain ${chainId}`);
});
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
const currentBlock = await provider.getBlockNumber();
const events = await hub.queryFilter(
  hub.filters.MessageSent(),
  currentBlock - 1000,
  currentBlock,
);

console.log(`Found ${events.length} messages in the last 1000 blocks`);
```
