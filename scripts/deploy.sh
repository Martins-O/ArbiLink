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

# ── Auto-load .env from repo root ─────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
if [[ -f "${ROOT}/.env" ]]; then
    set -a
    # shellcheck source=/dev/null
    source "${ROOT}/.env"
    set +a
fi

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
echo "╔═══════════════════════════════════════╗"
echo "║      ArbiLink Deployment Suite        ║"
echo "╚═══════════════════════════════════════╝"
echo ""

# ── Pre-flight checks ─────────────────────────────────────────────────────────
[[ -z "${PRIVATE_KEY:-}" ]] && die "PRIVATE_KEY is not set"
[[ -z "${INFURA_KEY:-}"  ]] && die "INFURA_KEY is not set"

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

# ── Step 1: Build + optimise Stylus WASM ─────────────────────────────────────
echo "📦  Building MessageHub WASM..."
WASM_FILE="${ROOT}/message-hub/target/wasm32-unknown-unknown/release/deps/message_hub.wasm"

pushd "${ROOT}/message-hub" > /dev/null
cargo build --release --target wasm32-unknown-unknown 2>&1 | \
    grep -E "Compiling|Finished|error" || true

# Apply wasm-opt to reduce compressed size below the EIP-170 24 576-byte limit.
# Three optimisation passes (2×Oz + O3) are needed; without them the compressed
# WASM is ~25.3 KB and deployment fails with "max code size exceeded".
if command -v wasm-opt > /dev/null 2>&1; then
    echo "   Running wasm-opt (3 passes)..."
    TMP1=$(mktemp --suffix=.wasm)
    TMP2=$(mktemp --suffix=.wasm)
    TMP3=$(mktemp --suffix=.wasm)
    wasm-opt -Oz --enable-bulk-memory "${WASM_FILE}" -o "${TMP1}"
    wasm-opt -Oz --enable-bulk-memory "${TMP1}"      -o "${TMP2}"
    wasm-opt -O3  --enable-bulk-memory "${TMP2}"      -o "${TMP3}"
    cp "${TMP3}" "${WASM_FILE}"
    rm -f "${TMP1}" "${TMP2}" "${TMP3}"
    ok "wasm-opt applied ($(stat -c%s "${WASM_FILE}") bytes raw)"
else
    warn "wasm-opt not found — deploying unoptimised WASM (may fail with max code size exceeded)"
    warn "Install with: cargo install wasm-opt"
fi
popd > /dev/null
ok "WASM built"

# ── Step 2: Deploy MessageHub to Arbitrum Sepolia ─────────────────────────────
echo ""
echo "🚀  Deploying MessageHub to Arbitrum Sepolia..."

# Must run from inside the crate directory; tee shows output live and saves it
TMPFILE=$(mktemp)
pushd "${ROOT}/message-hub" > /dev/null
cargo stylus deploy \
    --private-key="${PRIVATE_KEY}" \
    --endpoint="${ARB_SEPOLIA_RPC}" \
    --no-verify \
    2>&1 | tee "${TMPFILE}"
popd > /dev/null

MESSAGE_HUB=$(grep -oE '0x[a-fA-F0-9]{40}' "${TMPFILE}" | tail -1)
rm -f "${TMPFILE}"
[[ -z "${MESSAGE_HUB}" ]] && die "MessageHub deployment failed — no address found in output"
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

# Helper: deploy a Solidity contract via cast send --create and return address.
# Usage: deploy_receiver <rpc_url>
deploy_receiver() {
    local RPC_URL="$1"
    pushd "${ROOT}/contracts/receiver" > /dev/null
    local BYTECODE
    BYTECODE=$(python3 -c "
import json, sys
d = json.load(open('out/ArbiLinkReceiver.sol/ArbiLinkReceiver.json'))
print(d['bytecode']['object'])
")
    local CTOR_ARGS
    CTOR_ARGS=$(cast abi-encode "constructor(address,address)" "${MESSAGE_HUB}" "${HUB_SIGNING_KEY}")
    local INIT_CODE="${BYTECODE}${CTOR_ARGS#0x}"
    local BASEFEE
    BASEFEE=$(cast base-fee --rpc-url="${RPC_URL}" 2>/dev/null || echo "1000000")
    local GAS_PRICE=$(( BASEFEE * 3 + 1000000000 ))
    local RESULT
    RESULT=$(cast send \
        --rpc-url="${RPC_URL}" \
        --private-key="${PRIVATE_KEY}" \
        --gas-price="${GAS_PRICE}" \
        --create "${INIT_CODE}" 2>&1)
    popd > /dev/null
    echo "${RESULT}" | python3 -c "
import sys, re
d = sys.stdin.read()
m = re.search(r'contractAddress\s+(0x[0-9a-fA-F]{40})', d)
print(m.group(1) if m else '')
"
}

# ── Step 5: Deploy Receiver to Ethereum Sepolia ───────────────────────────────
echo ""
echo "🚀  Deploying ArbiLinkReceiver to Ethereum Sepolia..."
ETH_RECEIVER=$(deploy_receiver "${ETH_SEPOLIA_RPC}")
[[ -z "${ETH_RECEIVER}" ]] && die "ETH Receiver deployment failed — no contract address in output"
ok "ETH Receiver deployed: ${ETH_RECEIVER}"

# Register ETH Sepolia in MessageHub (chainId 11155111, base fee 0.001 ETH)
echo "   Registering Ethereum Sepolia in MessageHub..."
cast send \
    --rpc-url="${ARB_SEPOLIA_RPC}" \
    --private-key="${PRIVATE_KEY}" \
    "${MESSAGE_HUB}" \
    "addChain(uint32,address,uint256)" \
    11155111 "${ETH_RECEIVER}" 1000000000000000
ok "Ethereum Sepolia registered"

# ── Step 6: Deploy Receiver to Base Sepolia ───────────────────────────────────
echo ""
echo "🚀  Deploying ArbiLinkReceiver to Base Sepolia..."
BASE_RECEIVER=$(deploy_receiver "${BASE_SEPOLIA_RPC}")
[[ -z "${BASE_RECEIVER}" ]] && die "Base Receiver deployment failed — no contract address in output"
ok "Base Receiver deployed: ${BASE_RECEIVER}"

# Register Base Sepolia in MessageHub (chainId 84532, base fee 0.001 ETH)
echo "   Registering Base Sepolia in MessageHub..."
cast send \
    --rpc-url="${ARB_SEPOLIA_RPC}" \
    --private-key="${PRIVATE_KEY}" \
    "${MESSAGE_HUB}" \
    "addChain(uint32,address,uint256)" \
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
