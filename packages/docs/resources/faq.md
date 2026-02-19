# FAQ

## General

**What chains does ArbiLink support?**

Currently Ethereum Sepolia and Base Sepolia (testnet). Mainnet chains (Ethereum, Base, Polygon, Optimism) are on the roadmap.

**Is ArbiLink trustless?**

Yes. No trusted committee or multisig is involved. Security comes from economic incentives (relayer staking) and permissionless fraud proofs.

**How is ArbiLink different from Chainlink CCIP, LayerZero, or Hyperlane?**

| Feature | ArbiLink | CCIP | LayerZero |
|---------|----------|------|-----------|
| Source chain | Arbitrum only | Any | Any |
| Gas cost | ~$0.23 | ~$4.50 | ~$2.00 |
| Security model | Optimistic + fraud proofs | DON committee | DVN network |
| Smart contract language | Rust (Stylus) | Solidity | Solidity |
| Target audience | Arbitrum-native dApps | Enterprise | General |

**What happens if a relayer goes offline?**

Messages remain in `PENDING` state. Any other active relayer can deliver them. As the relayer network grows, liveness improves.

---

## Technical

**Can I call any function on any contract?**

Yes, as long as:
1. The destination chain is registered in MessageHub
2. The target contract accepts calls from `ArbiLinkReceiver`
3. The `data` is valid ABI-encoded function call data

**How is the fee calculated?**

```
fee = baseFee[chainId] + gasPrice * estimatedGas
```

The SDK calls `get_fee(chainId)` on the MessageHub contract for the current fee.

**Can messages fail?**

Yes. If the target contract reverts, the message is still recorded as delivered on ArbiLinkReceiver (the relayer doesn't lose their stake). Your contract is responsible for handling failures gracefully.

**What is the maximum message data size?**

There is no hard limit in the protocol, but practical limits apply from EVM calldata costs (~16 gas/byte). Keep messages concise — pass IDs rather than large data blobs.

**Can I send ETH value with a message?**

Not directly in the current version. Messages carry `bytes data` and call the target with no ETH value. A future version will support value-bearing messages.

**Does ArbiLink support contract accounts (ERC-4337)?**

Yes. Any address that can sign transactions on Arbitrum can use ArbiLink, including smart contract wallets.

---

## SDK

**Does the SDK work with viem / wagmi v2?**

Yes. Use `BrowserProvider` + `JsonRpcSigner` from ethers to bridge from wagmi's `WalletClient`. See [Installation](/getting-started/installation) for the bridge pattern.

**Can I use the SDK server-side (Node.js)?**

Absolutely. Use `Wallet` + `JsonRpcProvider` from ethers. No browser globals required.

**Is the SDK tree-shakeable?**

Yes. Named exports only — unused utilities won't be bundled.

---

## Deployment

**How do I deploy my own instance?**

```bash
git clone https://github.com/Martins-O/ArbiLink
cd ArbiLink
cp .env.example .env
# Fill in .env
./scripts/deploy.sh
```

See [Deployment Guide](/getting-started/installation) for the full walkthrough.

**Do I need to run my own relayer?**

For production use, yes — or rely on the public relayer network once it's available. For testnet development, a shared relayer is provided.

**Is there a gas estimation tool?**

Use `arbiLink.calculateFee(chainId)` to get the current fee. For Solidity testing, use `hub.get_fee(chainId)`.
