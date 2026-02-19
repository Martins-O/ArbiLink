# Introduction

ArbiLink is a **universal cross-chain messaging protocol** that makes Arbitrum the hub for multi-chain communication. Instead of deploying your dApp on every chain and managing separate bridges, you deploy once on Arbitrum and reach users everywhere.

## The Problem

Cross-chain development today is fragmented and expensive:

- You need separate deployments on Ethereum, Base, Polygon, Optimism…
- Each chain requires its own bridge integration with different APIs
- Security audits multiply — one per chain
- Gas costs are high: $4.50+ per message on existing bridges
- Development takes weeks per chain

## The ArbiLink Solution

```
One Arbitrum contract → One SDK call → Any chain
```

ArbiLink provides:

- **Single integration point** on Arbitrum Sepolia
- **$0.23/message** via Arbitrum Stylus efficiency
- **~12 second delivery** with real-time tracking
- **Optimistic security** with fraud-proof challenge window
- **Fully typed TypeScript SDK** — 3 lines to send a message

## Architecture Overview

```
┌──────────────────────┐       ┌─────────────────────────┐
│   Your dApp          │       │   Destination Chain      │
│   (Arbitrum)         │       │   (Ethereum / Base / …)  │
│                      │       │                          │
│  ArbiLink SDK        │       │  ArbiLinkReceiver.sol    │
│  sendMessage()  ─────┼──┬───►│  receiveMessage()        │
│                      │  │    │  → executes your target  │
│  MessageHub.sol      │  │    └─────────────────────────┘
│  (Rust / Stylus)     │  │
└──────────────────────┘  │    ┌─────────────────────────┐
                           └───│   Relayer Network        │
                               │   (off-chain, staked)    │
                               └─────────────────────────┘
```

## Components

| Component | Language | Role |
|-----------|----------|------|
| `MessageHub` | Rust (Stylus) | On-chain message registry on Arbitrum |
| `ArbiLinkReceiver` | Solidity | Receiver contract on every destination chain |
| Relayer Network | Off-chain | Detects events, delivers messages, stakes ETH |
| `@arbilink/sdk` | TypeScript | Developer SDK for sending & tracking messages |

## Security Model

ArbiLink uses an **optimistic** approach:

1. Relayers stake ETH to participate (`RELAYER_STAKE = 0.1 ETH`)
2. Messages are executed optimistically on the destination chain
3. A **5-minute challenge window** allows anyone to dispute invalid deliveries
4. Fraudulent relayers are **slashed** — their stake is redistributed
5. Honest relayers earn fees for every delivery

::: tip No Trusted Intermediaries
ArbiLink does not rely on a multisig, oracle committee, or any centralised entity. Security comes from economic incentives and fraud proofs.
:::

## Next Steps

<div class="cta-grid">
  <a href="/getting-started/installation" class="cta-card">
    <h3>📦 Installation</h3>
    <p>Install the SDK into your project</p>
  </a>
  <a href="/getting-started/quick-start" class="cta-card">
    <h3>⚡ Quick Start</h3>
    <p>Send your first message in 5 minutes</p>
  </a>
</div>
