# Intermediate Examples

React hooks, wagmi v2 integration, and real-time tracking UI.

## 1 — `useArbiLink` Hook (wagmi v2)

```typescript
// hooks/useArbiLink.ts
import { useMemo }              from 'react';
import { useWalletClient }      from 'wagmi';
import { BrowserProvider, JsonRpcProvider, JsonRpcSigner } from 'ethers';
import { ArbiLink }             from '@arbilink/sdk';
import type { WalletClient }    from 'viem';

function walletClientToSigner(wc: WalletClient): JsonRpcSigner {
  const { account, chain, transport } = wc;
  const network  = { chainId: chain!.id, name: chain!.name };
  const provider = new BrowserProvider(transport as any, network);
  return new JsonRpcSigner(provider, account!.address);
}

const ARB_SEPOLIA_RPC = 'https://sepolia-rollup.arbitrum.io/rpc';

export function useArbiLink() {
  const { data: walletClient } = useWalletClient();

  const arbiLink = useMemo(
    () => walletClient ? new ArbiLink(walletClientToSigner(walletClient)) : null,
    [walletClient],
  );

  const readArbiLink = useMemo(
    () => new ArbiLink(new JsonRpcProvider(ARB_SEPOLIA_RPC)),
    [],
  );

  return { arbiLink, readArbiLink, isConnected: !!walletClient };
}
```

## 2 — `useSendMessage` Hook

```typescript
// hooks/useSendMessage.ts
import { useState, useCallback } from 'react';
import { useArbiLink }           from './useArbiLink';
import type { SendMessageParams, MessageStatus } from '@arbilink/sdk';

interface SendState {
  status:    'idle' | 'sending' | MessageStatus;
  messageId: bigint | null;
  error:     string | null;
}

export function useSendMessage() {
  const { arbiLink } = useArbiLink();
  const [state, setState] = useState<SendState>({
    status: 'idle', messageId: null, error: null,
  });

  const send = useCallback(async (params: SendMessageParams) => {
    if (!arbiLink) { setState(s => ({ ...s, error: 'Wallet not connected' })); return; }

    setState({ status: 'sending', messageId: null, error: null });

    try {
      const id = await arbiLink.sendMessage(params);
      setState({ status: 'pending', messageId: id, error: null });

      const unsub = arbiLink.watchMessage(id, (msg) => {
        setState(s => ({ ...s, status: msg.status }));
        if (msg.status === 'confirmed' || msg.status === 'failed') unsub();
      });

    } catch (err: any) {
      setState({ status: 'idle', messageId: null, error: err.message });
    }
  }, [arbiLink]);

  const reset = useCallback(() => {
    setState({ status: 'idle', messageId: null, error: null });
  }, []);

  return { ...state, send, reset };
}
```

## 3 — Status Badge Component

```tsx
// components/StatusBadge.tsx
import type { MessageStatus } from '@arbilink/sdk';

const CONFIG: Record<MessageStatus | 'sending' | 'idle', { label: string; classes: string }> = {
  idle:      { label: 'Ready',      classes: 'bg-slate-700 text-slate-300' },
  sending:   { label: 'Sending…',   classes: 'bg-blue-900 text-blue-300 animate-pulse' },
  pending:   { label: 'Pending',    classes: 'bg-yellow-900 text-yellow-300' },
  relayed:   { label: 'Relayed',    classes: 'bg-blue-900 text-blue-300' },
  confirmed: { label: '✓ Confirmed', classes: 'bg-green-900 text-green-300' },
  failed:    { label: '✗ Failed',   classes: 'bg-red-900 text-red-300' },
};

export function StatusBadge({ status }: { status: keyof typeof CONFIG }) {
  const { label, classes } = CONFIG[status];
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${classes}`}>
      {label}
    </span>
  );
}
```

## 4 — Full Send Form Component

```tsx
// components/SendMessageForm.tsx
import { useState }        from 'react';
import { useSendMessage }  from '../hooks/useSendMessage';
import { StatusBadge }     from './StatusBadge';
import { encodeFunctionData } from 'viem';

const CHAINS = [
  { id: 11155111, name: 'Ethereum Sepolia' },
  { id: 84532,    name: 'Base Sepolia'     },
];

export function SendMessageForm() {
  const [chainId, setChainId] = useState(11155111);
  const [target,  setTarget]  = useState('');
  const { status, messageId, error, send, reset } = useSendMessage();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const data = encodeFunctionData({
      abi:          [{ name: 'execute', type: 'function', inputs: [] }],
      functionName: 'execute',
      args:         [],
    });

    await send({ chainId, target, data });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <select value={chainId} onChange={e => setChainId(Number(e.target.value))}>
        {CHAINS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      <input
        value={target}
        onChange={e => setTarget(e.target.value)}
        placeholder="0x target contract address"
      />

      <button type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending…' : 'Send Message'}
      </button>

      <StatusBadge status={status} />

      {messageId && <p>Message ID: #{messageId.toString()}</p>}
      {error && <p className="text-red-400">{error}</p>}

      {(status === 'confirmed' || status === 'failed') && (
        <button type="button" onClick={reset}>Send Another</button>
      )}
    </form>
  );
}
```

## 5 — Fee Display

```tsx
import { useEffect, useState }       from 'react';
import { useArbiLink }               from '../hooks/useArbiLink';
import { formatEther }               from 'ethers';

export function FeeEstimate({ chainId }: { chainId: number }) {
  const { readArbiLink }         = useArbiLink();
  const [fee, setFee]            = useState<string>('…');

  useEffect(() => {
    readArbiLink.calculateFee(chainId)
      .then(f  => setFee(formatEther(f)))
      .catch(() => setFee('unavailable'));
  }, [chainId]);

  return <span>Estimated fee: <strong>{fee} ETH</strong></span>;
}
```
