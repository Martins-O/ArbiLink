# Changelog

All notable changes to `@arbilink/sdk` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.1.2] - 2026-02-21

### Fixed
- `parseStatusCode`: status code `1` now correctly maps to `'confirmed'` instead
  of `'relayed'`. The contract only defines `STATUS_PENDING=0` and
  `STATUS_CONFIRMED=1`; the previous mapping caused confirmed messages to appear
  as relayed in all SDK consumers.
- `ArbiLink.getMessageStatus`: relayer address lookup no longer triggers on the
  `'relayed'` status (which cannot be returned by the current contract), removing
  a redundant RPC call.

## [0.1.1] - 2026-02-18

### Changed
- `ethers` and `viem` moved from `dependencies` to `peerDependencies`. Both are
  expected to already be installed in the consuming project; bundling them as
  hard dependencies caused excessive install sizes (viem's transitive tree alone
  added several hundred MB).
- `viem` is now marked optional in `peerDependenciesMeta` — it is only required
  when using `encodeCall()`.

## [0.1.0] - 2026-02-15

### Added
- Initial release.
- `ArbiLink` class: `sendMessage`, `getMessageStatus`, `calculateFee`,
  `watchMessage`, `registerRelayer`, `exitRelayer`, `isActiveRelayer`,
  `messageCount`, `owner`, `minStake`.
- `encodeCall`, `formatMessageId`, `statusLabel`, `resolveChainId`,
  `estimateDeliveryTime`, `parseStatusCode`, `formatEth` utilities.
- Full TypeScript types: `Message`, `MessageStatus`, `SendMessageParams`,
  `WatchOptions`, `RelayerInfo`, `ArbiLinkError`.
- `SUPPORTED_CHAINS`, `CHAIN_IDS`, `RECEIVER_ADDRESSES`, `MESSAGE_HUB_ADDRESS`
  constants for Arbitrum Sepolia hub and Ethereum / Base / Polygon Amoy
  receivers.
