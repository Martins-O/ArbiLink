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

<div style="max-width:1100px;margin:4rem auto;padding:0 2rem;">

## Quick Example

Send a cross-chain message in 3 lines:

```typescript
import { ArbiLink } from '@arbilink/sdk';

const arbiLink = new ArbiLink(signer);

const messageId = await arbiLink.sendMessage({
  chainId: 11155111,                              // Ethereum Sepolia
  target:  '0x742d35Cc6634C0532925a3b8BC454e4438f44e',
  data:    encodedFunctionCall,
});

// Watch delivery in real time
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
    <p>Complete API documentation with full TypeScript types</p>
  </a>
  <a href="/guides/" class="cta-card">
    <h3>🗺️ Guides</h3>
    <p>Step-by-step walkthroughs for common cross-chain patterns</p>
  </a>
</div>

## How It Works

ArbiLink uses an **optimistic delivery** model powered by Arbitrum Stylus:

<div class="status-diagram">
Your dApp (Arbitrum) → sendMessage() → MessageHub.sol (Stylus/Rust)<br>
       ↓<br>
Relayer Network detects MessageSent event<br>
       ↓<br>
Relayer calls receiveMessage() on destination chain<br>
       ↓<br>
ArbiLinkReceiver.sol executes your target contract<br>
       ↓<br>
5-min challenge window → delivery confirmed → stake returned
</div>

1. **Send** — call `arbiLink.sendMessage()` on Arbitrum Sepolia
2. **Relay** — a staked relayer picks up the `MessageSent` event
3. **Execute** — relayer calls `ArbiLinkReceiver.receiveMessage()` on the destination
4. **Confirm** — after the challenge window, delivery is finalized on Arbitrum

## Built on Arbitrum Stylus

The `MessageHub` contract is written in **Rust** and compiled to WASM via Arbitrum Stylus, giving:

- **10× cheaper gas** than equivalent Solidity
- **Memory-safe** execution environment
- **Native Arbitrum** integration with minimal overhead

</div>
