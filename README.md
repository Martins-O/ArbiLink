# ArbiLink — Cross-Chain Messaging on Arbitrum Stylus

> Send a message from Arbitrum to any EVM chain with a single function call.

ArbiLink is a trustless, optimistic cross-chain messaging protocol built on **Arbitrum Stylus**. It allows any smart contract or dApp on Arbitrum to trigger function calls on Ethereum, Base, Polygon, Optimism, or any registered EVM destination — without bridges, wrapped tokens, or lock-and-mint mechanisms.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [How It Works](#how-it-works)
- [Repository Structure](#repository-structure)
- [Components](#components)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Deployment Guide](#deployment-guide)
- [SDK Integration](#sdk-integration)
- [Contract Reference](#contract-reference)
- [Testing](#testing)
- [Security Model](#security-model)
- [Environment Variables](#environment-variables)
- [License](#license)

---

## Live Testnet Deployment

| Contract | Chain | Address |
|----------|-------|---------|
| MessageHub | Arbitrum Sepolia | [`0x9a9e7Ec4EA29bb63fE7c38E124B253b44fF897Cc`](https://sepolia.arbiscan.io/address/0x9a9e7Ec4EA29bb63fE7c38E124B253b44fF897Cc) |
| ArbiLinkReceiver | Base Sepolia | [`0xD45efE42904C9a27630A548A1FB6d9F133Cf5D35`](https://sepolia.basescan.org/address/0xD45efE42904C9a27630A548A1FB6d9F133Cf5D35) |
| ArbiLinkReceiver | Ethereum Sepolia | [`0x895058E57bBE8c84C2AABA5d61c4C739C5869F71`](https://sepolia.etherscan.io/address/0x895058E57bBE8c84C2AABA5d61c4C739C5869F71) |
| ArbiLinkReceiver | Polygon Amoy | [`0x221B7Cca1C385C6c81e17b086C753328AF41AAAa`](https://amoy.polygonscan.com/address/0x221B7Cca1C385C6c81e17b086C753328AF41AAAa) |

> Messages delivered on testnet: 3+ (Base Sepolia ×2, Ethereum Sepolia ×1)

---

## Overview

ArbiLink solves a simple but critical problem: **smart contracts on different chains cannot talk to each other natively**. ArbiLink provides the plumbing:

- A **MessageHub** contract lives on Arbitrum Sepolia, written in Rust using the [Stylus SDK](https://docs.arbitrum.io/stylus/stylus-gentle-introduction). It accepts outbound messages, collects fees, and manages a network of staked relayers.
- An **ArbiLinkReceiver** contract lives on each destination chain (Ethereum, Base, etc.), written in Solidity. It verifies ECDSA-signed execution proofs from the hub and executes arbitrary calls on behalf of the original sender.
- An **off-chain relayer network** watches for `MessageSent` events on Arbitrum, delivers messages to destination chains, and submits execution proofs back to the hub.
- A **TypeScript SDK** (`@arbilink/sdk`) wraps the entire flow into a single `sendMessage()` call for dApp developers.

---

## Architecture

```
  ┌──────────────────────────────────────────────────────────────────────┐
  │                        ARBITRUM SEPOLIA (chain 421614)               │
  │                                                                      │
  │   dApp / User Wallet                                                 │
  │        │                                                             │
  │        │  sendMessage(destinationChain, target, data)  +fee          │
  │        ▼                                                             │
  │  ┌─────────────────────────────────────────────────────┐            │
  │  │               MessageHub (Stylus / Rust)            │            │
  │  │                                                     │            │
  │  │  • Assigns unique message ID                        │            │
  │  │  • Stores message on-chain                          │            │
  │  │  • Emits MessageSent event                          │            │
  │  │  • Manages relayer stakes                           │            │
  │  │  • Runs 5-min challenge window on delivery          │            │
  │  └─────────────────────────────────────────────────────┘            │
  │        │ MessageSent event                                           │
  └────────┼─────────────────────────────────────────────────────────────┘
           │
           │  Off-chain relayer watches events
           ▼
  ┌─────────────────────┐
  │   Relayer Network   │
  │                     │
  │  1. Reads event     │
  │  2. Calls receiver  │
  │  3. Gets proof      │
  │  4. Calls hub back  │
  └──────┬──────────────┘
         │                              │
         │  receiveMessage(msg, proof)  │  confirm_delivery(id, proof)
         ▼                              ▼
  ┌──────────────────────────┐    ┌─────────────┐
  │  ArbiLinkReceiver        │    │ MessageHub  │
  │  (Solidity — dest chain) │    │  (Arbitrum) │
  │                          │    │             │
  │  • Verifies ECDSA proof  │    │  • Opens    │
  │  • Checks replay map     │    │    5-min    │
  │  • Executes target.call  │    │    window   │
  │  • Stores receipt        │    │  • Pays     │
  └──────────────────────────┘    │    relayer  │
                                  └─────────────┘
  Supported destination chains:
    • Ethereum Sepolia  (11155111)
    • Base Sepolia      (84532)
```

---

## How It Works

### Step 1 — Send (Arbitrum)
A user or contract calls `send_message(destinationChain, target, data)` on the **MessageHub**, paying a small fee. The hub assigns an incrementing message ID, stores the message, and emits a `MessageSent` event.

### Step 2 — Relay (Off-chain)
A **relayer** (any staked party) picks up the `MessageSent` event, calls `receiveMessage()` on the destination chain's **ArbiLinkReceiver**, and waits for on-chain confirmation.

### Step 3 — Execute (Destination Chain)
The **ArbiLinkReceiver** verifies the ECDSA execution proof signed by the hub's signing key, checks that the message hasn't been replayed, then performs `target.call(data)` — executing the requested function on behalf of the original sender. A receipt is stored on-chain.

### Step 4 — Confirm (Arbitrum)
The relayer calls `confirm_delivery()` on the **MessageHub**, submitting the execution proof. The hub opens a **5-minute challenge window** and immediately pays 80% of the fee to the relayer.

### Step 5 — Challenge (Optional, Arbitrum)
Anyone who can prove the message was NOT executed (or was executed fraudulently) calls `challenge_message()` with a fraud proof during the window. A valid challenge **slashes the relayer's full stake** — 10% goes to the challenger, the rest to the protocol treasury.

### Step 6 — Finalize (Arbitrum)
After the challenge window closes without a successful challenge, `finalize_message()` marks the message as **confirmed** and increments the relayer's success count.

---

## Repository Structure

```
arbilink/
├── message-hub/                  # Arbitrum Stylus contract (Rust)
│   ├── src/
│   │   ├── lib.rs                # MessageHub contract logic
│   │   └── main.rs               # WASM entry point
│   ├── Cargo.toml
│   ├── Stylus.toml
│   └── rust-toolchain.toml       # Pinned to Rust 1.88.0
│
├── contracts/
│   └── receiver/                 # Destination-chain contracts (Solidity)
│       ├── src/
│       │   ├── ArbiLinkReceiver.sol  # Main receiver contract
│       │   └── ECDSA.sol             # Minimal signature recovery library
│       ├── test/
│       │   └── ArbiLinkReceiver.t.sol  # 18-test Foundry suite
│       └── foundry.toml
│
├── packages/
│   ├── sdk/                      # TypeScript SDK (@arbilink/sdk)
│   │   ├── src/
│   │   │   ├── ArbiLink.ts       # Main SDK class
│   │   │   ├── types.ts          # TypeScript types
│   │   │   ├── constants.ts      # Chain configs & addresses
│   │   │   ├── utils.ts          # Encoding & formatting helpers
│   │   │   ├── index.ts          # Public exports
│   │   │   └── abi/
│   │   │       ├── MessageHub.json   # Hub ABI
│   │   │       └── Receiver.json     # Receiver ABI
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── relayer/                  # Off-chain relayer bot (TypeScript)
│   │   ├── src/index.ts          # Event watcher + delivery loop
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── demo/                     # Live demo dApp (React + Vite)
│   │   ├── src/
│   │   │   ├── pages/            # Home, Explorer, Send
│   │   │   ├── components/       # MessageCard, StatsCards, etc.
│   │   │   └── hooks/            # useMessages, useSendMessage
│   │   └── vercel.json           # Vercel deployment config
│   │
│   └── docs/                     # Documentation site (VitePress)
│       ├── getting-started/
│       ├── api/
│       └── .vitepress/
│
├── Dockerfile                    # Relayer container (for Railway)
├── railway.toml                  # Railway deployment config
├── scripts/
│   ├── deploy.sh                 # Full multi-chain deployment
│   └── verify.sh                 # Block explorer verification
│
├── .env.example                  # Environment variable template
└── README.md
```

---

## Components

### MessageHub — Arbitrum Stylus (Rust)

The hub is the heart of the protocol, deployed on **Arbitrum Sepolia** as a WASM smart contract via Stylus. It is the entry point for all cross-chain messages.

**Key responsibilities:**
- Accept outbound messages and assign unique IDs
- Maintain a registry of supported destination chains and their base fees
- Manage a network of staked relayers (minimum 1 ETH stake per relayer)
- Enforce the 5-minute optimistic challenge window
- Slash dishonest relayers and reward challengers
- Distribute fees: 80% to relayers on delivery, 10% to challengers on successful fraud proofs

| Function | Description |
|----------|-------------|
| `sendMessage(chain, target, data)` | Send a cross-chain message (payable) |
| `confirmDelivery(id, proof)` | Relayer confirms execution with proof |
| `challengeMessage(id, proof)` | Challenge a fraudulent delivery |
| `finalizeMessage(id)` | Finalize after challenge window |
| `registerRelayer()` | Stake ETH to become a relayer (payable) |
| `exitRelayer()` | Withdraw stake and deregister |
| `addChain(chainId, receiver, fee)` | Owner: register a destination chain |
| `calculateFee(chainId)` | View: get base fee for a destination |
| `getMessageStatus(id)` | View: 0=Pending 1=Relayed 2=Confirmed 3=Failed |

---

### ArbiLinkReceiver — Solidity

Deployed on each **destination chain** (Ethereum Sepolia, Base Sepolia, etc.). It is the on-chain executor that receives and acts on cross-chain messages.

**Key responsibilities:**
- Restrict message delivery to an authorized relayer allowlist
- Prevent replay attacks via a processed-message hash mapping
- Verify 65-byte ECDSA signatures from the hub's designated signing key
- Execute arbitrary `target.call(data)` calls on behalf of the original sender
- Store per-message receipts (executed, success, timestamp)
- Follow the Checks-Effects-Interactions (CEI) pattern for reentrancy safety

| Function | Description |
|----------|-------------|
| `receiveMessage(message, proof)` | Deliver and execute a cross-chain message |
| `setRelayer(addr, authorized)` | Owner: add or remove a relayer |
| `setHubSigningKey(newKey)` | Owner: rotate the proof signing key |
| `isProcessed(message)` | View: check replay status |
| `getReceipt(message)` | View: get execution receipt |
| `proofPayload(message)` | Pure: compute the hash that must be signed |

---

### @arbilink/sdk — TypeScript

A developer-friendly wrapper over the on-chain contracts for dApp integration.

```
npm install @arbilink/sdk ethers
```

**Exported API:**

| Export | Type | Description |
|--------|------|-------------|
| `ArbiLink` | class | Main SDK class |
| `encodeCall` | function | Encode calldata via viem |
| `formatMessageId` | function | Format ID as `#000042` |
| `formatEth` | function | Format wei as `0.001 ETH` |
| `estimateDeliveryTime` | function | Estimate delivery seconds |
| `ArbiLinkError` | class | SDK error with cause chaining |
| `SUPPORTED_CHAINS` | const | Chain configs array |
| `MessageHubABI` | const | Raw ABI array for MessageHub |
| `ReceiverABI` | const | Raw ABI array for Receiver |

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| [Rust](https://rustup.rs) | 1.88.0 (pinned) | Stylus contract compilation |
| [cargo-stylus](https://github.com/OffchainLabs/cargo-stylus) | latest | Stylus deploy & verify |
| [Foundry](https://getfoundry.sh) | latest | Solidity compile, test, deploy |
| Node.js | ≥ 22 | SDK, relayer, demo |
| pnpm | latest | SDK package manager |
| [cast](https://book.getfoundry.sh/cast/) | (part of Foundry) | Contract calls via CLI |

---

## Getting Started

### 1. Clone the repository

```bash
git clone git@github.com:Martins-O/ArbiLink.git
cd ArbiLink
git checkout indev
```

### 2. Set up environment variables

```bash
cp .env.example .env
# Fill in PRIVATE_KEY, INFURA_KEY, and API keys
```

### 3. Install the Rust toolchain

```bash
rustup toolchain install 1.88.0
rustup target add wasm32-unknown-unknown --toolchain 1.88.0
cargo install cargo-stylus
```

### 4. Install Foundry

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### 5. Install Foundry dependencies (forge-std)

```bash
cd contracts/receiver
forge install
cd ../..
```

### 6. Install SDK dependencies

```bash
cd packages/sdk
pnpm install
cd ../..
```

---

## Deployment Guide

### Full Deployment (One Command)

The deploy script handles everything — building WASM, deploying the hub, deploying receivers on all chains, and registering chains in the hub:

```bash
source .env
bash scripts/deploy.sh
```

This will:
1. Build the MessageHub WASM binary
2. Deploy MessageHub to Arbitrum Sepolia
3. Initialize hub with `minStake=1 ETH`, `challengePeriod=5min`
4. Build ArbiLinkReceiver with Foundry
5. Deploy ArbiLinkReceiver to Ethereum Sepolia
6. Deploy ArbiLinkReceiver to Base Sepolia
7. Register both chains in the MessageHub
8. Save all addresses to `deployment-info.json`

### After Deployment

Update contract addresses in the SDK:

```typescript
// packages/sdk/src/constants.ts
export const MESSAGE_HUB_ADDRESS = '0xYourHubAddress';

export const RECEIVER_ADDRESSES: Record<number, string> = {
  11155111: '0xYourEthReceiver',
  84532:    '0xYourBaseReceiver',
};
```

### Verify Contracts

```bash
source .env
bash scripts/verify.sh
```

---

## Running the Relayer

The relayer bot watches `MessageSent` events on Arbitrum Sepolia, delivers messages to destination chains, and calls `confirmDelivery` on the hub. It must run continuously for messages to progress past `pending`.

### Locally

```bash
PRIVATE_KEY=0x... INFURA_KEY=... node --experimental-strip-types packages/relayer/src/index.ts
```

### Fly.io (Recommended)

A `Dockerfile` and `fly.toml` are included at the repo root.

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Log in
flyctl auth login

# Create the app (first time only)
flyctl launch --name arbilink-relayer --no-deploy

# Set secrets
flyctl secrets set PRIVATE_KEY=0x... INFURA_KEY=your_infura_key

# Deploy
flyctl deploy
```

| Secret | Description |
|--------|-------------|
| `PRIVATE_KEY` | Relayer wallet private key (must be registered on the hub) |
| `INFURA_KEY` | Infura project ID (for Arbitrum Sepolia + Ethereum Sepolia RPC) |

The relayer registers itself on-chain automatically on first start if not already staked.

---

## SDK Integration

### Install

```bash
npm install @arbilink/sdk ethers
```

### Send a Cross-Chain Message

```typescript
import { ArbiLink, encodeCall } from '@arbilink/sdk';
import { ethers }                from 'ethers';
import { parseAbi }              from 'viem';

// Connect signer on Arbitrum Sepolia
const provider = new ethers.BrowserProvider(window.ethereum);
const signer   = await provider.getSigner();

const arbiLink = new ArbiLink(signer);

// Encode the target function call
const data = encodeCall({
  abi:          parseAbi(['function mint(address to, uint256 amount)']),
  functionName: 'mint',
  args:         ['0xRecipientAddress', 1_000n],
});

// Send the cross-chain message
const messageId = await arbiLink.sendMessage({
  to:     'ethereum',   // or 'base' | chainId number
  target: '0xNFTContractOnEthereum',
  data,
});

console.log('Message sent! ID:', messageId);
```

### Track Delivery

```typescript
// Poll current status
const msg = await arbiLink.getMessageStatus(messageId);
console.log(msg.status); // 'pending' | 'relayed' | 'confirmed' | 'failed'

// Or subscribe to live updates
const unwatch = arbiLink.watchMessage(messageId, (msg) => {
  console.log('Status update:', msg.status);
  if (msg.status === 'confirmed' || msg.status === 'failed') {
    unwatch(); // stop watching
  }
});
```

### Read-Only Mode (No Wallet)

```typescript
const provider = new ethers.JsonRpcProvider('https://sepolia-rollup.arbitrum.io/rpc');
const arbiLink  = new ArbiLink(provider);

const fee = await arbiLink.calculateFee(11155111); // wei
const msg = await arbiLink.getMessageStatus(42n);
```

---

## Contract Reference

### Message Lifecycle

```
PENDING ──► RELAYED ──► CONFIRMED
                │
                └──► FAILED  (successful challenge)
```

| Status Code | Name | Meaning |
|-------------|------|---------|
| 0 | `PENDING` | Sent but not yet delivered |
| 1 | `RELAYED` | Delivered — in 5-min challenge window |
| 2 | `CONFIRMED` | Challenge window closed, message finalized |
| 3 | `FAILED` | Relayer was slashed via fraud proof |

### Fee Distribution

| Party | Share | When |
|-------|-------|------|
| Relayer | 80% of message fee | On successful `confirm_delivery` |
| Challenger | 10% of relayer stake | On successful `challenge_message` |
| Protocol treasury | Remainder | Accumulated in hub, withdrawable by owner |

### Supported Chains (Testnet)

| Chain | Chain ID | Role |
|-------|----------|------|
| Arbitrum Sepolia | 421614 | Hub (source) |
| Ethereum Sepolia | 11155111 | Destination |
| Base Sepolia | 84532 | Destination |
| Polygon Amoy | 80002 | Destination |

---

## Testing

### Solidity (Foundry)

Run the full 18-test suite for `ArbiLinkReceiver`:

```bash
cd contracts/receiver
forge test -vv
```

Test coverage includes:
- Deployment state verification
- Successful message delivery and receipt storage
- Replay attack protection
- Invalid ECDSA signature rejection
- Non-relayer access control
- Zero-address target guard
- Target revert handling (stored as failed, not replayed)
- Admin functions: `setRelayer`, `setHubSigningKey`, `transferOwnership`
- Proof payload helpers
- Batch multi-message delivery

### SDK (TypeScript)

```bash
cd packages/sdk
pnpm type-check   # TypeScript type checking
pnpm build        # Compile to dist/
```

---

## Security Model

ArbiLink uses an **optimistic** security model — it assumes messages are delivered honestly, and relies on economic incentives to deter fraud:

- **Relayers must stake ETH** (minimum 1 ETH). A dishonest delivery results in their full stake being slashed.
- **Anyone can challenge** a delivery within the 5-minute window. Challengers are rewarded 10% of the slashed stake.
- **Replay protection** — every message hash is stored in `processedMessages` on the receiver. Replaying the same message always reverts.
- **ECDSA proof verification** — the receiver will not execute any message that isn't signed by the hub's designated signing key, preventing forgery.
- **CEI pattern** — the receiver marks a message as processed *before* making the external call, preventing reentrancy exploits.

> **Note:** The hackathon version uses simplified proof stubs in the hub (`proof.len() >= 65 && proof[0] != 0`). A production deployment would replace these with full `ecrecover` verification against the destination receiver's signing key.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in all values before running the deploy script:

```bash
# Required for deployment
PRIVATE_KEY=0x...           # Deployer/owner private key
INFURA_KEY=...              # Infura project ID (for Ethereum Sepolia RPC)

# Optional: off-chain signing key for execution proofs
# Defaults to the deployer address if not set
HUB_SIGNING_KEY=0x...

# Required for block explorer verification
ARBISCAN_API_KEY=...
ETHERSCAN_API_KEY=...
BASESCAN_API_KEY=...
```

---

## Branch Structure

| Branch | Purpose |
|--------|---------|
| `indev` | Main development branch (default) |
| `feat/message-hub` | Arbitrum Stylus hub contract |
| `feat/receiver-contract` | Solidity receiver + ECDSA library |
| `feat/receiver-tests` | Foundry test suite |
| `feat/deployment` | Deployment and verification scripts |
| `feat/sdk` | TypeScript SDK (`@arbilink/sdk`) |

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

> Built for the Arbitrum Hackathon. ArbiLink demonstrates the power of Arbitrum Stylus for building high-performance cross-chain infrastructure using Rust.
