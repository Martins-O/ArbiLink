import { useState }                from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2, Clock, Loader2, XCircle, ArrowRight,
  ChevronDown, ExternalLink,
} from 'lucide-react'
import { cn, fmtId, fmtEth, shortAddress, CHAIN_NAMES } from '@/lib/utils'

export interface MockMessage {
  id:               bigint
  sender:           string
  destinationChain: number
  target:           string
  status:           'pending' | 'relayed' | 'confirmed' | 'failed'
  feePaid:          bigint
  timestamp:        number
  demo:             string   // demo type label
  txHash?:          string
}

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   icon: Clock,        color: 'text-amber-400',  bg: 'bg-amber-400/10  border-amber-400/30'  },
  relayed:   { label: 'Relayed',   icon: Loader2,      color: 'text-blue-400',   bg: 'bg-blue-400/10   border-blue-400/30'   },
  confirmed: { label: 'Confirmed', icon: CheckCircle2, color: 'text-emerald-400',bg: 'bg-emerald-400/10 border-emerald-400/30'},
  failed:    { label: 'Failed',    icon: XCircle,      color: 'text-red-400',    bg: 'bg-red-400/10    border-red-400/30'    },
}

/** Block explorer roots per chain */
const EXPLORER_TX: Record<number, string> = {
  421614:   'https://sepolia.arbiscan.io/tx',
  11155111: 'https://sepolia.etherscan.io/tx',
  84532:    'https://sepolia.basescan.org/tx',
  80002:    'https://amoy.polygonscan.com/tx',
  11155420: 'https://sepolia-optimism.etherscan.io/tx',
}

const EXPLORER_ADDR: Record<number, string> = {
  421614:   'https://sepolia.arbiscan.io/address',
  11155111: 'https://sepolia.etherscan.io/address',
  84532:    'https://sepolia.basescan.org/address',
  80002:    'https://amoy.polygonscan.com/address',
  11155420: 'https://sepolia-optimism.etherscan.io/address',
}

interface MessageCardProps {
  message: MockMessage
  index:   number
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span className="w-24 shrink-0 text-xs text-slate-500 font-medium pt-px">{label}</span>
      <span className="text-xs text-slate-300 font-mono break-all">{children}</span>
    </div>
  )
}

function ExplorerLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
      onClick={e => e.stopPropagation()}
    >
      {children}
      <ExternalLink className="w-3 h-3 shrink-0" />
    </a>
  )
}

export default function MessageCard({ message, index }: MessageCardProps) {
  const [expanded, setExpanded] = useState(false)

  const s        = STATUS_CONFIG[message.status]
  const Icon     = s.icon
  const destName = CHAIN_NAMES[message.destinationChain] ?? `Chain #${message.destinationChain}`
  const age      = Math.floor((Date.now() / 1000 - message.timestamp) / 60)
  const sentAt   = message.timestamp
    ? new Date(message.timestamp * 1000).toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      })
    : '—'

  const arbiscanTx   = EXPLORER_TX[421614]
  const destAddrRoot = EXPLORER_ADDR[message.destinationChain]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'glass rounded-xl overflow-hidden cursor-pointer transition-colors',
        expanded ? 'ring-1 ring-blue-500/30' : 'glass-hover',
      )}
      onClick={() => setExpanded(v => !v)}
    >
      {/* ── Summary row ── */}
      <div className="flex items-start gap-4 p-4">

        {/* Status icon */}
        <div className={cn('w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 mt-0.5', s.bg)}>
          <Icon className={cn('w-4 h-4', s.color, message.status === 'relayed' && 'animate-spin')} />
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-semibold text-white text-sm">{fmtId(message.id)}</span>
            <span className={cn('chain-badge', s.color)}>{s.label}</span>
            <span className="chain-badge text-slate-400">{message.demo}</span>
          </div>

          <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
            <span>{shortAddress(message.sender)}</span>
            <ArrowRight className="w-3 h-3" />
            <span className="text-slate-400">{destName}</span>
            <span className="ml-auto">{age < 1 ? 'just now' : `${age}m ago`}</span>
          </div>

          <div className="mt-2 font-mono text-xs text-slate-600 truncate">
            → {shortAddress(message.target)}
          </div>
        </div>

        {/* Chevron */}
        <ChevronDown
          className={cn(
            'w-4 h-4 text-slate-600 shrink-0 mt-1 transition-transform duration-200',
            expanded && 'rotate-180',
          )}
        />
      </div>

      {/* ── Expanded detail panel ── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-700/60 mx-4" />
            <div className="px-4 py-3 space-y-0.5">

              <DetailRow label="Message ID">
                {message.id.toString()}
              </DetailRow>

              <DetailRow label="Sent">
                {sentAt}
              </DetailRow>

              <DetailRow label="From">
                <ExplorerLink href={`${EXPLORER_ADDR[421614]}/${message.sender}`}>
                  {message.sender}
                </ExplorerLink>
              </DetailRow>

              <DetailRow label="Dest chain">
                <span className="text-slate-200 font-sans">{destName}</span>
              </DetailRow>

              <DetailRow label="Target">
                {destAddrRoot ? (
                  <ExplorerLink href={`${destAddrRoot}/${message.target}`}>
                    {message.target}
                  </ExplorerLink>
                ) : message.target}
              </DetailRow>

              <DetailRow label="Fee paid">
                <span className="text-slate-200 font-sans">{fmtEth(message.feePaid)}</span>
              </DetailRow>

              {message.txHash && (
                <DetailRow label="Tx hash">
                  <ExplorerLink href={`${arbiscanTx}/${message.txHash}`}>
                    {message.txHash}
                  </ExplorerLink>
                </DetailRow>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
