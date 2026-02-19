import { useEffect, useState } from 'react'
import { motion }               from 'framer-motion'
import { Zap, Globe, Clock, TrendingDown } from 'lucide-react'

interface Stat {
  label:  string
  value:  string
  suffix: string
  icon:   React.ElementType
  color:  string
  bg:     string
}

const BASE_STATS: Stat[] = [
  { label: 'Messages Relayed', value: '1,284',  suffix: '',   icon: Zap,          color: 'text-blue-400',    bg: 'bg-blue-500/10   border-blue-500/20'   },
  { label: 'Chains Supported', value: '4',      suffix: '',   icon: Globe,        color: 'text-violet-400',  bg: 'bg-violet-500/10 border-violet-500/20' },
  { label: 'Avg Delivery',     value: '~12',    suffix: 's',  icon: Clock,        color: 'text-cyan-400',    bg: 'bg-cyan-500/10   border-cyan-500/20'   },
  { label: 'Cost vs Bridges',  value: '-95',    suffix: '%',  icon: TrendingDown, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
]

export default function StatsCards() {
  const [count, setCount] = useState(1284)

  // Simulate live counter ticking up
  useEffect(() => {
    const t = setInterval(() => {
      setCount(c => c + Math.floor(Math.random() * 2))
    }, 4000)
    return () => clearInterval(t)
  }, [])

  const stats = BASE_STATS.map((s, i) =>
    i === 0 ? { ...s, value: count.toLocaleString() } : s,
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
