import { useState }     from 'react'
import { motion }        from 'framer-motion'
import { Search, Filter, Radio, Inbox } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import MessageCard, { type MockMessage } from '@/components/MessageCard'
import { cn } from '@/lib/utils'
import { useMessages } from '@/hooks/useMessages'

// ── Chart helpers ─────────────────────────────────────────────────────────────

function buildChartData(msgs: MockMessage[]) {
  const DAY_S = 86_400
  const days  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const today = Math.floor(Date.now() / 1000 / DAY_S)

  const result = Array.from({ length: 7 }, (_, i) => ({
    day:   days[new Date((today - (6 - i)) * DAY_S * 1000).getDay()],
    count: 0,
  }))

  for (const m of msgs) {
    const offset = today - Math.floor(m.timestamp / DAY_S)
    if (offset >= 0 && offset < 7) result[6 - offset].count++
  }
  return result
}

// ── Types ─────────────────────────────────────────────────────────────────────

const STATUS_FILTERS = ['all', 'pending', 'relayed', 'confirmed', 'failed'] as const
type Filter = typeof STATUS_FILTERS[number]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Explorer() {
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')

  const { messages, loading, isLive } = useMessages([])
  const chartData = buildChartData(messages)

  const filtered = messages.filter(m => {
    const matchFilter = filter === 'all' || m.status === filter
    const matchSearch = search === '' ||
      m.id.toString().includes(search) ||
      (m.sender ?? '').toLowerCase().includes(search.toLowerCase()) ||
      m.demo.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-start justify-between flex-wrap gap-3"
        >
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-1">
              Message <span className="gradient-text">Explorer</span>
            </h1>
            <p className="text-slate-400">Browse all cross-chain messages sent through ArbiLink</p>
          </div>
          <div className={cn(
            'flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border mt-1',
            isLive
              ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
              : 'text-slate-500 border-slate-700 bg-slate-800/50',
          )}>
            <Radio className={cn('w-3 h-3', isLive && 'animate-pulse')} />
            {loading ? 'Loading…' : isLive ? 'Live' : 'Connecting…'}
          </div>
        </motion.div>

        {/* Chart */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass rounded-2xl p-6 mb-6"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-white">Messages per day</h2>
              <p className="text-xs text-slate-500 mt-0.5">Last 7 days</p>
            </div>
            <span className="chain-badge text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
              {messages.length} total
            </span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} barSize={28}>
              <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  background:   '#0f172a',
                  border:       '1px solid #1e293b',
                  borderRadius: '10px',
                  color:        '#f1f5f9',
                  fontSize:     13,
                }}
                cursor={{ fill: 'rgba(59,130,246,0.06)' }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell
                    key={i}
                    fill={i === chartData.length - 1 ? '#6366f1' : '#3b82f6'}
                    opacity={0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Filters + search */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col sm:flex-row gap-3 mb-5"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by ID, sender, or type…"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700 text-slate-200 placeholder:text-slate-600 text-sm focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-colors"
            />
          </div>

          <div className="flex items-center gap-1 glass rounded-xl p-1">
            <Filter className="w-4 h-4 text-slate-500 ml-2 shrink-0" />
            {STATUS_FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all',
                  filter === f
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/60',
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Message list */}
        <div className="space-y-3">
          {loading && messages.length === 0 ? (
            <div className="text-center py-16 text-slate-600">
              <Radio className="w-10 h-10 mx-auto mb-3 opacity-40 animate-pulse" />
              <p>Fetching messages from Arbitrum Sepolia…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-600">
              <Inbox className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>{search || filter !== 'all' ? 'No messages match your search' : 'No messages yet — be the first to send one!'}</p>
            </div>
          ) : (
            filtered.map((msg, i) => (
              <MessageCard key={msg.id.toString()} message={msg} index={i} />
            ))
          )}
        </div>

        <p className="text-center text-xs text-slate-700 mt-8">
          Live data from Arbitrum Sepolia · refreshes every 30s
        </p>
      </div>
    </div>
  )
}
