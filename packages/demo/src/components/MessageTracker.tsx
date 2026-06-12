import { motion } from 'framer-motion';
import { CheckCircle2, Clock, Loader2, Send, ExternalLink } from 'lucide-react';
import type { SimulationStep } from '../lib/types';
import { shortAddress } from '../lib/utils';

interface MessageTrackerProps {
  messageId: string;
  steps: SimulationStep[];
  progress: number;
  destination: string;
  txHash?: string | null;
  senderAddress?: string | null;
}

export function MessageTracker({
  messageId,
  steps,
  progress,
  destination,
  txHash,
  senderAddress,
}: MessageTrackerProps) {
  const done = progress >= 100;

  return (
    <div className="space-y-6">

      {/* Message ID + status badge */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 mb-0.5">Message ID</p>
          <span className="text-white font-mono font-bold text-lg">{messageId}</span>
        </div>
        {done && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1.5 px-3 py-1 bg-green-500/15 border border-green-500/40 rounded-full text-green-400 text-xs font-semibold"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Delivered
          </motion.span>
        )}
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-500">Progress</span>
          <span className="text-xs font-mono text-slate-400">{Math.round(progress)}%</span>
        </div>
        <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${done ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 'gradient-brand'}`}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step, i) => {
          const isComplete = step.status === 'complete';
          const isActive   = step.status === 'active';

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all duration-300 ${
                isComplete ? 'status-complete'
                : isActive  ? 'status-active'
                : 'status-pending'
              }`}
            >
              {/* Icon */}
              <div className="mt-0.5 shrink-0">
                {isComplete && <CheckCircle2 className="w-5 h-5" />}
                {isActive   && <Loader2 className="w-5 h-5 animate-spin" />}
                {!isComplete && !isActive && <Clock className="w-5 h-5" />}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm text-white">{step.label}</span>
                  {step.time && (
                    <span className="text-xs text-slate-500 font-mono shrink-0">{step.time}</span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{step.description}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Message details panel */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-panel p-4 space-y-2.5 text-sm"
      >
        <div className="flex justify-between">
          <span className="text-slate-400">Sender</span>
          <span className="text-white font-mono">
            {senderAddress ? shortAddress(senderAddress) : '0xabc…def'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Destination</span>
          <span className="text-white capitalize">{destination}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Target</span>
          <span className="text-white font-mono">
            {senderAddress ? shortAddress(senderAddress) : '0x742d…44e'}
          </span>
        </div>
        {txHash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-between items-center"
          >
            <span className="text-slate-400">Tx Hash</span>
            <a
              href={`https://sepolia.arbiscan.io/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-blue-400 hover:text-blue-300 font-mono text-xs transition-colors"
            >
              {shortAddress(txHash)}
              <ExternalLink className="w-3 h-3" />
            </a>
          </motion.div>
        )}
        {done && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="pt-2 border-t border-slate-700 flex items-center gap-2 text-green-400 font-semibold text-xs"
          >
            <CheckCircle2 className="w-4 h-4" />
            Message delivered successfully on-chain
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

/** Empty state shown before any message is sent */
export function MessageTrackerEmpty() {
  return (
    <div className="flex flex-col items-center justify-center h-96 text-center">
      <div className="w-20 h-20 rounded-2xl bg-slate-800/60 flex items-center justify-center mb-4">
        <Send className="w-10 h-10 text-slate-700" />
      </div>
      <p className="text-slate-500 text-lg font-medium">Send a message to see live tracking</p>
      <p className="text-slate-600 text-sm mt-2">
        Select a demo scenario and click "Send Cross-Chain Message"
      </p>
    </div>
  );
}
