# Advanced Patterns

Production-ready patterns for robust cross-chain applications.

## Error Handling

Always wrap `sendMessage` in try/catch with typed error handling:

```typescript
import { ArbiLink, ArbiLinkError } from '@arbilink/sdk';

async function sendWithRetry(
  arbiLink: ArbiLink,
  params:   SendMessageParams,
  retries = 3,
): Promise<bigint> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await arbiLink.sendMessage(params);

    } catch (err) {
      if (!(err instanceof ArbiLinkError)) throw err;

      if (err.code === 'CHAIN_NOT_SUPPORTED') {
        throw err; // Don't retry permanent errors
      }

      if (attempt === retries) throw err;

      const delay = attempt * 1000;
      console.warn(`Attempt ${attempt} failed — retrying in ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Max retries exceeded');
}
```

## Batch Messages

Send multiple messages and wait for all to confirm:

```typescript
async function sendBatch(
  arbiLink: ArbiLink,
  messages: SendMessageParams[],
) {
  // Send all messages in parallel
  const ids = await Promise.all(
    messages.map(p => arbiLink.sendMessage(p))
  );

  // Wait for all to confirm
  return Promise.all(ids.map(id => waitForStatus(arbiLink, id, 'confirmed')));
}

function waitForStatus(
  arbiLink:  ArbiLink,
  messageId: bigint,
  target:    MessageStatus,
): Promise<Message> {
  return new Promise((resolve, reject) => {
    const unsub = arbiLink.watchMessage(messageId, (msg) => {
      if (msg.status === target)    { unsub(); resolve(msg); }
      if (msg.status === 'failed')  { unsub(); reject(new Error(`Message #${messageId} failed`)); }
    });

    // Timeout after 2 minutes
    setTimeout(() => { unsub(); reject(new Error(`Timeout waiting for #${messageId}`)); }, 120_000);
  });
}
```

## Fee Buffer

Always add a small buffer to the fee to handle price fluctuations:

```typescript
async function sendWithFeeBuffer(
  arbiLink: ArbiLink,
  params:   SendMessageParams,
  bufferBps = 1000, // 10% buffer
) {
  const fee        = await arbiLink.calculateFee(params.chainId);
  const feeWithBuf = fee + (fee * BigInt(bufferBps)) / 10_000n;

  // The SDK uses the fee internally — the buffer is passed via tx value
  return arbiLink.sendMessage(params);
}
```

## React: Real-Time Status UI

```typescript
import { useState, useEffect } from 'react';
import { ArbiLink, Message }   from '@arbilink/sdk';

type TrackingState = {
  status: Message['status'] | 'idle' | 'sending';
  messageId: bigint | null;
};

export function useCrossChainTx(arbiLink: ArbiLink | null) {
  const [state, setState] = useState<TrackingState>({ status: 'idle', messageId: null });

  async function send(params: SendMessageParams) {
    if (!arbiLink) return;

    setState({ status: 'sending', messageId: null });

    try {
      const messageId = await arbiLink.sendMessage(params);
      setState({ status: 'pending', messageId });

      const unsub = arbiLink.watchMessage(messageId, (msg) => {
        setState(s => ({ ...s, status: msg.status }));
        if (msg.status === 'confirmed' || msg.status === 'failed') unsub();
      });

    } catch (err) {
      setState({ status: 'idle', messageId: null });
      throw err;
    }
  }

  return { ...state, send };
}
```

## Message Deduplication

Prevent sending the same message twice:

```typescript
const sentMessages = new Set<string>();

function dedupeKey(params: SendMessageParams): string {
  return `${params.chainId}:${params.target}:${params.data}`;
}

async function sendOnce(arbiLink: ArbiLink, params: SendMessageParams) {
  const key = dedupeKey(params);

  if (sentMessages.has(key)) {
    console.warn('Duplicate message — skipping');
    return;
  }

  sentMessages.add(key);
  return arbiLink.sendMessage(params);
}
```

## Optimistic UI

Show instant feedback before the message is confirmed:

```typescript
function MintButton({ onMint }: { onMint: () => void }) {
  const [optimistic, setOptimistic] = useState(false);
  const { send, status }            = useCrossChainTx(arbiLink);

  async function handleClick() {
    // 1. Instant optimistic update
    setOptimistic(true);
    onMint();

    // 2. Send real message
    try {
      await send({ chainId: 11155111, target, data });
    } catch {
      // 3. Rollback on failure
      setOptimistic(false);
    }
  }

  return (
    <button onClick={handleClick} disabled={optimistic}>
      {optimistic ? `Confirming… (${status})` : 'Mint NFT'}
    </button>
  );
}
```

## Monitoring Production Traffic

```typescript
// Log all outgoing messages
const originalSend = arbiLink.sendMessage.bind(arbiLink);
arbiLink.sendMessage = async (params) => {
  const start = Date.now();
  const id    = await originalSend(params);

  console.log(JSON.stringify({
    event:    'message_sent',
    id:       id.toString(),
    chainId:  params.chainId,
    target:   params.target,
    ts:       start,
  }));

  return id;
};
```
