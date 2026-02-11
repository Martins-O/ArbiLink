#!/usr/bin/env bash
# ArbiLink Contract Verification Script
# Verifies deployed contracts on block explorers.
#
# Required: deployment-info.json must exist (created by deploy.sh)
# Required env: ARBISCAN_API_KEY, ETHERSCAN_API_KEY, BASESCAN_API_KEY, INFURA_KEY
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOY_FILE="${ROOT}/deployment-info.json"

[[ ! -f "${DEPLOY_FILE}" ]] && { echo "❌  deployment-info.json not found. Run deploy.sh first."; exit 1; }

# Parse addresses
MESSAGE_HUB=$(jq -r '.arbitrum_sepolia.messageHub' "${DEPLOY_FILE}")
ETH_RECEIVER=$(jq -r '.ethereum_sepolia.receiver'  "${DEPLOY_FILE}")
BASE_RECEIVER=$(jq -r '.base_sepolia.receiver'     "${DEPLOY_FILE}")
HUB_SIGNING_KEY=$(jq -r '.config.hubSigningKey'   "${DEPLOY_FILE}")

echo "🔍  Verifying contracts..."

# MessageHub (Stylus) on Arbitrum Sepolia
echo "  Verifying MessageHub on Arbitrum Sepolia..."
cargo +1.88.0 stylus verify \
    --endpoint="https://sepolia-rollup.arbitrum.io/rpc" \
    --deployment-tx="" \
    "${ROOT}/message-hub" 2>/dev/null || echo "   ⚠️  Stylus verification requires --deployment-tx"

# Receiver on Ethereum Sepolia
echo "  Verifying ETH Receiver on Etherscan..."
forge verify-contract \
    --chain-id 11155111 \
    --rpc-url "https://sepolia.infura.io/v3/${INFURA_KEY}" \
    --etherscan-api-key "${ETHERSCAN_API_KEY}" \
    --constructor-args "$(cast abi-encode 'constructor(address,address)' "${MESSAGE_HUB}" "${HUB_SIGNING_KEY}")" \
    "${ETH_RECEIVER}" \
    "${ROOT}/contracts/receiver/src/ArbiLinkReceiver.sol:ArbiLinkReceiver" || true

# Receiver on Base Sepolia
echo "  Verifying Base Receiver on Basescan..."
forge verify-contract \
    --chain-id 84532 \
    --rpc-url "https://sepolia.base.org" \
    --etherscan-api-key "${BASESCAN_API_KEY}" \
    --verifier-url "https://api-sepolia.basescan.org/api" \
    --constructor-args "$(cast abi-encode 'constructor(address,address)' "${MESSAGE_HUB}" "${HUB_SIGNING_KEY}")" \
    "${BASE_RECEIVER}" \
    "${ROOT}/contracts/receiver/src/ArbiLinkReceiver.sol:ArbiLinkReceiver" || true

echo "✅  Verification complete!"
