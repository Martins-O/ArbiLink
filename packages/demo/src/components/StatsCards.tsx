import { useEffect, useState } from 'react'
import { motion }               from 'framer-motion'
import { JsonRpcProvider, Contract } from 'ethers'
import { Zap, Globe, Clock, TrendingDown } from 'lucide-react'
import MessageHubABI from '../../../sdk/src/abi/MessageHub.json'
import { MESSAGE_HUB_ADDRESS } from '@arbilink/sdk'

const ARBITRUM_SEPOLIA_RPC = import.meta.env.VITE_INFURA_KEY
  ? `https://arbitrum-sepolia.infura.io/v3/${import.meta.env.VITE_INFURA_KEY}`
  : 'https://sepolia-rollup.arbitrum.io/rpc'

interface Stat {
  label:  string
  value:  string
  suffix: string
  icon:   React.ElementType
  color:  string
  bg:     string
}

const BASE_STATS: Stat[] = [
  { label: 'Messages Relayed', value: '…',   suffix: '',   icon: Zap,          color: 'text-blue-400',    bg: 'bg-blue-500/10   border-blue-500/20'   },
  { label: 'Chains Supported', value: '3',   suffix: '',   icon: Globe,        color: 'text-violet-400',  bg: 'bg-violet-500/10 border-violet-500/20' },
  { label: 'Avg Delivery',     value: '~12', suffix: 's',  icon: Clock,        color: 'text-cyan-400',    bg: 'bg-cyan-500/10   border-cyan-500/20'   },
  { label: 'Cost vs Bridges',  value: '-95', suffix: '%',  icon: TrendingDown, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
]

export default function StatsCards() {
  const [messageCount, setMessageCount] = useState<string>('…')

  useEffect(() => {
    const provider = new JsonRpcProvider(ARBITRUM_SEPOLIA_RPC)
    const hub      = new Contract(MESSAGE_HUB_ADDRESS, MessageHubABI, provider)

    async function fetchCount() {
      try {
        const count = await hub.messageCount() as bigint
        setMessageCount(Number(count).toLocaleString())
      } catch {
        setMessageCount('—')
      }
    }

    fetchCount()
    // Refresh every 30s to stay in sync with the Explorer
    const t = setInterval(fetchCount, 30_000)
    return () => clearInterval(t)
  }, [])

  const stats = BASE_STATS.map((s, i) =>
    i === 0 ? { ...s, value: messageCount } : s,
  )

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => {
        const Icon = stat.icon
        return (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className={`glass rounded-xl p-5 border ${stat.bg}`}
          >
            <div className={`w-9 h-9 rounded-lg ${stat.bg} border flex items-center justify-center mb-3`}>
              <Icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            <div className="text-2xl font-bold text-white tabular-nums">
              {stat.value}
              <span className={`text-base font-medium ml-0.5 ${stat.color}`}>{stat.suffix}</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
          </motion.div>
        )
      })}
    </div>
  )
}
