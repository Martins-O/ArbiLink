import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArbiLink } from '../ArbiLink';
import { MESSAGE_HUB_ADDRESS } from '../constants';

// ── Fully fake ethers (no real imports → no Proxy issues) ─────────────────────

const fakeContract = vi.hoisted(() => {
  const fns: Record<string, ReturnType<typeof vi.fn>> = {};
  return {
    get: (name: string) => {
      if (!fns[name]) fns[name] = vi.fn();
      return fns[name];
    },
    reset: () => {
      Object.keys(fns).forEach(k => { fns[k] = vi.fn(); });
    },
  };
});

vi.mock('ethers', () => {
  class FakeProvider {
    getBalance = vi.fn();
    getBlock = vi.fn();
    getBlockNumber = vi.fn();
    getCode = vi.fn();
    getFeeData = vi.fn();
    getGasPrice = vi.fn();
    getLogs = vi.fn();
    getNetwork = vi.fn();
    getStorage = vi.fn();
    getTransaction = vi.fn();
    getTransactionCount = vi.fn();
    getTransactionReceipt = vi.fn();
    send = vi.fn();
    call = vi.fn();
    estimateGas = vi.fn();
    destroy = vi.fn();
    on = vi.fn();
    off = vi.fn();
    once = vi.fn();
    emit = vi.fn();
    listenerCount = vi.fn();
    listeners = vi.fn();
    removeAllListeners = vi.fn();
  }

  class FakeSigner {
    provider: FakeProvider | null;
    constructor(hasProvider = true) {
      this.provider = hasProvider ? new FakeProvider() : null;
    }
    getAddress = vi.fn().mockResolvedValue('0x1234567890123456789012345678901234567890');
    signMessage = vi.fn();
    signTypedData = vi.fn();
    getNonce = vi.fn();
    populateCall = vi.fn();
    populateTransaction = vi.fn();
    estimateGas = vi.fn();
    call = vi.fn();
    sendTransaction = vi.fn();
    getBalance = vi.fn();
    getChainId = vi.fn();
    _signTypedData = vi.fn();
    connect = vi.fn();
    checkTransaction = vi.fn();
    populate = vi.fn();
  }

  class FakeContract {
    _address: string;
    constructor(address: string, _abi: unknown[], _runner: unknown) {
      this._address = address;
    }
    get sendMessage()           { return fakeContract.get('sendMessage'); }
    get getMessageStatus()      { return fakeContract.get('getMessageStatus'); }
    get minStake()              { return fakeContract.get('minStake'); }
    get getRelayerInfo()        { return fakeContract.get('getRelayerInfo'); }
    get withdrawProtocolFees()  { return fakeContract.get('withdrawProtocolFees'); }
    get registerRelayer()       { return fakeContract.get('registerRelayer'); }
    get exitRelayer()           { return fakeContract.get('exitRelayer'); }
    get filters() {
      return {
        get MessageSent()      { return fakeContract.get('filter_MessageSent'); },
      };
    }
    get queryFilter()           { return fakeContract.get('queryFilter'); }
    get on()                    { return fakeContract.get('on'); }
    get off()                   { return fakeContract.get('off'); }
  }

  class FakeInterface {
    private abi: unknown[];
    constructor(abi: unknown[]) { this.abi = abi; }
    parseLog(_log: { topics: string[]; data: string }) {
      return null;
    }
    getEvent(_name: string) { return null; }
    encodeFunctionData(_fn: string, _args: unknown[]) { return '0x'; }
  }

  const ns = {
    Contract: FakeContract,
    Interface: FakeInterface,
    Provider: FakeProvider,
    JsonRpcProvider: FakeProvider,
    BrowserProvider: FakeProvider,
    Signer: FakeSigner,
    Wallet: FakeSigner,
  };

  // ethers v6 exports both named exports AND a namespace `ethers` object.
  // ArbiLink.ts imports via `import { ethers } from 'ethers'`.
  return { ...ns, ethers: ns };
});

// ── Helper to access the latest mock fn ────────────────────────────────────────

const mock$ = (name: string) => fakeContract.get(name);

beforeEach(() => {
  fakeContract.reset();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ArbiLink', () => {
  describe('constructor', () => {
    it('accepts a provider (read-only mode)', async () => {
      const { ethers } = await import('ethers');
      const provider = new ethers.JsonRpcProvider();
      const arbiLink = new ArbiLink(provider as unknown as ethers.providers.JsonRpcProvider);
      expect(arbiLink).toBeInstanceOf(ArbiLink);
    });

    it('accepts a signer with provider', async () => {
      const { ethers } = await import('ethers');
      const signer = new ethers.Signer();
      const arbiLink = new ArbiLink(signer as unknown as ethers.Signer);
      expect(arbiLink).toBeInstanceOf(ArbiLink);
    });

    it('throws when signer lacks a provider', async () => {
      const { ethers } = await import('ethers');
      const signer = new ethers.Signer(false);
      expect(() => new ArbiLink(signer as unknown as ethers.Signer)).toThrow('Signer has no attached provider');
    });
  });

  describe('sendMessage', () => {
    it('throws without a signer', async () => {
      const { ethers } = await import('ethers');
      const provider = new ethers.JsonRpcProvider();
      const arbiLink = new ArbiLink(provider as unknown as ethers.providers.JsonRpcProvider);
      await expect(arbiLink.sendMessage({ to: 'base', target: '0x1234', data: '0x' })).rejects.toThrow('requires a Signer');
    });

    it('calls contract.sendMessage with correct args via signer', async () => {
      const { ethers } = await import('ethers');
      const provider = new ethers.JsonRpcProvider();
      const signer = new ethers.Signer();
      const arbiLink = new ArbiLink(signer as unknown as ethers.Signer);

      const tx = { wait: vi.fn().mockResolvedValue({ logs: [] }) };
      mock$('sendMessage').mockResolvedValue(tx);

      await expect(arbiLink.sendMessage({ to: 'base', target: '0x1234', data: '0x', fee: 1000000n })).rejects.toThrow('MessageSent event not found');
      expect(mock$('sendMessage')).toHaveBeenCalledWith(84532, '0x1234', '0x', { value: 1000000n });
    });
  });

  describe('getMessageStatus', () => {
    it('returns message status from hub', async () => {
      const { ethers } = await import('ethers');
      const provider = new ethers.JsonRpcProvider();
      const arbiLink = new ArbiLink(provider as unknown as ethers.providers.JsonRpcProvider);

      mock$('getMessageStatus').mockResolvedValue(1n);
      mock$('queryFilter').mockResolvedValue([]);

      const msg = await arbiLink.getMessageStatus(42n);
      expect(msg.status).toBe('relayed');
      expect(msg.id).toBe(42n);
    });
  });

  describe('registerRelayer', () => {
    it('throws without a signer', async () => {
      const { ethers } = await import('ethers');
      const provider = new ethers.JsonRpcProvider();
      const arbiLink = new ArbiLink(provider as unknown as ethers.providers.JsonRpcProvider);
      await expect(arbiLink.registerRelayer()).rejects.toThrow('requires a Signer');
    });

    it('calls registerRelayer with min stake', async () => {
      const { ethers } = await import('ethers');
      const provider = new ethers.JsonRpcProvider();
      const signer = new ethers.Signer();
      const arbiLink = new ArbiLink(signer as unknown as ethers.Signer);

      mock$('minStake').mockResolvedValue(1000000000000000000n);
      mock$('registerRelayer').mockResolvedValue({ wait: vi.fn() });

      await arbiLink.registerRelayer();
      expect(mock$('registerRelayer')).toHaveBeenCalledWith({ value: 1000000000000000000n });
    });
  });

  describe('exitRelayer', () => {
    it('throws without a signer', async () => {
      const { ethers } = await import('ethers');
      const provider = new ethers.JsonRpcProvider();
      const arbiLink = new ArbiLink(provider as unknown as ethers.providers.JsonRpcProvider);
      await expect(arbiLink.exitRelayer()).rejects.toThrow('requires a Signer');
    });
  });

  describe('getRelayerInfo', () => {
    it('returns parsed relayer info', async () => {
      const { ethers } = await import('ethers');
      const provider = new ethers.JsonRpcProvider();
      const arbiLink = new ArbiLink(provider as unknown as ethers.providers.JsonRpcProvider);

      mock$('getRelayerInfo').mockResolvedValue([true, 1000000000000000000n]);
      const info = await arbiLink.getRelayerInfo('0x1234');
      expect(info).toEqual({ active: true, stake: 1000000000000000000n });
    });
  });

  describe('withdrawProtocolFees', () => {
    it('throws without a signer', async () => {
      const { ethers } = await import('ethers');
      const provider = new ethers.JsonRpcProvider();
      const arbiLink = new ArbiLink(provider as unknown as ethers.providers.JsonRpcProvider);
      await expect(arbiLink.withdrawProtocolFees()).rejects.toThrow('requires a Signer');
    });
  });

  describe('view methods', () => {
    it('minStake returns stake', async () => {
      const { ethers } = await import('ethers');
      const provider = new ethers.JsonRpcProvider();
      const arbiLink = new ArbiLink(provider as unknown as ethers.providers.JsonRpcProvider);
      mock$('minStake').mockResolvedValue(1000000000000000000n);
      expect(await arbiLink.minStake()).toBe(1000000000000000000n);
    });
  });

  describe('watchMessage', () => {
    it('subscribes to MessageSent event and unsubscribes', async () => {
      const { ethers } = await import('ethers');
      const provider = new ethers.JsonRpcProvider();
      const arbiLink = new ArbiLink(provider as unknown as ethers.providers.JsonRpcProvider);

      mock$('filter_MessageSent').mockReturnValue({});

      const unwatch = arbiLink.watchMessage(42n, vi.fn());

      expect(mock$('on')).toHaveBeenCalledTimes(1);
      expect(mock$('filter_MessageSent')).toHaveBeenCalledWith(42n);

      unwatch();
      expect(mock$('off')).toHaveBeenCalledTimes(1);
    });
  });
});
