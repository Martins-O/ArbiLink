import { describe, it, expect } from 'vitest';
import {
  encodeCall,
  formatMessageId,
  formatEth,
  statusLabel,
  resolveChainId,
  estimateDeliveryTime,
  parseStatusCode,
} from '../utils';

// ── encodeCall ────────────────────────────────────────────────────────────────

describe('encodeCall', () => {
  it('encodes a simple function call', () => {
    const data = encodeCall({
      abi: [
        {
          type: 'function',
          name: 'mint',
          inputs: [
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' },
          ],
          outputs: [],
          stateMutability: 'nonpayable',
        },
      ] as const,
      functionName: 'mint',
      args: ['0x000000000000000000000000000000000000dEaD', 1000n],
    });

    expect(data).toMatch(/^0x/);
    // The first 4 bytes are the selector for mint(address,uint256)
    expect(data.length).toBe(138); // 4 bytes selector + 32 bytes addr + 32 bytes uint256 = 68 bytes = 136 hex chars + 0x
  });

  it('encodes a call with no args', () => {
    const data = encodeCall({
      abi: [
        { type: 'function', name: 'burn', inputs: [], outputs: [], stateMutability: 'nonpayable' },
      ] as const,
      functionName: 'burn',
    });

    expect(data).toMatch(/^0x/);
    expect(data).toHaveLength(10); // 4 bytes selector = 8 hex chars + 0x
  });
});

// ── formatMessageId ───────────────────────────────────────────────────────────

describe('formatMessageId', () => {
  it('zero-pads small IDs', () => {
    expect(formatMessageId(42n)).toBe('#000042');
    expect(formatMessageId(1n)).toBe('#000001');
    expect(formatMessageId(0n)).toBe('#000000');
  });

  it('handles large IDs without truncation', () => {
    expect(formatMessageId(123456n)).toBe('#123456');
  });
});

// ── formatEth ─────────────────────────────────────────────────────────────────

describe('formatEth', () => {
  it('formats 0.001 ETH', () => {
    expect(formatEth(1_000_000_000_000_000n)).toBe('0.001 ETH');
  });

  it('formats 1 ETH', () => {
    expect(formatEth(1_000_000_000_000_000_000n)).toBe('1 ETH');
  });

  it('formats 0 ETH', () => {
    expect(formatEth(0n)).toBe('0 ETH');
  });

  it('strips trailing zeros', () => {
    expect(formatEth(1_500_000_000_000_000n)).toBe('0.0015 ETH');
  });
});

// ── statusLabel ───────────────────────────────────────────────────────────────

describe('statusLabel', () => {
  it('returns label for pending', () => {
    expect(statusLabel('pending')).toBe('Pending');
  });

  it('returns label for relayed', () => {
    expect(statusLabel('relayed')).toBe('Relayed (in challenge window)');
  });

  it('returns label for confirmed', () => {
    expect(statusLabel('confirmed')).toBe('Confirmed');
  });

  it('returns label for failed', () => {
    expect(statusLabel('failed')).toBe('Failed');
  });
});

// ── resolveChainId ────────────────────────────────────────────────────────────

describe('resolveChainId', () => {
  it('returns numeric input unchanged', () => {
    expect(resolveChainId(11155111)).toBe(11155111);
  });

  it('resolves chain name to numeric ID', () => {
    expect(resolveChainId('ethereum')).toBe(11155111);
    expect(resolveChainId('base')).toBe(84532);
    expect(resolveChainId('polygon')).toBe(80002);
    expect(resolveChainId('optimism')).toBe(11155420);
  });

  it('is case-insensitive', () => {
    expect(resolveChainId('Ethereum')).toBe(11155111);
    expect(resolveChainId('BASE')).toBe(84532);
  });

  it('throws for unknown chain name', () => {
    expect(() => resolveChainId('solana')).toThrow('Unknown chain');
  });
});

// ── estimateDeliveryTime ──────────────────────────────────────────────────────

describe('estimateDeliveryTime', () => {
  it('returns challenge window + finality for known chains', () => {
    expect(estimateDeliveryTime(11155111)).toBe(315); // 300 + 15
    expect(estimateDeliveryTime(84532)).toBe(302);    // 300 + 2
    expect(estimateDeliveryTime(80002)).toBe(302);    // 300 + 2
  });

  it('returns default for unknown chains', () => {
    expect(estimateDeliveryTime(999999)).toBe(312);   // 300 + 12
  });
});

// ── parseStatusCode ───────────────────────────────────────────────────────────

describe('parseStatusCode', () => {
  it('maps 0 to pending', () => {
    expect(parseStatusCode(0)).toBe('pending');
  });

  it('maps 1 to relayed', () => {
    expect(parseStatusCode(1)).toBe('relayed');
  });

  it('maps 2 to confirmed', () => {
    expect(parseStatusCode(2)).toBe('confirmed');
  });

  it('maps 3 to failed', () => {
    expect(parseStatusCode(3)).toBe('failed');
  });

  it('falls back to pending for unknown codes', () => {
    expect(parseStatusCode(99)).toBe('pending');
  });
});
