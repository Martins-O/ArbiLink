import { motion }                  from 'framer-motion'
import { CheckCircle2, Clock, Loader2, XCircle, ArrowRight } from 'lucide-react'
import { cn, fmtId, shortAddress, CHAIN_NAMES } from '@/lib/utils'

export interface MockMessage {
  id:               bigint
  sender:           string
  destinationChain: number
  target:           string
  status:           'pending' | 'relayed' | 'confirmed' | 'failed'
  feePaid:          bigint
  timestamp:        number
  demo:             string   // demo type label
}

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   icon: Clock,        color: 'text-amber-400',  bg: 'bg-amber-400/10  border-amber-400/30'  },
  relayed:   { label: 'Relayed',   icon: Loader2,      color: 'text-blue-400',   bg: 'bg-blue-400/10   border-blue-400/30'   },
  confirmed: { label: 'Confirmed', icon: CheckCircle2, color: 'text-emerald-400',bg: 'bg-emerald-400/10 border-emerald-400/30'},
  failed:    { label: 'Failed',    icon: XCircle,      color: 'text-red-400',    bg: 'bg-red-400/10    border-red-400/30'    },
}

interface MessageCardProps {
  message: MockMessage
  index:   number
}

export default function MessageCard({ message, index }: MessageCardProps) {
  const s = STATUS_CONFIG[message.status]
  const Icon = s.icon
  const destName = CHAIN_NAMES[message.destinationChain] ?? `Chain #${message.destinationChain}`
  const age = Math.floor((Date.now() / 1000 - message.timestamp) / 60)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="glass glass-hover rounded-xl p-4 group"
    >
      <div className="flex items-start gap-4">

        {/* Status icon */}
        <div className={cn('w-9 h-9 rounded-lg border flex items-center justify-center shrink-0', s.bg)}>
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
      </div>
    </motion.div>
  )
}
