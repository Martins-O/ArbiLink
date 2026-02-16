import { encodeFunctionData, type Abi } from 'viem';
import type { MessageStatus } from './types';
import { CHAIN_IDS } from './constants';

// ── Encoding helpers ──────────────────────────────────────────────────────────

/**
 * Encode a contract function call into hex calldata ready for cross-chain delivery.
 *
 * @example
 * ```typescript
 * const data = encodeCall({
 *   abi: parseAbi(['function mint(address to, uint256 amount)']),
 *   functionName: 'mint',
 *   args: ['0x742d35Cc...', 1000n],
 * });
 * ```
 */
export function encodeCall(params: {
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
}): string {
  return encodeFunctionData({
    abi:          params.abi,
    functionName: params.functionName,
    args:         params.args ?? [],
  }) as string;
}

// ── Formatting ────────────────────────────────────────────────────────────────

/**
 * Format a numeric message ID as a zero-padded string.
 * @example formatMessageId(42n) → "#000042"
 */
export function formatMessageId(id: bigint): string {
  return `#${id.toString().padStart(6, '0')}`;
}

/**
 * Human-readable label for a message status.
 */
export function statusLabel(status: MessageStatus): string {
  const labels: Record<MessageStatus, string> = {
    pending:   'Pending',
    relayed:   'Relayed (in challenge window)',
    confirmed: 'Confirmed',
    failed:    'Failed',
  };
  return labels[status];
}

// ── Chain helpers ─────────────────────────────────────────────────────────────

/**
 * Resolve a chain name or numeric ID to a numeric chain ID.
 * Throws `ArbiLinkError` for unknown chains.
 */
export function resolveChainId(chain: number | string): number {
  if (typeof chain === 'number') return chain;

  const id = CHAIN_IDS[chain.toLowerCase() as keyof typeof CHAIN_IDS];
  if (id == null) {
    throw new Error(
      `Unknown chain "${chain}". Supported names: ${Object.keys(CHAIN_IDS).join(', ')}`,
    );
  }
  return id;
}

/**
 * Estimate message delivery time in seconds for a given destination chain.
 *
 * This is a rough heuristic based on block times – actual delivery depends on
 * relayer availability and the 5-minute challenge window.
 */
export function estimateDeliveryTime(chainId: number): number {
  const CHALLENGE_WINDOW = 300; // 5 min in seconds

  const FINALITY_TIMES: Record<number, number> = {
    11155111: 15,  // Ethereum Sepolia
    84532:    2,   // Base Sepolia
    80002:    2,   // Polygon Amoy
    11155420: 2,   // Optimism Sepolia
  };

  return CHALLENGE_WINDOW + (FINALITY_TIMES[chainId] ?? 12);
}

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_MAP: MessageStatus[] = ['pending', 'relayed', 'confirmed', 'failed'];

/**
 * Convert the on-chain numeric status code to the SDK string representation.
 */
export function parseStatusCode(code: number): MessageStatus {
  return STATUS_MAP[code] ?? 'pending';
}

// ── Wei helpers ───────────────────────────────────────────────────────────────

/**
 * Format a wei value as a human-readable ETH string.
 * @example formatEth(1_000_000_000_000_000n) → "0.001 ETH"
 */
export function formatEth(wei: bigint): string {
  const eth = Number(wei) / 1e18;
  return `${eth.toFixed(6).replace(/\.?0+$/, '')} ETH`;
}
