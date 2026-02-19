# Cross-Chain DAO Voting

Allow Arbitrum users to vote in Ethereum-based governance systems — without bridging or leaving Arbitrum.

## Use Case

Your DAO governance contract lives on Ethereum. Your community's liquidity (and token holders) are mostly on Arbitrum. ArbiLink lets them participate without expensive Ethereum gas.

## Governance Contract (Ethereum)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CrossChainGovernor {
    address public immutable arbiLinkReceiver;

    enum VoteType { Against, For, Abstain }

    struct Proposal {
        uint256 id;
        string  description;
        uint256 deadline;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        bool    executed;
    }

    mapping(uint256 => Proposal)           public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    uint256 public proposalCount;

    event ProposalCreated(uint256 indexed id, string description, uint256 deadline);
    event VoteCast(uint256 indexed proposalId, address indexed voter, VoteType vote, uint256 fromChain);

    constructor(address _receiver) {
        arbiLinkReceiver = _receiver;
    }

    function createProposal(string calldata description, uint256 duration) external returns (uint256) {
        uint256 id = ++proposalCount;
        proposals[id] = Proposal(id, description, block.timestamp + duration, 0, 0, 0, false);
        emit ProposalCreated(id, description, block.timestamp + duration);
        return id;
    }

    /**
     * @dev Called by ArbiLinkReceiver — voter verified on Arbitrum side.
     */
    function castVoteCrossChain(
        uint256  proposalId,
        address  voter,
        VoteType vote,
        uint256  fromChain
    ) external {
        require(msg.sender == arbiLinkReceiver, "Unauthorized");
        require(!hasVoted[proposalId][voter], "Already voted");
        require(block.timestamp < proposals[proposalId].deadline, "Voting ended");

        hasVoted[proposalId][voter] = true;

        if (vote == VoteType.For)          proposals[proposalId].forVotes++;
        else if (vote == VoteType.Against) proposals[proposalId].againstVotes++;
        else                               proposals[proposalId].abstainVotes++;

        emit VoteCast(proposalId, voter, vote, fromChain);
    }
}
```

## Voting from Arbitrum

```typescript
import { ArbiLink }           from '@arbilink/sdk';
import { encodeFunctionData } from 'viem';

const GOVERNOR_ON_ETHEREUM = '0xYourGovernorAddress';
const ETHEREUM_SEPOLIA     = 11155111;

enum VoteType { Against = 0, For = 1, Abstain = 2 }

async function voteOnProposal(
  arbiLink:   ArbiLink,
  proposalId: bigint,
  voter:      string,
  vote:       VoteType,
) {
  const data = encodeFunctionData({
    abi: [{
      name:   'castVoteCrossChain',
      type:   'function',
      inputs: [
        { name: 'proposalId', type: 'uint256' },
        { name: 'voter',      type: 'address' },
        { name: 'vote',       type: 'uint8'   },
        { name: 'fromChain',  type: 'uint256' },
      ],
    }],
    functionName: 'castVoteCrossChain',
    args: [proposalId, voter as `0x${string}`, vote, 421614n],
  });

  const messageId = await arbiLink.sendMessage({
    chainId: ETHEREUM_SEPOLIA,
    target:  GOVERNOR_ON_ETHEREUM,
    data,
  });

  return messageId;
}
```

## React Voting UI

```typescript
import { useState }    from 'react';
import { useArbiLink } from './useArbiLink';

export function VoteButton({ proposalId }: { proposalId: bigint }) {
  const { arbiLink, isConnected } = useArbiLink();
  const [status, setStatus]       = useState<string>('');

  async function handleVote(vote: VoteType) {
    if (!arbiLink || !isConnected) return;

    const address   = await (arbiLink as any).signer.getAddress();
    const messageId = await voteOnProposal(arbiLink, proposalId, address, vote);

    setStatus('Vote sent — waiting for confirmation…');

    arbiLink.watchMessage(messageId, (msg) => {
      if (msg.status === 'confirmed') {
        setStatus('Vote confirmed on Ethereum!');
      }
    });
  }

  return (
    <div>
      <button onClick={() => handleVote(VoteType.For)}>Vote For</button>
      <button onClick={() => handleVote(VoteType.Against)}>Vote Against</button>
      <button onClick={() => handleVote(VoteType.Abstain)}>Abstain</button>
      {status && <p>{status}</p>}
    </div>
  );
}
```

## UX Benefit

| Approach | User Experience |
|----------|----------------|
| Native Ethereum voting | Switch network → pay ETH gas → wait 15s |
| Snapshot (off-chain) | No on-chain execution, just signalling |
| **ArbiLink from Arbitrum** | Stay on Arbitrum → pay $0.23 → vote confirmed on Ethereum |
