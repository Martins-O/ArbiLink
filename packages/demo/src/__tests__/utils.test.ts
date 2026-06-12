import { describe, it, expect } from 'vitest';
import { shortAddress, fmtId, fmtEth, CHAIN_NAMES } from '../lib/utils';

describe('shortAddress', () => {
  it('returns truncated format', () => {
    expect(shortAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18'))
      .toBe('0x742d…bD18');
  });
});

describe('fmtId', () => {
  it('zero-pads short IDs', () => {
    expect(fmtId(42n)).toBe('#000042');
  });

  it('handles large IDs', () => {
    expect(fmtId(123456n)).toBe('#123456');
  });
});

describe('fmtEth', () => {
  it('formats wei to ETH', () => {
    expect(fmtEth(1_500_000_000_000_000_000n)).toBe('1.5 ETH');
  });

  it('strips trailing zeros', () => {
    expect(fmtEth(1_000_000_000_000_000_000n)).toBe('1 ETH');
  });

  it('shows small values', () => {
    expect(fmtEth(1_000_000_000_000_000n)).toBe('0.001 ETH');
  });
});

describe('CHAIN_NAMES', () => {
  it('maps known chain IDs to names', () => {
    expect(CHAIN_NAMES[421614]).toBe('Arbitrum Sepolia');
    expect(CHAIN_NAMES[11155111]).toBe('Ethereum Sepolia');
    expect(CHAIN_NAMES[84532]).toBe('Base Sepolia');
    expect(CHAIN_NAMES[80002]).toBe('Polygon Amoy');
  });
});
