# Guides

Step-by-step walkthroughs for common cross-chain patterns using ArbiLink.

## Available Guides

<div class="cta-grid">
  <a href="/guides/nft-minting" class="cta-card">
    <h3>🎨 Cross-Chain NFT Minting</h3>
    <p>Trigger NFT mints on Ethereum from Arbitrum contracts and frontends</p>
  </a>
  <a href="/guides/token-transfers" class="cta-card">
    <h3>💰 Token Transfers</h3>
    <p>Send ERC-20 tokens across chains without bridge complexity</p>
  </a>
  <a href="/guides/dao-voting" class="cta-card">
    <h3>🗳️ DAO Voting</h3>
    <p>Let Arbitrum users vote in governance systems on any chain</p>
  </a>
  <a href="/guides/advanced-patterns" class="cta-card">
    <h3>⚙️ Advanced Patterns</h3>
    <p>Batch messages, error handling, retry logic, and production tips</p>
  </a>
</div>

## Common Pattern

All guides follow the same structure:

1. **Deploy receiver** — Deploy your contract on the destination chain
2. **Authorize ArbiLink** — Restrict calls to `ArbiLinkReceiver` only
3. **Encode call** — Use `viem`'s `encodeFunctionData`
4. **Send** — Call `arbiLink.sendMessage()`
5. **Track** — Use `watchMessage()` for real-time status

```typescript
// Universal pattern
const data = encodeFunctionData({ abi, functionName, args });
const id   = await arbiLink.sendMessage({ chainId, target, data });
arbiLink.watchMessage(id, (msg) => console.log(msg.status));
```
