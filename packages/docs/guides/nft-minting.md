# Cross-Chain NFT Minting

Trigger NFT mints on Ethereum (or any chain) directly from an Arbitrum contract or frontend.

## Use Case

Your users hold tokens on Arbitrum. You want them to claim NFTs on Ethereum — without leaving Arbitrum, paying Ethereum gas, or managing two separate wallets.

## 1 — The NFT Contract (Ethereum Sepolia)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CrossChainNFT is ERC721, Ownable {
    address public immutable arbiLinkReceiver;
    uint256 private _tokenIdCounter;

    event CrossChainMint(address indexed to, uint256 tokenId, uint256 fromChain);

    constructor(address _receiver) ERC721("CrossChainNFT", "CCNFT") Ownable(msg.sender) {
        arbiLinkReceiver = _receiver;
    }

    /**
     * @dev Called by ArbiLinkReceiver on cross-chain mint
     */
    function mintCrossChain(
        address to,
        uint256 fromChain
    ) external returns (uint256 tokenId) {
        require(msg.sender == arbiLinkReceiver, "Only ArbiLinkReceiver");

        tokenId = ++_tokenIdCounter;
        _safeMint(to, tokenId);

        emit CrossChainMint(to, tokenId, fromChain);
    }
}
```

::: tip
The `arbiLinkReceiver` guard is the only security check you need. ArbiLink already verifies the message came from Arbitrum before calling your contract.
:::

## 2 — Deploy on Ethereum Sepolia

```bash
forge create CrossChainNFT \
  --rpc-url https://rpc.sepolia.org \
  --private-key $PRIVATE_KEY \
  --constructor-args $ARBILINK_RECEIVER_SEPOLIA
```

## 3 — Send the Mint Message from Arbitrum

```typescript
import { ArbiLink }           from '@arbilink/sdk';
import { encodeFunctionData } from 'viem';
import { ethers }             from 'ethers';

const CROSS_CHAIN_NFT = '0xYourNFTAddress';
const ETHEREUM_SEPOLIA = 11155111;

async function mintNFTOnEthereum(
  arbiLink: ArbiLink,
  recipient: string,
) {
  const data = encodeFunctionData({
    abi: [{
      name:    'mintCrossChain',
      type:    'function',
      inputs:  [
        { name: 'to',        type: 'address' },
        { name: 'fromChain', type: 'uint256' },
      ],
    }],
    functionName: 'mintCrossChain',
    args: [recipient as `0x${string}`, BigInt(421614)],
  });

  const messageId = await arbiLink.sendMessage({
    chainId: ETHEREUM_SEPOLIA,
    target:  CROSS_CHAIN_NFT,
    data,
  });

  return messageId;
}
```

## 4 — Track & Confirm Mint

```typescript
const messageId = await mintNFTOnEthereum(arbiLink, userAddress);

const unsubscribe = arbiLink.watchMessage(messageId, (msg) => {
  if (msg.status === 'confirmed') {
    console.log('✅ NFT minted on Ethereum!');

    // Query the new token ID from the NFT contract
    const nftContract = new ethers.Contract(
      CROSS_CHAIN_NFT,
      ['event CrossChainMint(address indexed to, uint256 tokenId, uint256 fromChain)'],
      ethProvider,
    );

    unsubscribe();
  }
});
```

## React Hook Example

```typescript
import { useState, useCallback } from 'react';
import { useArbiLink }           from './useArbiLink';
import { mintNFTOnEthereum }     from './mint';

export function useCrossChainMint() {
  const { arbiLink } = useArbiLink();
  const [status, setStatus] = useState<string>('idle');
  const [tokenId, setTokenId] = useState<bigint | null>(null);

  const mint = useCallback(async (recipient: string) => {
    if (!arbiLink) return;

    setStatus('sending');
    const messageId = await mintNFTOnEthereum(arbiLink, recipient);

    setStatus('pending');

    const unsub = arbiLink.watchMessage(messageId, (msg) => {
      setStatus(msg.status);
      if (msg.status === 'confirmed') {
        unsub();
      }
    });
  }, [arbiLink]);

  return { mint, status, tokenId };
}
```

## Gas Comparison

| Approach | Gas (approx) | Cost (approx) |
|---------|-------------|---------------|
| Direct Ethereum mint | 80,000 gas | $4.00 |
| Bridge + Ethereum mint | 200,000 gas | $12.00 |
| **ArbiLink from Arbitrum** | **5,000 gas** | **$0.23** |
