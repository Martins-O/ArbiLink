import { useState, useCallback, useEffect, useRef } from 'react';
import { useWalletClient, useChainId, useSwitchChain } from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';
import { ethers, JsonRpcProvider, Contract, Interface } from 'ethers';
import { walletClientToSigner } from '../lib/utils';
import MessageHubABI from '../../../sdk/src/abi/MessageHub.json';
import { MESSAGE_HUB_ADDRESS, ARBITRUM_SEPOLIA_RPC } from '@arbilink/sdk';
import type { SimulationStep } from '../lib/types';

const HUB_ABI = [
  'function sendMessage(uint32 destinationChain, address target, bytes data) payable returns (uint256)',
  'function calculateFee(uint32 destinationChain) view returns (uint256)',
  'function getMessageStatus(uint256 id) view returns (uint8)',
];

export function useSendMessage() {
  const { data: walletClient } = useWalletClient();
  const chainId                = useChainId();
  const { switchChainAsync }   = useSwitchChain();

  const [isSending,      setIsSending]      = useState(false);
  const [msgId,          setMsgId]          = useState<bigint | null>(null);
  const [currentStep,    setCurrentStep]    = useState(-1);
  const [txHash,         setTxHash]         = useState<string | null>(null);
  const [senderAddress,  setSenderAddress]  = useState<string | null>(null);
  const [error,          setError]          = useState<string | null>(null);

  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>  | null>(null);

  const stopAll = useCallback(() => {
    if (pollRef.current)  { clearInterval(pollRef.current);  pollRef.current  = null; }
    if (timerRef.current) { clearTimeout(timerRef.current);  timerRef.current = null; }
  }, []);

  useEffect(() => () => stopAll(), [stopAll]);

  // ── Derived step list ────────────────────────────────────────────────────────

  const steps: SimulationStep[] = [
    {
      label:       'Message Sent on Arbitrum',
      status:      currentStep >= 1 ? 'complete' : currentStep === 0 ? 'active' : 'pending',
      time:        currentStep >= 1 ? 'mined' : null,
      description: 'Transaction confirmed on Arbitrum Sepolia',
    },
    {
      label:       'Picked Up by Relayer',
      status:      currentStep >= 2 ? 'complete' : currentStep === 1 ? 'active' : 'pending',
      time:        currentStep >= 2 ? '~2s' : null,
      description: 'Relayer scanning for new MessageSent events',
    },
    {
      label:       'Submitted to Destination',
      status:      currentStep >= 3 ? 'complete' : currentStep === 2 ? 'active' : 'pending',
      time:        currentStep >= 3 ? 'submitted' : null,
      description: 'Cross-chain proof submitted to receiver',
    },
    {
      label:       'Executed on Destination',
      status:      currentStep >= 4 ? 'complete' : currentStep === 3 ? 'active' : 'pending',
      time:        currentStep >= 4 ? 'executed' : null,
      description: 'Target function called successfully',
    },
    {
      label:       'Confirmation Received',
      status:      currentStep >= 5 ? 'complete' : currentStep === 4 ? 'active' : 'pending',
      time:        currentStep >= 5 ? 'confirmed' : null,
      description: 'Delivery confirmed on Arbitrum hub',
    },
  ];

  const progress = currentStep < 0 ? 0 : Math.min((currentStep / 5) * 100, 100);

  // ── sendMessage ──────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (destinationChainId: number) => {
    if (!walletClient) return;
    setError(null);
    stopAll();

    try {
      // Switch to Arbitrum Sepolia if on a different chain
      if (chainId !== arbitrumSepolia.id) {
        await switchChainAsync({ chainId: arbitrumSepolia.id });
      }

      setIsSending(true);
      setCurrentStep(0);   // "Submitting tx…"
      setMsgId(null);
      setTxHash(null);

      const signer = walletClientToSigner(walletClient);
      const sender = await signer.getAddress();
      setSenderAddress(sender);

      const hub  = new Contract(MESSAGE_HUB_ADDRESS, HUB_ABI, signer);
      const fee  = await hub.calculateFee(destinationChainId) as bigint;
      const data = ethers.toUtf8Bytes('ArbiLink demo — live cross-chain message');

      const tx = await hub.sendMessage(
        destinationChainId, sender, data, { value: fee },
      ) as ethers.TransactionResponse;
      setTxHash(tx.hash);

      // Wait for mine
      const receipt = await tx.wait();
      setCurrentStep(1);   // "Sent on Arbitrum"

      // Parse messageId from MessageSent event
      const iface = new Interface(MessageHubABI);
      let messageId: bigint | null = null;
      for (const log of receipt?.logs ?? []) {
        try {
          const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
          if (parsed?.name === 'MessageSent') {
            messageId = parsed.args.messageId as bigint;
            break;
          }
        } catch { /* skip non-matching logs */ }
      }
      if (!messageId) throw new Error('Could not parse message ID from tx receipt');
      setMsgId(messageId);

      // Advance to "relayer picked up" after a brief visual delay
      timerRef.current = setTimeout(() => setCurrentStep(2), 3_000);

      // Poll hub every 5s for delivery (relayer usually delivers within ~15s)
      const provider = new JsonRpcProvider(ARBITRUM_SEPOLIA_RPC);
      const readHub  = new Contract(MESSAGE_HUB_ADDRESS, HUB_ABI, provider);

      pollRef.current = setInterval(async () => {
        try {
          const status = Number(await readHub.getMessageStatus(messageId!));
          if (status >= 1) {
            stopAll();
            // Animate through the final steps quickly
            setCurrentStep(3);
            setTimeout(() => setCurrentStep(4), 800);
            setTimeout(() => {
              setCurrentStep(5);
              setIsSending(false);
            }, 1_600);
          }
        } catch { /* ignore transient RPC errors */ }
      }, 5_000);

      // Safety timeout: stop polling after 3 minutes
      timerRef.current = setTimeout(() => {
        stopAll();
        setIsSending(false);
      }, 180_000);

    } catch (e) {
      const msg = (e as Error).message ?? 'Unknown error';
      setError(
        msg.toLowerCase().includes('user rejected')
          ? 'Transaction rejected by user'
          : msg.slice(0, 150),
      );
      setIsSending(false);
      setCurrentStep(-1);
    }
  }, [walletClient, chainId, switchChainAsync, stopAll]);

  // ── reset ────────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    stopAll();
    setCurrentStep(-1);
    setMsgId(null);
    setTxHash(null);
    setError(null);
    setIsSending(false);
    setSenderAddress(null);
  }, [stopAll]);

  return {
    sendMessage,
    isSending,
    msgId,
    currentStep,
    txHash,
    senderAddress,
    error,
    steps,
    progress,
    reset,
    isConnected:  !!walletClient,
    isWrongChain: !!walletClient && chainId !== arbitrumSepolia.id,
  };
}
