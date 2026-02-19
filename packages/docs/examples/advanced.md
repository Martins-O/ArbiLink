# Advanced Examples

Batch messages, relayer operations, and contract-to-contract patterns.

## 1 — Batch Cross-Chain Messages

Send multiple messages in one go and track all of them:

```typescript
import { ArbiLink }           from '@arbilink/sdk';
import { encodeFunctionData } from 'viem';

interface BatchItem {
  chainId: number;
  target:  string;
  fnName:  string;
  args:    unknown[];
  abi:     any[];
}

async function sendBatch(arbiLink: ArbiLink, items: BatchItem[]) {
  // Fire all sends in parallel
  const ids = await Promise.all(
    items.map(({ chainId, target, fnName, args, abi }) =>
      arbiLink.sendMessage({
        chainId,
        target,
        data: encodeFunctionData({ abi, functionName: fnName, args }),
      })
    )
  );

  console.log(`Sent ${ids.length} messages:`, ids.map(String));

  // Track all in parallel
  const results = await Promise.allSettled(
    ids.map(id =>
      new Promise<void>((resolve, reject) => {
        const unsub = arbiLink.watchMessage(id, (msg) => {
          if (msg.status === 'confirmed') { unsub(); resolve(); }
          if (msg.status === 'failed')    { unsub(); reject(new Error(`#${id} failed`)); }
        });
        setTimeout(() => { unsub(); reject(new Error(`#${id} timed out`)); }, 120_000);
      })
    )
  );

  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed    = results.filter(r => r.status === 'rejected').length;
  console.log(`Batch complete — ${succeeded} succeeded, ${failed} failed`);
  return results;
}
```

## 2 — Relayer Registration

Become a relayer and earn fees for delivering messages:

```typescript
import { ArbiLink }        from '@arbilink/sdk';
import { Wallet, parseEther, JsonRpcProvider } from 'ethers';

async function registerAsRelayer() {
  const provider = new JsonRpcProvider('https://sepolia-rollup.arbitrum.io/rpc');
  const signer   = new Wallet(process.env.PRIVATE_KEY!, provider);
  const arbiLink = new ArbiLink(signer);

  const address = await signer.getAddress();
  const isActive = await arbiLink.isActiveRelayer(address);

  if (isActive) {
    console.log('Already a registered relayer');
    return;
  }

  // Register with default stake (0.1 ETH)
  await arbiLink.registerRelayer();
  console.log(`✅ Registered as relayer — ${address}`);

  // Or with custom stake
  // await arbiLink.registerRelayer(parseEther('0.5'));
}

async function exitAsRelayer() {
  const arbiLink = new ArbiLink(signer);
  await arbiLink.exitRelayer();
  console.log('Deregistered — stake returning after cooldown');
}
```

## 3 — Contract-to-Contract (Solidity → ArbiLink)

Call ArbiLink from another Solidity contract on Arbitrum:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IMessageHub {
    function send_message(
        uint256 chainId,
        address target,
        bytes calldata data
    ) external payable returns (uint256 messageId);

    function get_fee(uint256 chainId) external view returns (uint256);
}

contract AutomatedBridge {
    IMessageHub public immutable hub;

    event BridgeTriggered(uint256 indexed messageId, uint256 chainId);

    constructor(address _hub) {
        hub = IMessageHub(_hub);
    }

    /**
     * @dev Called by Chainlink Automation / Gelato when conditions are met.
     */
    function executeWhenReady(
        uint256 destinationChain,
        address target,
        bytes calldata callData
    ) external {
        uint256 fee = hub.get_fee(destinationChain);

        uint256 messageId = hub.send_message{value: fee}(
            destinationChain,
            target,
            callData
        );

        emit BridgeTriggered(messageId, destinationChain);
    }

    receive() external payable {}
}
```

## 4 — Message History Indexer

Build an off-chain index of all messages sent:

```typescript
import { ethers }   from 'ethers';
import { ArbiLink, MESSAGE_HUB_ADDRESS } from '@arbilink/sdk';

const MESSAGE_HUB_ABI = [
  'event MessageSent(uint256 indexed id, address indexed sender, uint256 chainId, address target)',
];

async function indexMessages(fromBlock = 0) {
  const provider = new ethers.JsonRpcProvider('https://sepolia-rollup.arbitrum.io/rpc');
  const hub      = new ethers.Contract(MESSAGE_HUB_ADDRESS, MESSAGE_HUB_ABI, provider);

  const filter = hub.filters.MessageSent();
  const events = await hub.queryFilter(filter, fromBlock, 'latest');

  const messages = await Promise.all(
    events.map(async (e) => {
      const arbiLink = new ArbiLink(provider);
      const [id]     = (e as ethers.EventLog).args;
      const msg      = await arbiLink.getMessageStatus(id);
      return {
        id:        msg.id.toString(),
        sender:    msg.sender,
        chainId:   msg.destination,
        status:    msg.status,
        timestamp: Number(msg.timestamp),
      };
    })
  );

  return messages;
}

// Run
const history = await indexMessages();
console.table(history);
```

## 5 — TypeScript End-to-End Test

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { ArbiLink }                         from '@arbilink/sdk';
import { Wallet, JsonRpcProvider }          from 'ethers';
import { encodeFunctionData }               from 'viem';

describe('ArbiLink cross-chain', () => {
  let arbiLink: ArbiLink;

  beforeAll(() => {
    const provider = new JsonRpcProvider('https://sepolia-rollup.arbitrum.io/rpc');
    const signer   = new Wallet(process.env.PRIVATE_KEY!, provider);
    arbiLink = new ArbiLink(signer);
  });

  it('calculates fee for Ethereum Sepolia', async () => {
    const fee = await arbiLink.calculateFee(11155111);
    expect(fee).toBeGreaterThan(0n);
  });

  it('sends a message and gets a valid ID', async () => {
    const data = encodeFunctionData({
      abi: [{ name: 'ping', type: 'function', inputs: [] }],
      functionName: 'ping',
      args: [],
    });

    const id = await arbiLink.sendMessage({
      chainId: 11155111,
      target:  process.env.TEST_CONTRACT!,
      data,
    });

    expect(id).toBeGreaterThan(0n);
  }, 30_000);

  it('tracks message to confirmed', async () => {
    const id = /* previous message id */ 1n;

    await new Promise<void>((resolve, reject) => {
      setTimeout(() => reject(new Error('timeout')), 60_000);

      arbiLink.watchMessage(id, (msg) => {
        if (msg.status === 'confirmed') resolve();
        if (msg.status === 'failed')    reject(new Error('failed'));
      });
    });
  }, 65_000);
});
```
