import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Circle, Loader2, XCircle, ArrowRight } from 'lucide-react'
import { cn, fmtId, shortAddress } from '@/lib/utils'

export type SimStep = 0 | 1 | 2 | 3 | 4

export interface TrackedMessage {
  id:              bigint
  sender?:         string
  destinationChain: number
  step:            SimStep   // 0=idle 1=sent 2=relayed 3=submitted 4=confirmed
  failed?:         boolean
  txHash?:         string
}

interface StepDef {
  label:     string
  sublabel:  string
  chain:     string
}

const STEPS: StepDef[] = [
  { label: 'Message Sent',           sublabel: 'Transaction confirmed on Arbitrum',       chain: 'Arbitrum Sepolia' },
  { label: 'Relayer Picked Up',      sublabel: 'Off-chain relayer detected the event',     chain: 'Off-chain'        },
  { label: 'Submitted to Chain',     sublabel: 'Relayer called receiveMessage()',          chain: 'Destination'      },
  { label: 'Executed & Confirmed',   sublabel: 'Challenge window closed — finalized',      chain: 'Arbitrum Sepolia' },
]

const STEP_PROGRESS = [0, 28, 58, 82, 100]

interface MessageTrackerProps {
  message: TrackedMessage | null
}

export default function MessageTracker({ message }: MessageTrackerProps) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!message || message.step === 4 || message.failed) return
    const t = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [message])

  useEffect(() => {
    if (message) setElapsed(0)
  }, [message?.id])

  if (!message) {
    return (
      <div className="flex flex-col items-center justify-center h-80 text-slate-600 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-800/60 flex items-center justify-center">
          <ArrowRight className="w-8 h-8" />
        </div>
        <p className="text-center text-sm">Send a message to see live tracking</p>
      </div>
    )
  }

  const progress = message.failed ? 100 : STEP_PROGRESS[message.step]
  const isDone   = message.step === 4 || !!message.failed

  return (
    <div className="space-y-6">

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-slate-500 mb-2">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            className={cn(
              'h-full rounded-full',
              message.failed
                ? 'bg-red-500'
                : 'bg-gradient-to-r from-blue-500 to-violet-500',
            )}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {STEPS.map((s, i) => {
          const stepNum  = (i + 1) as SimStep
          const complete = message.step > stepNum - 1 && !message.failed
          const active   = message.step === stepNum - 1 && !isDone
          const failed   = message.failed && i === message.step - 1

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className={cn(
                'flex items-start gap-3 p-3.5 rounded-xl border transition-all duration-300',
                complete  && 'border-emerald-500/40 bg-emerald-950/20',
                active    && 'border-blue-500/60 bg-blue-950/30',
                failed    && 'border-red-500/40 bg-red-950/20',
                !complete && !active && !failed && 'border-slate-800/60 bg-slate-900/30',
              )}
            >
              {/* Icon */}
              <div className={cn(
                'mt-0.5 shrink-0',
                complete ? 'text-emerald-400' : active ? 'text-blue-400' : failed ? 'text-red-400' : 'text-slate-600',
              )}>
                {failed   ? <XCircle   className="w-5 h-5" /> :
                 complete ? <CheckCircle2 className="w-5 h-5" /> :
                 active   ? <Loader2   className="w-5 h-5 animate-spin" /> :
                            <Circle    className="w-5 h-5" />}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-white">{s.label}</div>
                <div className="text-xs text-slate-500 mt-0.5">{s.sublabel}</div>
              </div>

              {/* Chain badge */}
              <span className="chain-badge shrink-0 text-slate-400">{s.chain}</span>
            </motion.div>
          )
        })}
      </div>

      {/* Message details */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-4 space-y-2.5 text-sm"
        >
          <div className="flex justify-between">
            <span className="text-slate-500">Message ID</span>
            <span className="font-mono text-white">{fmtId(message.id)}</span>
          </div>
          {message.sender && (
            <div className="flex justify-between">
              <span className="text-slate-500">Sender</span>
              <span className="font-mono text-white">{shortAddress(message.sender)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-500">Destination</span>
            <span className="text-white">
              {message.destinationChain === 11155111 ? 'Ethereum Sepolia' : 'Base Sepolia'}
            </span>
          </div>
          {message.txHash && (
            <div className="flex justify-between">
              <span className="text-slate-500">Tx Hash</span>
              <a
                href={`https://sepolia.arbiscan.io/tx/${message.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-blue-400 hover:text-blue-300 transition-colors"
              >
                {shortAddress(message.txHash)}↗
              </a>
            </div>
          )}
          {!isDone && (
            <div className="flex justify-between">
              <span className="text-slate-500">Elapsed</span>
              <span className="text-white">{elapsed}s</span>
            </div>
          )}
          {message.step === 4 && (
            <div className="pt-1 border-t border-slate-800 flex items-center gap-2 text-emerald-400 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              Message delivered successfully
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
