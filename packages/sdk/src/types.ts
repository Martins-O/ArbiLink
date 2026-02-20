// ── Chain types ───────────────────────────────────────────────────────────────

export type ChainId = 11155111 | 84532 | 80002 | 11155420;

export type ChainName = 'ethereum' | 'base' | 'polygon' | 'optimism';

export interface ChainConfig {
  id: number;
  name: string;
  shortName: ChainName;
  rpc: string;
  explorer: string;
  receiverAddress: string;
}

// ── Message types ─────────────────────────────────────────────────────────────

/** On-chain status codes (matches STATUS_* constants in MessageHub) */
export type MessageStatus = 'pending' | 'relayed' | 'confirmed' | 'failed';

/** Full message record as returned by the SDK */
export interface Message {
  id: bigint;
  status: MessageStatus;
  /** Sender address — populated from MessageSent event logs */
  sender?: string;
  /** Destination chain ID — populated from MessageSent event logs */
  destinationChain?: number;
  /** Target contract on the destination chain */
  target?: string;
  /** Encoded calldata for the target */
  data?: string;
  /** Protocol fee paid (in wei) — populated from MessageSent event logs */
  feePaid?: bigint;
  /** Relayer address, present once a relayer confirms delivery */
  relayer?: string;
}

// ── SDK parameter types ───────────────────────────────────────────────────────

export interface SendMessageParams {
  /** Destination chain – either a numeric chain ID or a supported chain name */
  to: number | ChainName;
  /** Target contract address on the destination chain */
  target: string;
  /** ABI-encoded function call (use encodeCall() from utils) */
  data: string;
  /** Override the auto-calculated fee (wei). Fetched from hub if omitted. */
  fee?: bigint;
}

export interface WatchOptions {
  /** Poll interval in ms when WebSocket is unavailable (default: 3000) */
  pollIntervalMs?: number;
}

// ── Relayer types ─────────────────────────────────────────────────────────────

export interface RelayerInfo {
  active: boolean;
  stake: bigint;
}

// ── Error ─────────────────────────────────────────────────────────────────────

export class ArbiLinkError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ArbiLinkError';
    // Preserve prototype chain in compiled JS
    Object.setPrototypeOf(this, ArbiLinkError.prototype);
  }

  static from(err: unknown, context: string): ArbiLinkError {
    if (err instanceof ArbiLinkError) return err;
    const detail = err instanceof Error ? err.message : String(err);
    return new ArbiLinkError(`${context}: ${detail}`, err);
  }
}
