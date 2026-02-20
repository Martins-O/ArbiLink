import { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, Clock, Zap, TrendingDown, Loader2, RefreshCw, Wallet, AlertCircle, ExternalLink } from 'lucide-react';
import { MessageTracker, MessageTrackerEmpty } from '../components/MessageTracker';
import { ChainSelector } from '../components/ChainSelector';
import { ComparisonSection } from '../components/ComparisonSection';
import { useSendMessage } from '../hooks/useSendMessage';
import { fmtId } from '../lib/utils';
import { DEMOS, CHAINS } from '../lib/constants';
import type { ChainName } from '../lib/types';

// Map ChainName → destination chain ID registered in the hub
const CHAIN_ID: Record<ChainName, number> = {
  ethereum: 11155111,  // ETH Sepolia
  base:     84532,     // Base Sepolia
  polygon:  80002,     // Polygon Amoy
  optimism: 0,         // Not supported — disabled below
};

const SUPPORTED: Partial<Record<ChainName, true>> = {
  ethereum: true,
  base:     true,
  polygon:  true,
};

export function Demo() {
  const [selectedDemo, setSelectedDemo] = useState('nft');
  const [destination,  setDestination]  = useState<ChainName>('base');

  const {
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
    isConnected,
    isWrongChain,
  } = useSendMessage();

  const done = currentStep >= 5;

  // Human-readable message ID for the tracker
  const displayId = msgId != null
    ? fmtId(msgId)
    : currentStep === 0
      ? 'pending…'
      : null;

  function handleSend() {
    if (!SUPPORTED[destination]) return;
    sendMessage(CHAIN_ID[destination]);
  }

  // ── Send button label + action ────────────────────────────────────────────

  function sendButtonContent() {
    if (!isConnected) return <><Wallet className="w-5 h-5" /> Connect Wallet to Send</>;
    if (isWrongChain) return <><Zap className="w-5 h-5" /> Switch to Arbitrum Sepolia</>;
    if (isSending)    return <><Loader2 className="w-5 h-5 animate-spin" /> Sending Message…</>;
    if (done)         return <><RefreshCw className="w-5 h-5" /> Send Another Message</>;
    return <><Send className="w-5 h-5" /> Send Cross-Chain Message</>;
  }

  return (
    <div className="min-h-screen gradient-bg py-12 px-6">
      <div className="max-w-7xl mx-auto">

        {/* Hero */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-block px-4 py-2 bg-blue-500/15 border border-blue-500/50 rounded-full text-blue-300 text-sm font-semibold mb-4"
          >
            Built for Arbitrum Open House NYC
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-6xl font-bold text-white mb-4"
          >
            ArbiLink Live Demo
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-slate-300 max-w-2xl mx-auto"
          >
            Send real cross-chain messages from Arbitrum — watch the full lifecycle
            settle on-chain in real time.
          </motion.p>
        </div>

        {/* Demo grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-4">

          {/* Controls */}
          <div className="lg:col-span-2 space-y-5">

            {/* Scenario picker */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass-panel p-6"
            >
              <h2 className="text-lg font-bold text-white mb-4">Select Scenario</h2>
              <div className="space-y-3">
                {DEMOS.map((demo, i) => (
                  <motion.button
                    key={demo.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    onClick={() => setSelectedDemo(demo.id)}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 hover:scale-[1.02] ${
                      selectedDemo === demo.id
                        ? 'border-blue-500 bg-slate-800/60'
                        : 'border-slate-700 bg-slate-800/40 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl leading-none">{demo.icon}</span>
                      <div>
                        <p className="font-bold text-white text-sm leading-tight">{demo.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{demo.description}</p>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>

            {/* Chain selector */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              className="glass-panel p-6"
            >
              <h2 className="text-lg font-bold text-white mb-4">Destination Chain</h2>
              <ChainSelector
                chains={CHAINS.map(c => ({
                  ...c,
                  // Mark unsupported chains visually
                  name: SUPPORTED[c.id] ? c.name : `${c.name} (soon)`,
                }))}
                selected={destination}
                onChange={(c) => { if (SUPPORTED[c]) setDestination(c); }}
              />
            </motion.div>

            {/* Send / Reset */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 }}
              className="space-y-3"
            >
              <button
                onClick={done ? reset : handleSend}
                disabled={isSending || (!done && !SUPPORTED[destination])}
                className="w-full button-primary flex items-center justify-center gap-2 py-4 text-base disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {sendButtonContent()}
              </button>

              {/* Error */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </motion.div>
              )}

              {/* Tx hash link */}
              {txHash && (
                <motion.a
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  href={`https://sepolia.arbiscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  View tx on Arbiscan
                </motion.a>
              )}

              {/* SDK hint */}
              <div className="glass-panel px-4 py-3 text-xs font-mono text-slate-400 leading-loose">
                <span className="text-blue-400">await</span>{' '}
                <span className="text-white">arbiLink</span>
                <span className="text-slate-500">.</span>
                <span className="text-purple-400">sendMessage</span>
                <span className="text-slate-300">{'({'}</span>
                <br />
                <span className="pl-4">
                  <span className="text-cyan-400">chainId</span>
                  <span className="text-slate-300">: </span>
                  <span className="text-amber-400">{CHAIN_ID[destination] || '…'}</span>
                  <span className="text-slate-300">,</span>
                </span>
                <br />
                <span className="pl-4">
                  <span className="text-cyan-400">target</span>
                  <span className="text-slate-300">: </span>
                  <span className="text-green-400">'0x742d…44e'</span>
                </span>
                <br />
                <span className="text-slate-300">{'});'}</span>
              </div>
            </motion.div>

            {/* Stats row */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 }}
              className="grid grid-cols-3 gap-3"
            >
              {[
                { icon: Clock,        color: 'blue',   label: 'Est. Time', value: '~15s'  },
                { icon: Zap,          color: 'green',  label: 'Cost',      value: '0.001 ETH' },
                { icon: TrendingDown, color: 'purple', label: 'Savings',   value: '95%'  },
              ].map(({ icon: Icon, color, label, value }) => (
                <div
                  key={label}
                  className={`bg-gradient-to-br from-${color}-950 to-${color}-900/50 border border-${color}-500/40 rounded-xl p-4`}
                >
                  <div className={`flex items-center gap-1.5 text-${color}-400 text-xs mb-1.5`}>
                    <Icon className="w-3 h-3" />
                    {label}
                  </div>
                  <div className="text-lg font-bold text-white">{value}</div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Tracker */}
          <div className="lg:col-span-3">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-panel p-6 h-full"
            >
              <h2 className="text-lg font-bold text-white mb-6">Message Lifecycle</h2>
              {displayId ? (
                <MessageTracker
                  messageId={displayId}
                  steps={steps}
                  progress={progress}
                  destination={destination}
                  txHash={txHash}
                  senderAddress={senderAddress}
                />
              ) : (
                <MessageTrackerEmpty />
              )}
            </motion.div>
          </div>
        </div>

        {/* Comparison */}
        <ComparisonSection />

      </div>
    </div>
  );
}
