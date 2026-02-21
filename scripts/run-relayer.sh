#!/usr/bin/env bash
# run-relayer.sh — keeps the ArbiLink relayer running, restarting on crash.
# Usage: bash scripts/run-relayer.sh
# Env vars required: PRIVATE_KEY, INFURA_KEY (loaded from .env if present)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load .env if it exists
if [ -f "$ROOT_DIR/.env" ]; then
  set -o allexport
  source "$ROOT_DIR/.env"
  set +o allexport
fi

# Validate required env vars
: "${PRIVATE_KEY:?PRIVATE_KEY is not set}"
: "${INFURA_KEY:?INFURA_KEY is not set}"

RESTART_DELAY=5  # seconds between restarts
ATTEMPTS=0

echo "================================================"
echo "  ArbiLink Relayer — auto-restart mode"
echo "================================================"
echo ""

while true; do
  ATTEMPTS=$((ATTEMPTS + 1))
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting relayer (attempt #$ATTEMPTS)..."

  node --experimental-strip-types "$ROOT_DIR/packages/relayer/src/index.ts" || true

  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Relayer exited. Restarting in ${RESTART_DELAY}s..."
  sleep "$RESTART_DELAY"
done
