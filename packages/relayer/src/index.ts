/**
 * ArbiLink Relayer Bot
 *
 * Watches for MessageSent events on the ArbiLink MessageHub (Arbitrum Sepolia),
 * relays each message to the destination-chain Receiver, then calls
 * confirm_delivery on the hub to collect the relayer reward.
 *
 * Required env vars:
 *   PRIVATE_KEY          – relayer wallet (must be authorized on each Receiver
 *                          and registered on the MessageHub via register_relayer)
 *   HUB_SIGNING_KEY      – private key that signed execution proofs; defaults to
 *                          PRIVATE_KEY when not set (i.e. deployer == signing key)
 *   INFURA_KEY           – used for Ethereum Sepolia RPC
 */

import { ethers } from 'ethers';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import http from 'http';

const require = createRequire(import.meta.url);

// ── ABI imports ────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MessageHubABI: any[] = require('../../sdk/src/abi/MessageHub.json');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ReceiverABI:   any[] = require('../../sdk/src/abi/Receiver.json');

// ── Constants ──────────────────────────────────────────────────────────────────

const ARBITRUM_SEPOLIA_CHAIN_ID = 421614;
const HUB_ADDRESS               = '0x9a9e7Ec4EA29bb63fE7c38E124B253b44fF897Cc';

/** Destination chain configs */
const CHAINS: Record<number, { name: string; rpc: string; receiver: string }> = {
  11155111: {
    name:     'Ethereum Sepolia',
    rpc:      `https://sepolia.infura.io/v3/${process.env.INFURA_KEY ?? ''}`,
    receiver: '0x895058E57bBE8c84C2AABA5d61c4C739C5869F71',
  },
  84532: {
    name:     'Base Sepolia',
    rpc:      'https://sepolia.base.org',
    receiver: '0xD45efE42904C9a27630A548A1FB6d9F133Cf5D35',
  },
  80002: {
    name:     'Polygon Amoy',
    rpc:      'https://rpc-amoy.polygon.technology',
    receiver: '0x221B7Cca1C385C6c81e17b086C753328AF41AAAa',
  },
};

/** Re-poll interval when no new blocks arrive */
const POLL_INTERVAL_MS = 10_000;

// ── Types ──────────────────────────────────────────────────────────────────────

interface MessageStruct {
  id:          bigint;
  sender:      string;
  target:      string;
  data:        string;
  sourceChain: number;
}

// ── Env ────────────────────────────────────────────────────────────────────────

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
}

// ── Proof generation ───────────────────────────────────────────────────────────

/**
 * Sign a message struct with the hub signing key.
 *
 * The Receiver uses:
 *   bytes32 msgHash = keccak256(abi.encode(message));
 *   bytes32 ethSignedHash = keccak256("\x19Ethereum Signed Message:\n32" || msgHash);
 *   address recovered = ECDSA.recover(ethSignedHash, proof);
 *
 * ethers `wallet.signMessage(bytes)` applies the same prefix automatically.
 */
async function signMessage(
  message: MessageStruct,
  signingWallet: ethers.Wallet,
): Promise<string> {
  // Must use tuple encoding to match the Solidity receiver's:
  //   bytes32 msgHash = keccak256(abi.encode(message));
  // abi.encode(struct) encodes as a tuple (with offset pointer for dynamic fields).
  const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
    ['tuple(uint256 id,address sender,address target,bytes data,uint32 sourceChain)'],
    [[message.id, message.sender, message.target, message.data, message.sourceChain]],
  );
  const msgHash = ethers.keccak256(encoded);
  // signMessage applies the \x19Ethereum Signed Message prefix
  return signingWallet.signMessage(ethers.getBytes(msgHash));
}

// ── Relay one message ──────────────────────────────────────────────────────────

async function relayMessage(
  message: MessageStruct,
  hub: ethers.Contract,
  relayerWallet: ethers.Wallet,
  signingWallet: ethers.Wallet,
): Promise<void> {
  const destChainId = Number(message.sourceChain === ARBITRUM_SEPOLIA_CHAIN_ID
    ? 0  // guard — should never happen
    : message.id); // unused here; we use the destinationChain from the event

  // destinationChain is passed in via message struct for routing, but in the
  // MessageSent event it's a separate arg. The caller resolves this before
  // calling us — see processEvent().
  void destChainId; // silence unused var

  const chainId = (message as MessageStruct & { destinationChain: number }).destinationChain;
  const chain   = CHAINS[chainId];

  if (!chain) {
    console.warn(`  ⚠  No receiver config for chain ${chainId} — skipping`);
    return;
  }

  const proof = await signMessage(message, signingWallet);
  console.log(`  ✎  Signed proof for message #${message.id}`);

  // ── Step 1: call Receiver on destination chain ────────────────────────────
  const destProvider = new ethers.JsonRpcProvider(chain.rpc);
  const destWallet   = relayerWallet.connect(destProvider);
  const receiver     = new ethers.Contract(chain.receiver, ReceiverABI, destWallet);

  console.log(`  →  Calling receiveMessage on ${chain.name} ...`);
  try {
    const rxTx = await receiver.receiveMessage(
      {
        id:          message.id,
        sender:      message.sender,
        target:      message.target,
        data:        message.data,
        sourceChain: ARBITRUM_SEPOLIA_CHAIN_ID,
      },
      proof,
    ) as ethers.TransactionResponse;
    const rxReceipt = await rxTx.wait();
    console.log(`  ✓  receiveMessage mined: ${rxReceipt?.hash}`);
  } catch (err) {
    console.error(`  ✗  receiveMessage failed:`, (err as Error).message);
    // Don't confirm on hub if delivery failed
    return;
  }

  // ── Step 2: confirmDelivery on the hub ───────────────────────────────────
  console.log(`  →  Calling confirmDelivery on hub ...`);
  try {
    const hubTx = await hub.confirmDelivery(
      message.id,
      proof,  // execution proof (currently unused in hub but included for future use)
    ) as ethers.TransactionResponse;
    const hubReceipt = await hubTx.wait();
    console.log(`  ✓  confirmDelivery mined: ${hubReceipt?.hash}`);
    console.log(`  🏁  Message #${message.id} fully delivered.\n`);
  } catch (err) {
    console.error(`  ✗  confirm_delivery failed:`, (err as Error).message);
  }
}

// ── Process a MessageSent event ────────────────────────────────────────────────

async function processEvent(
  event: ethers.EventLog,
  hub: ethers.Contract,
  relayerWallet: ethers.Wallet,
  signingWallet: ethers.Wallet,
  processed: Set<string>,
): Promise<void> {
  const messageId      = event.args.messageId as bigint;
  const idStr          = messageId.toString();

  if (processed.has(idStr)) return;
  processed.add(idStr);

  const destinationChain = Number(event.args.destinationChain);
  const sender           = event.args.sender as string;
  const target           = event.args.target as string;
  const data             = event.args.data   as string;

  console.log(`\n📨  Message #${idStr}  →  chain ${destinationChain}`);
  console.log(`     sender: ${sender}`);
  console.log(`     target: ${target}`);

  // Check if already confirmed
  let status: number;
  try {
    status = Number(await hub.getMessageStatus(messageId));
  } catch {
    console.warn(`  ⚠  Could not fetch status for #${idStr} — skipping`);
    return;
  }

  if (status !== 0 /* STATUS_PENDING */) {
    console.log(`  ℹ  Already processed (status=${status}) — skipping`);
    return;
  }

  const message: MessageStruct & { destinationChain: number } = {
    id:               messageId,
    sender,
    target,
    data,
    sourceChain:      ARBITRUM_SEPOLIA_CHAIN_ID,
    destinationChain,
  };

  await relayMessage(message, hub, relayerWallet, signingWallet);
}

// ── Main loop ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // ── Load env ──────────────────────────────────────────────────────────────
  const relayerKey    = requireEnv('PRIVATE_KEY');
  const signingKey    = process.env.HUB_SIGNING_KEY ?? relayerKey;
  const arbRpc        = process.env.INFURA_KEY
    ? `https://arbitrum-sepolia.infura.io/v3/${process.env.INFURA_KEY}`
    : 'https://sepolia-rollup.arbitrum.io/rpc';

  const arbProvider    = new ethers.JsonRpcProvider(arbRpc);
  const relayerWallet  = new ethers.Wallet(relayerKey, arbProvider);
  const signingWallet  = new ethers.Wallet(signingKey);

  console.log(`🤖  ArbiLink Relayer`);
  console.log(`    wallet:      ${relayerWallet.address}`);
  console.log(`    signing key: ${signingWallet.address}`);
  console.log(`    hub:         ${HUB_ADDRESS}\n`);

  const hub = new ethers.Contract(HUB_ADDRESS, MessageHubABI, relayerWallet);

  // ── Ensure registered as relayer ──────────────────────────────────────────
  const isActive = await hub.isActiveRelayer(relayerWallet.address) as boolean;
  if (!isActive) {
    const minStake = await hub.minStake() as bigint;
    console.log(`📝  Registering as relayer (stake: ${ethers.formatEther(minStake)} ETH) ...`);
    const regTx = await hub.registerRelayer({ value: minStake }) as ethers.TransactionResponse;
    await regTx.wait();
    console.log(`✓  Registered.\n`);
  } else {
    console.log(`✓  Already registered as relayer.\n`);
  }

  // ── Catch up on historical pending messages ────────────────────────────────
  const processed = new Set<string>();
  const currentBlock = await arbProvider.getBlockNumber();
  const fromBlock    = Math.max(0, currentBlock - 50_000);

  console.log(`🔍  Scanning blocks ${fromBlock}–${currentBlock} for pending messages ...`);
  const sentFilter = hub.filters['MessageSent']();
  const pastEvents = await hub.queryFilter(sentFilter, fromBlock) as ethers.EventLog[];
  console.log(`    Found ${pastEvents.length} MessageSent event(s)\n`);

  for (const event of pastEvents) {
    await processEvent(event, hub, relayerWallet, signingWallet, processed);
  }

  // ── Live listener ─────────────────────────────────────────────────────────
  console.log(`👂  Listening for new messages (polling every ${POLL_INTERVAL_MS / 1000}s) ...\n`);

  hub.on(sentFilter, async (...args: unknown[]) => {
    const event = args[args.length - 1] as ethers.EventLog;
    try {
      await processEvent(event, hub, relayerWallet, signingWallet, processed);
    } catch (err) {
      console.error(`  ✗  Unhandled error processing event:`, (err as Error).message);
    }
  });

  // Health-check server for Render / other platforms that require an open port
  const port = process.env.PORT ? parseInt(process.env.PORT) : null;
  if (port) {
    http.createServer((_, res) => {
      res.writeHead(200);
      res.end('ArbiLink relayer running\n');
    }).listen(port, () => {
      console.log(`🌐  Health-check server listening on port ${port}`);
    });
  }

  // Keep the process alive
  setInterval(() => {/* heartbeat */}, POLL_INTERVAL_MS);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
