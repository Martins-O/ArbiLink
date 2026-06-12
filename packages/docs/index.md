---
layout: home

hero:
  name: ArbiLink
  text: Universal Cross-Chain Messaging
  tagline: Build once on Arbitrum. Connect to everywhere.
  image:
    src: /logo.svg
    alt: ArbiLink Logo
  actions:
    - theme: brand
      text: Get Started →
      link: /getting-started/
    - theme: alt
      text: View Demo
      link: __DEMO_URL__
    - theme: alt
      text: GitHub
      link: https://github.com/Martins-O/ArbiLink

features:
  - icon: ⚡
    title: Simple Integration
    details: One SDK call to send messages to any chain. No complex bridge integrations, no chain-specific logic.

  - icon: 💰
    title: 95% Cost Reduction
    details: Powered by Arbitrum Stylus (Rust/WASM). Messages cost ~$0.23 vs $4.50+ with traditional bridges.

  - icon: 🚀
    title: ~12 Second Delivery
    details: Optimistic execution with real-time tracking. Watch messages traverse chains step by step.

  - icon: 🔒
    title: Secure by Design
    details: Stake-based relayer network with 5-minute fraud-proof challenge window. No trusted intermediaries.

  - icon: 🌐
    title: Multi-Chain Support
    details: Ethereum, Base, Polygon, Optimism and more. Expanding continuously — one integration reaches all.

  - icon: 📦
    title: TypeScript SDK
    details: Fully typed, tree-shakeable SDK. Works with ethers v6, viem, wagmi v2 and any EVM wallet.
---

<div style="max-width:1100px;margin:3rem auto;padding:0 2rem;">

## Install

::: code-group

```sh [pnpm]
pnpm add @arbilink/sdk ethers
```

```sh [npm]
npm install @arbilink/sdk ethers
```

```sh [yarn]
yarn add @arbilink/sdk ethers
```

```sh [bun]
bun add @arbilink/sdk ethers
```

:::

## By the Numbers

<div class="stats-row">
  <div class="stat-card">
    <div class="stat-value">~12s</div>
    <div class="stat-label">Avg Delivery</div>
  </div>
  <div class="stat-card">
    <div class="stat-value">95%</div>
    <div class="stat-label">Cost Reduction</div>
  </div>
  <div class="stat-card">
    <div class="stat-value">4</div>
    <div class="stat-label">Chains Supported</div>
  </div>
  <div class="stat-card">
    <div class="stat-value">3</div>
    <div class="stat-label">Lines to Send</div>
  </div>
</div>

## Quick Example

```typescript
import { ArbiLink } from '@arbilink/sdk';

const arbiLink  = new ArbiLink(signer);
const messageId = await arbiLink.sendMessage({
  to:     11155111,   // Ethereum Sepolia
  target: '0xYourContract',
  data:   encodedCall,
});

// Real-time tracking
arbiLink.watchMessage(messageId, (msg) => {
  console.log(msg.status); // 'pending' → 'relayed' → 'confirmed'
});
```

## Why ArbiLink?

<div class="comparison-grid">
  <div class="comparison-card bad">
    <h3>❌ Without ArbiLink</h3>
    <ul>
      <li>• Deploy same dApp on every chain</li>
      <li>• Manage N deployments & N audits</li>
      <li>• Complex bridge integrations per chain</li>
      <li>• $4.50+ per message</li>
      <li>• Weeks of cross-chain plumbing</li>
      <li>• Users fragmented across ecosystems</li>
    </ul>
  </div>
  <div class="comparison-card good">
    <h3>✅ With ArbiLink</h3>
    <ul>
      <li>✓ Build once on Arbitrum</li>
      <li>✓ One codebase, one security audit</li>
      <li>✓ One SDK call: <code>sendMessage()</code></li>
      <li>✓ ~$0.23 per message (95% cheaper)</li>
      <li>✓ Integrate in hours, not weeks</li>
      <li>✓ Reach all chains from one place</li>
    </ul>
  </div>
</div>

## Start in 5 Minutes

<div class="cta-grid">
  <a href="/getting-started/quick-start" class="cta-card">
    <h3>⚡ Quick Start</h3>
    <p>Install the SDK and send your first cross-chain message</p>
  </a>
  <a href="/examples/" class="cta-card">
    <h3>💻 Code Examples</h3>
    <p>Real-world NFT, token, and DAO examples ready to copy</p>
  </a>
  <a href="/sdk/" class="cta-card">
    <h3>📚 SDK Reference</h3>
    <p>Complete API with full TypeScript types</p>
  </a>
  <a href="/guides/" class="cta-card">
    <h3>🗺️ Guides</h3>
    <p>Step-by-step walkthroughs for common patterns</p>
  </a>
</div>

## How It Works

<div class="status-diagram">
Your dApp → sendMessage() → MessageHub (Stylus/Rust on Arbitrum)<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↓  Relayer picks up MessageSent event<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↓  receiveMessage() on destination chain<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↓  Target contract executed<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↓  5-min challenge window → confirmed ✓
</div>

| Step | Action | Time |
|------|--------|------|
| **1** | `sendMessage()` emits `MessageSent` on Arbitrum | Instant |
| **2** | Relayer detects event and signs proof | ~2s |
| **3** | `receiveMessage()` called on destination | ~5s |
| **4** | `confirmDelivery()` finalizes on Arbitrum hub | ~5s |

## Built on Arbitrum Stylus

The `MessageHub` contract is written in **Rust** and compiled to WASM via Arbitrum Stylus:

| Metric | Solidity | ArbiLink (Stylus) |
|--------|----------|-------------------|
| Gas per message | ~$4.50 | ~$0.23 |
| Safety | EVM | Memory-safe Rust |
| Contract size | Standard | Optimized WASM |

</div>
