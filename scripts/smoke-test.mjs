#!/usr/bin/env node
/**
 * ArbiLink Smoke Test
 *
 * Verifies the full stack is correctly wired up before demo day.
 * Reads .env from repo root automatically.
 *
 * Usage:
 *   node scripts/smoke-test.mjs
 */

import { ethers } from '../packages/sdk/node_modules/ethers/lib.esm/index.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// ── Load .env ─────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath   = path.join(__dirname, '..', '.env');
try {
  const env = readFileSync(envPath, 'utf8');
  for (const line of env.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    if (key && !process.env[key]) process.env[key] = val;
  }
} catch {
  console.error('⚠  Could not read .env — make sure it exists at repo root');
}

// ── Config ────────────────────────────────────────────────────────────────────

const HUB_ADDRESS  = '0x9a9e7Ec4EA29bb63fE7c38E124B253b44fF897Cc';
const MIN_STAKE    = ethers.parseEther('1'); // from deployment-info.json

const HUB_ABI = [
  'function messageCount() view returns (uint256)',
  'function minStake() view returns (uint256)',
  'function owner() view returns (address)',
  'function isActiveRelayer(address) view returns (bool)',
  'function calculateFee(uint32) view returns (uint256)',
];

const RECEIVER_ABI = [
  'function authorizedRelayers(address) view returns (bool)',
  'function hubSigningKey() view returns (address)',
  'function owner() view returns (address)',
  'function totalExecuted() view returns (uint256)',
];

const CHAINS = {
  'Arbitrum Sepolia': { rpc: 'https://sepolia-rollup.arbitrum.io/rpc',    receiver: null,                                        chainId: 421614   },
  'Base Sepolia':     { rpc: 'https://sepolia.base.org',                   receiver: '0xD45efE42904C9a27630A548A1FB6d9F133Cf5D35', chainId: 84532    },
  'ETH Sepolia':      { rpc: `https://sepolia.infura.io/v3/${process.env.INFURA_KEY}`, receiver: '0x895058E57bBE8c84C2AABA5d61c4C739C5869F71', chainId: 11155111 },
  'Polygon Amoy':     { rpc: 'https://rpc-amoy.polygon.technology',        receiver: '0x221B7Cca1C385C6c81e17b086C753328AF41AAAa', chainId: 80002    },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

let passed = 0, failed = 0;

function ok(label, detail = '') {
  console.log(`  ✓  ${label}${detail ? `  (${detail})` : ''}`);
  passed++;
}

function fail(label, detail = '') {
  console.log(`  ✗  ${label}${detail ? `  → ${detail}` : ''}`);
  failed++;
}

function warn(label, detail = '') {
  console.log(`  ⚠  ${label}${detail ? `  → ${detail}` : ''}`);
}

function section(title) {
  console.log(`\n── ${title} ${'─'.repeat(50 - title.length)}`);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🧪  ArbiLink Smoke Test\n');

  // ── 1. Env vars ─────────────────────────────────────────────────────────────
  section('Environment');

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    fail('PRIVATE_KEY not set'); return;
  }

  let wallet;
  try {
    const pk = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    wallet = new ethers.Wallet(pk);
    ok('PRIVATE_KEY valid', wallet.address);
  } catch {
    fail('PRIVATE_KEY invalid format');
    return;
  }

  const signingKey = process.env.HUB_SIGNING_KEY ?? privateKey;
  let signingWallet;
  try {
    const pk = signingKey.startsWith('0x') ? signingKey : `0x${signingKey}`;
    signingWallet = new ethers.Wallet(pk);
    ok('HUB_SIGNING_KEY valid', signingWallet.address);
  } catch {
    fail('HUB_SIGNING_KEY invalid'); return;
  }

  if (!process.env.INFURA_KEY) {
    warn('INFURA_KEY not set — ETH Sepolia RPC may fail');
  } else {
    ok('INFURA_KEY set');
  }

  // ── 2. Balances ──────────────────────────────────────────────────────────────
  section('Wallet Balances');

  for (const [name, cfg] of Object.entries(CHAINS)) {
    try {
      const p = new ethers.JsonRpcProvider(cfg.rpc);
      const b = await p.getBalance(wallet.address);
      const eth = ethers.formatEther(b);
      const enough = parseFloat(eth) > 0.01;
      const note   = name === 'Arbitrum Sepolia' ? `(need >1 ETH for relayer stake)` : `(need gas for receiveMessage)`;
      if (enough) ok(`${name}: ${eth} ETH`, note);
      else        fail(`${name}: ${eth} ETH — too low`, note);
    } catch (e) {
      fail(`${name}: RPC error`, (e).message.slice(0, 60));
    }
  }

  // ── 3. MessageHub contract ───────────────────────────────────────────────────
  section('MessageHub on Arbitrum Sepolia');

  const arbProvider = new ethers.JsonRpcProvider(CHAINS['Arbitrum Sepolia'].rpc);
  const hub = new ethers.Contract(HUB_ADDRESS, HUB_ABI, arbProvider);

  try {
    const count    = await hub.messageCount();
    const minStake = await hub.minStake();
    const owner    = await hub.owner();
    ok('Hub reachable', `${count} messages, owner ${owner.slice(0,10)}…`);
    if (minStake !== MIN_STAKE) warn(`minStake is ${ethers.formatEther(minStake)} ETH (expected 1 ETH)`);
    else ok('minStake = 1 ETH');
  } catch (e) {
    fail('Hub unreachable', (e).message.slice(0, 60));
  }

  try {
    const isRelayer = await hub.isActiveRelayer(wallet.address);
    if (isRelayer) ok('Relayer already registered on hub');
    else warn('Relayer NOT registered on hub — bot will register on first run (needs 1 ETH stake)');
  } catch (e) {
    fail('Could not check relayer status', (e).message.slice(0, 60));
  }

  for (const destChainId of [11155111, 84532, 80002]) {
    try {
      const fee = await hub.calculateFee(destChainId);
      ok(`Fee for chain ${destChainId}`, `${ethers.formatEther(fee)} ETH`);
    } catch (e) {
      fail(`Fee for chain ${destChainId} failed`, (e).message.slice(0, 60));
    }
  }

  // ── 4. Receiver contracts ────────────────────────────────────────────────────
  section('Receiver Contracts');

  for (const [name, cfg] of Object.entries(CHAINS)) {
    if (!cfg.receiver) continue;
    try {
      const p        = new ethers.JsonRpcProvider(cfg.rpc);
      const receiver = new ethers.Contract(cfg.receiver, RECEIVER_ABI, p);

      const [authd, sigKey, executed] = await Promise.all([
        receiver.authorizedRelayers(wallet.address),
        receiver.hubSigningKey(),
        receiver.totalExecuted(),
      ]);

      if (authd) ok(`${name}: relayer authorized`);
      else       fail(`${name}: relayer NOT authorized — call setRelayer(${wallet.address}, true)`);

      if (sigKey.toLowerCase() === signingWallet.address.toLowerCase()) {
        ok(`${name}: hubSigningKey matches`, sigKey.slice(0, 10) + '…');
      } else {
        fail(`${name}: hubSigningKey mismatch`, `contract=${sigKey.slice(0,10)}… wallet=${signingWallet.address.slice(0,10)}…`);
      }

      ok(`${name}: ${executed} messages executed`);
    } catch (e) {
      fail(`${name} receiver unreachable`, (e).message.slice(0, 60));
    }
  }

  // ── 5. Signing proof sanity check ────────────────────────────────────────────
  section('Proof Signing (dry run)');

  try {
    const testMsg = {
      id:          1n,
      sender:      wallet.address,
      target:      wallet.address,
      data:        '0x',
      sourceChain: 421614,
    };
    // Must match receiver's keccak256(abi.encode(message)) — struct = tuple encoding
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
      ['tuple(uint256 id,address sender,address target,bytes data,uint32 sourceChain)'],
      [[testMsg.id, testMsg.sender, testMsg.target, testMsg.data, testMsg.sourceChain]],
    );
    const msgHash = ethers.keccak256(encoded);
    const proof   = await signingWallet.signMessage(ethers.getBytes(msgHash));
    ok('Proof signing works', `proof length = ${proof.length / 2 - 1} bytes`);
  } catch (e) {
    fail('Proof signing failed', (e).message);
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(54)}`);
  console.log(`  ${passed} passed  ·  ${failed} failed\n`);

  if (failed > 0) {
    console.log('  Fix the failures above before running the relayer or demo.\n');
    process.exit(1);
  } else {
    console.log('  All checks passed — ready to run the relayer and demo.\n');
  }
}

main().catch(err => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
