import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

// ── Partially mock ethers: real crypto, fake network classes ──────────────
vi.mock('ethers', async () => {
  const actual = await vi.importActual<typeof import('ethers')>('ethers');

  const mockContractFns: Record<string, ReturnType<typeof vi.fn>> = {};
  function getMockFn(name: string) {
    if (!mockContractFns[name]) mockContractFns[name] = vi.fn();
    return mockContractFns[name];
  }

  class FakeJsonRpcProvider {
    constructor(_url?: string) { /* no-op — don't connect */ }
    getBlockNumber       = vi.fn().mockResolvedValue(100_000);
    getBalance           = vi.fn().mockResolvedValue(actual.parseEther('10'));
    getNetwork           = vi.fn().mockResolvedValue({ chainId: 421614n, name: 'mock' });
    getFeeData           = vi.fn().mockResolvedValue({ gasPrice: 1n, maxFeePerGas: 1n, maxPriorityFeePerGas: 1n });
    call                 = vi.fn();
    estimateGas          = vi.fn().mockResolvedValue(100_000n);
    getTransaction       = vi.fn();
    getTransactionCount  = vi.fn().mockResolvedValue(1);
    getBlock             = vi.fn();
    send                 = vi.fn();
    destroy              = vi.fn();
    on                   = vi.fn();
    off                  = vi.fn();
    once                 = vi.fn();
    emit                 = vi.fn();
    listenerCount        = vi.fn().mockReturnValue(0);
    listeners            = vi.fn().mockReturnValue([]);
    removeAllListeners   = vi.fn();
  }

  class FakeContract {
    address: string;
    constructor(address: string, _abi: unknown[], _runner: unknown) {
      this.address = address;
    }
    get isActiveRelayer()   { return getMockFn('isActiveRelayer'); }
    get minStake()          { return getMockFn('minStake'); }
    get registerRelayer()   { return getMockFn('registerRelayer'); }
    get getMessageStatus()  { return getMockFn('getMessageStatus'); }
    get confirmDelivery()   { return getMockFn('confirmDelivery'); }
    get queryFilter()       { return getMockFn('queryFilter'); }
    get filters() {
      return { MessageSent: () => 'MessageSent' };
    }
    get on() {
      return vi.fn();
    }
  }

  return {
    ...actual,
    JsonRpcProvider: FakeJsonRpcProvider as unknown as typeof actual.JsonRpcProvider,
    Contract:        FakeContract as unknown as typeof actual.Contract,
  };
});

// ── Environment ──────────────────────────────────────────────────────────

const TEST_PK = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const SIGNING_PK = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

beforeAll(() => {
  process.env.PRIVATE_KEY = TEST_PK;
  process.env.HUB_SIGNING_KEY = SIGNING_PK;
  process.env.INFURA_KEY = 'test-key';
  process.env.PORT = '0';
});

afterAll(() => {
  delete process.env.PRIVATE_KEY;
  delete process.env.HUB_SIGNING_KEY;
  delete process.env.INFURA_KEY;
  delete process.env.PORT;
});

// ── Tests ────────────────────────────────────────────────────────────────

describe('requireEnv', () => {
  it('returns value when env var is set', async () => {
    const { requireEnv } = await import('../index.js');
    expect(requireEnv('PRIVATE_KEY')).toBe(TEST_PK);
  });

  it('throws when env var is missing', async () => {
    const { requireEnv } = await import('../index.js');
    delete process.env.MISSING_VAR;
    expect(() => requireEnv('MISSING_VAR')).toThrow('Missing env var: MISSING_VAR');
  });
});

describe('signMessage', () => {
  it('returns a 132-char hex string (65-byte signature)', async () => {
    const { signMessage } = await import('../index.js');
    const wallet = new (await import('ethers')).ethers.Wallet(SIGNING_PK);
    const sig = await signMessage(
      { id: 1n, sender: wallet.address, target: '0x0000000000000000000000000000000000000000', data: '0x', sourceChain: 421614, destinationChain: 11155111 },
      wallet,
    );
    expect(sig).toMatch(/^0x[0-9a-f]{130}$/);
  });

  it('recovering the signer from signature yields the signing wallet address', async () => {
    const { signMessage } = await import('../index.js');
    const { ethers } = await import('ethers');
    const wallet = new ethers.Wallet(SIGNING_PK);
    const message = { id: 42n, sender: wallet.address, target: '0x0000000000000000000000000000000000000000', data: '0xdeadbeef', sourceChain: 421614, destinationChain: 84532 };

    const sig = await signMessage(message, wallet);

    // Recompute the hash the same way the contract does:
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
      ['tuple(uint256 id,address sender,address target,bytes data,uint32 sourceChain)'],
      [[message.id, message.sender, message.target, message.data, message.sourceChain]],
    );
    const msgHash = ethers.keccak256(encoded);

    // Recover signer using ethers (reproduces contract's _verifyProof)
    const recovered = ethers.verifyMessage(ethers.getBytes(msgHash), sig);
    expect(recovered.toLowerCase()).toBe(wallet.address.toLowerCase());
  });

  it('different messages produce different signatures', async () => {
    const { signMessage } = await import('../index.js');
    const { ethers } = await import('ethers');
    const wallet = new ethers.Wallet(SIGNING_PK);

    const sig1 = await signMessage(
      { id: 1n, sender: wallet.address, target: '0x0000000000000000000000000000000000000000', data: '0x', sourceChain: 421614, destinationChain: 11155111 },
      wallet,
    );
    const sig2 = await signMessage(
      { id: 2n, sender: wallet.address, target: '0x0000000000000000000000000000000000000000', data: '0x', sourceChain: 421614, destinationChain: 84532 },
      wallet,
    );

    expect(sig1).not.toBe(sig2);
  });

  it('matching the relayer hub signing key recovers to the expected address', async () => {
    const { signMessage } = await import('../index.js');
    const { ethers } = await import('ethers');
    const wallet = new ethers.Wallet(SIGNING_PK);

    const sig = await signMessage(
      { id: 7n, sender: wallet.address, target: '0x0000000000000000000000000000000000000000', data: '0x1234', sourceChain: 421614, destinationChain: 80002 },
      wallet,
    );

    // The recovered address must match the signer
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
      ['tuple(uint256 id,address sender,address target,bytes data,uint32 sourceChain)'],
      [[7n, wallet.address, '0x0000000000000000000000000000000000000000', '0x1234', 421614]],
    );
    const msgHash = ethers.keccak256(encoded);
    const recovered = ethers.verifyMessage(ethers.getBytes(msgHash), sig);
    expect(recovered.toLowerCase()).toBe(wallet.address.toLowerCase());
  });

  it('signs messages with large data payloads correctly', async () => {
    const { signMessage } = await import('../index.js');
    const { ethers } = await import('ethers');
    const wallet = new ethers.Wallet(SIGNING_PK);
    const largeData = '0x' + 'ab'.repeat(1024);

    const sig = await signMessage(
      { id: 99n, sender: wallet.address, target: '0x0000000000000000000000000000000000000000', data: largeData, sourceChain: 421614, destinationChain: 11155111 },
      wallet,
    );
    expect(sig).toMatch(/^0x[0-9a-f]{130}$/);

    // Verify recovery still works
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
      ['tuple(uint256 id,address sender,address target,bytes data,uint32 sourceChain)'],
      [[99n, wallet.address, '0x0000000000000000000000000000000000000000', largeData, 421614]],
    );
    const msgHash = ethers.keccak256(encoded);
    const recovered = ethers.verifyMessage(ethers.getBytes(msgHash), sig);
    expect(recovered.toLowerCase()).toBe(wallet.address.toLowerCase());
  });
});
