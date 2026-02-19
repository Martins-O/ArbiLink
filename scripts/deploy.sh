#!/usr/bin/env bash
# ArbiLink Deployment Script
# Deploys MessageHub (Stylus) to Arbitrum Sepolia and Receiver (Solidity) to ETH + Base Sepolia.
#
# Required env vars:
#   PRIVATE_KEY    – deployer private key (0x-prefixed)
#   INFURA_KEY     – Infura project ID (for Ethereum Sepolia RPC)
#
# Optional:
#   HUB_SIGNING_KEY – address of the off-chain signing key for proof verification
#                     (defaults to deployer address)
set -euo pipefail

# ── Colour helpers ────────────────────────────────────────────────────────────
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m"

ok()   { echo -e "${GREEN}✅  $*${NC}"; }
warn() { echo -e "${YELLOW}⚠️   $*${NC}"; }
die()  { echo -e "${RED}❌  $*${NC}"; exit 1; }

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
echo "╔═══════════════════════════════════════╗"
echo "║      ArbiLink Deployment Suite        ║"
echo "╚═══════════════════════════════════════╝"
echo ""

# ── Pre-flight checks ─────────────────────────────────────────────────────────
[[ -z "${PRIVATE_KEY:-}" ]] && die "PRIVATE_KEY is not set"
[[ -z "${INFURA_KEY:-}"  ]] && die "INFURA_KEY is not set"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"

# RPC endpoints
ARB_SEPOLIA_RPC="https://sepolia-rollup.arbitrum.io/rpc"
ETH_SEPOLIA_RPC="https://sepolia.infura.io/v3/${INFURA_KEY}"
BASE_SEPOLIA_RPC="https://sepolia.base.org"

# Contract parameters
MIN_STAKE="1000000000000000000"   # 1 ETH in wei
CHALLENGE_PERIOD="300"            # 5 minutes

# Signing key for the receiver (defaults to deployer)
HUB_SIGNING_KEY="${HUB_SIGNING_KEY:-}"

# ── Toolchain setup ───────────────────────────────────────────────────────────
# The system cargo may not understand +toolchain flags; resolve the 1.88.0
# toolchain bin directory from rustup and prepend it to PATH.
TOOLCHAIN_BIN="$(rustup run 1.88.0 rustc --print sysroot 2>/dev/null)/bin"
if [[ -d "${TOOLCHAIN_BIN}" ]]; then
    export PATH="${TOOLCHAIN_BIN}:${PATH}"
else
    warn "Could not locate Rust 1.88.0 toolchain via rustup – falling back to system cargo"
fi

# ── Step 1: Build Stylus WASM ─────────────────────────────────────────────────
echo "📦  Building MessageHub WASM..."
pushd "${ROOT}/message-hub" > /dev/null
cargo build --release --target wasm32-unknown-unknown 2>&1 | \
    grep -E "Compiling|Finished|error" || true
popd > /dev/null
ok "WASM built"

# ── Step 2: Deploy MessageHub to Arbitrum Sepolia ─────────────────────────────
echo ""
echo "🚀  Deploying MessageHub to Arbitrum Sepolia..."

# cargo stylus deploy returns the contract address on stdout
MESSAGE_HUB=$(cargo stylus deploy \
    --private-key="${PRIVATE_KEY}" \
    --endpoint="${ARB_SEPOLIA_RPC}" \
    --no-verify \
    "${ROOT}/message-hub" 2>&1 | grep -oE '0x[a-fA-F0-9]{40}' | tail -1)

[[ -z "${MESSAGE_HUB}" ]] && die "MessageHub deployment failed"
ok "MessageHub deployed: ${MESSAGE_HUB}"

# ── Step 3: Initialise MessageHub ─────────────────────────────────────────────
echo ""
echo "⚙️   Initialising MessageHub..."
cast send \
    --rpc-url="${ARB_SEPOLIA_RPC}" \
    --private-key="${PRIVATE_KEY}" \
    "${MESSAGE_HUB}" \
    "initialize(uint256,uint256)" \
    "${MIN_STAKE}" "${CHALLENGE_PERIOD}"
ok "MessageHub initialised (minStake=${MIN_STAKE} wei, challengePeriod=${CHALLENGE_PERIOD}s)"

# Determine signing key
if [[ -z "${HUB_SIGNING_KEY}" ]]; then
    HUB_SIGNING_KEY=$(cast wallet address "${PRIVATE_KEY}")
    warn "HUB_SIGNING_KEY not set, using deployer address: ${HUB_SIGNING_KEY}"
fi

# ── Step 4: Build Receiver Solidity contract ──────────────────────────────────
echo ""
echo "📦  Building ArbiLinkReceiver..."
pushd "${ROOT}/contracts/receiver" > /dev/null
forge build --quiet
ok "Receiver built"
popd > /dev/null

# ── Step 5: Deploy Receiver to Ethereum Sepolia ───────────────────────────────
echo ""
echo "🚀  Deploying ArbiLinkReceiver to Ethereum Sepolia..."
ETH_OUTPUT=$(forge create \
    --rpc-url="${ETH_SEPOLIA_RPC}" \
    --private-key="${PRIVATE_KEY}" \
    --broadcast \
    "${ROOT}/contracts/receiver/src/ArbiLinkReceiver.sol:ArbiLinkReceiver" \
    --constructor-args "${MESSAGE_HUB}" "${HUB_SIGNING_KEY}" 2>&1)

ETH_RECEIVER=$(echo "${ETH_OUTPUT}" | grep "Deployed to:" | awk '{print $3}')
[[ -z "${ETH_RECEIVER}" ]] && die "ETH Receiver deployment failed"
ok "ETH Receiver deployed: ${ETH_RECEIVER}"

# Register ETH Sepolia in MessageHub (chainId 11155111, base fee 0.001 ETH)
echo "   Registering Ethereum Sepolia in MessageHub..."
cast send \
    --rpc-url="${ARB_SEPOLIA_RPC}" \
    --private-key="${PRIVATE_KEY}" \
    "${MESSAGE_HUB}" \
    "add_chain(uint32,address,uint256)" \
    11155111 "${ETH_RECEIVER}" 1000000000000000
ok "Ethereum Sepolia registered"

# ── Step 6: Deploy Receiver to Base Sepolia ───────────────────────────────────
echo ""
echo "🚀  Deploying ArbiLinkReceiver to Base Sepolia..."
BASE_OUTPUT=$(forge create \
    --rpc-url="${BASE_SEPOLIA_RPC}" \
    --private-key="${PRIVATE_KEY}" \
    --broadcast \
    "${ROOT}/contracts/receiver/src/ArbiLinkReceiver.sol:ArbiLinkReceiver" \
    --constructor-args "${MESSAGE_HUB}" "${HUB_SIGNING_KEY}" 2>&1)

BASE_RECEIVER=$(echo "${BASE_OUTPUT}" | grep "Deployed to:" | awk '{print $3}')
[[ -z "${BASE_RECEIVER}" ]] && die "Base Receiver deployment failed"
ok "Base Receiver deployed: ${BASE_RECEIVER}"

# Register Base Sepolia in MessageHub (chainId 84532, base fee 0.001 ETH)
echo "   Registering Base Sepolia in MessageHub..."
cast send \
    --rpc-url="${ARB_SEPOLIA_RPC}" \
    --private-key="${PRIVATE_KEY}" \
    "${MESSAGE_HUB}" \
    "add_chain(uint32,address,uint256)" \
    84532 "${BASE_RECEIVER}" 1000000000000000
ok "Base Sepolia registered"

# ── Step 7: Save deployment info ──────────────────────────────────────────────
DEPLOY_FILE="${ROOT}/deployment-info.json"
cat > "${DEPLOY_FILE}" <<EOF
{
  "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "arbitrum_sepolia": {
    "chainId": 421614,
    "messageHub": "${MESSAGE_HUB}",
    "rpc": "${ARB_SEPOLIA_RPC}"
  },
  "ethereum_sepolia": {
    "chainId": 11155111,
    "receiver": "${ETH_RECEIVER}",
    "rpc": "${ETH_SEPOLIA_RPC}"
  },
  "base_sepolia": {
    "chainId": 84532,
    "receiver": "${BASE_RECEIVER}",
    "rpc": "${BASE_SEPOLIA_RPC}"
  },
  "config": {
    "minStake":        "${MIN_STAKE}",
    "challengePeriod": "${CHALLENGE_PERIOD}",
    "hubSigningKey":   "${HUB_SIGNING_KEY}"
  }
}
EOF
ok "Deployment info saved to ${DEPLOY_FILE}"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                  Deployment Complete!                        ║"
echo "╠═══════════════════════════════════════════════════════════════╣"
printf "║  MessageHub (Arb Sepolia):  %-33s ║\n" "${MESSAGE_HUB}"
printf "║  ETH Receiver:              %-33s ║\n" "${ETH_RECEIVER}"
printf "║  Base Receiver:             %-33s ║\n" "${BASE_RECEIVER}"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "  1. cd sdk && npm install && npm run build"
echo "  2. cd demo && npm install && npm run dev"
