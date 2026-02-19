# Cross-Chain Token Transfers

Send ERC-20 tokens from Arbitrum to any chain using ArbiLink.

## Architecture

ArbiLink doesn't move tokens between chains — it moves **instructions**. The typical pattern is:

1. Lock/burn tokens on Arbitrum
2. Send a message to the destination chain
3. The destination chain mints/releases the equivalent tokens

## Receiver Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @dev Wrapped token on destination chain.
 *      Only ArbiLinkReceiver can mint — enforcing the cross-chain supply.
 */
contract WrappedToken is ERC20 {
    address public immutable arbiLinkReceiver;

    constructor(address _receiver) ERC20("Wrapped USDC", "wUSDC") {
        arbiLinkReceiver = _receiver;
    }

    function mintCrossChain(address to, uint256 amount) external {
        require(msg.sender == arbiLinkReceiver, "Unauthorized");
        _mint(to, amount);
    }

    function burnCrossChain(address from, uint256 amount) external {
        require(msg.sender == arbiLinkReceiver, "Unauthorized");
        _burn(from, amount);
    }
}
```

## Sender Contract (Arbitrum)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IMessageHub {
    function send_message(
        uint256 chainId,
        address target,
        bytes calldata data
    ) external payable returns (uint256);
}

contract TokenBridge {
    IMessageHub public immutable hub;
    address     public immutable wrappedTokenOnBase;
    uint256     public constant  BASE_SEPOLIA = 84532;

    event TokensLocked(address indexed user, uint256 amount, uint256 messageId);

    constructor(address _hub, address _wrappedToken) {
        hub                = IMessageHub(_hub);
        wrappedTokenOnBase = _wrappedToken;
    }

    function bridgeToBase(uint256 amount) external payable {
        // 1. Lock tokens from sender
        IERC20(USDC_ADDRESS).transferFrom(msg.sender, address(this), amount);

        // 2. Encode mint call on Base
        bytes memory data = abi.encodeWithSignature(
            "mintCrossChain(address,uint256)",
            msg.sender,
            amount
        );

        // 3. Send cross-chain message
        uint256 messageId = hub.send_message{value: msg.value}(
            BASE_SEPOLIA,
            wrappedTokenOnBase,
            data
        );

        emit TokensLocked(msg.sender, amount, messageId);
    }
}
```

## SDK Usage

```typescript
import { ArbiLink }           from '@arbilink/sdk';
import { encodeFunctionData } from 'viem';
import { parseUnits }         from 'ethers';

const WRAPPED_USDC_ON_BASE = '0xYourWrappedUSDCAddress';
const BASE_SEPOLIA         = 84532;
const AMOUNT               = parseUnits('100', 6); // 100 USDC

async function bridgeTokens(arbiLink: ArbiLink, recipient: string) {
  const data = encodeFunctionData({
    abi: [{
      name:   'mintCrossChain',
      type:   'function',
      inputs: [
        { name: 'to',     type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
    }],
    functionName: 'mintCrossChain',
    args: [recipient as `0x${string}`, AMOUNT],
  });

  const messageId = await arbiLink.sendMessage({
    chainId: BASE_SEPOLIA,
    target:  WRAPPED_USDC_ON_BASE,
    data,
  });

  console.log(`Bridging 100 USDC to Base Sepolia — message #${messageId}`);
  return messageId;
}
```

## Full Round-Trip (Arbitrum → Base → Arbitrum)

```typescript
// 1. Bridge Arbitrum → Base
const toBase = await bridgeTokens(arbiLink, user);
await waitForConfirmed(arbiLink, toBase);
console.log('100 USDC now on Base');

// 2. Do something on Base
// ... use the tokens on Base ...

// 3. Bridge back Base → Arbitrum (reverse message)
const toArbitrum = await bridgeTokens(baseArbiLink, user);
await waitForConfirmed(baseArbiLink, toArbitrum);
console.log('100 USDC back on Arbitrum');

async function waitForConfirmed(arbiLink: ArbiLink, messageId: bigint) {
  return new Promise<void>((resolve, reject) => {
    const unsub = arbiLink.watchMessage(messageId, (msg) => {
      if (msg.status === 'confirmed') { unsub(); resolve(); }
      if (msg.status === 'failed')    { unsub(); reject(new Error('Delivery failed')); }
    });
  });
}
```
