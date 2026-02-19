import { Link }           from 'react-router-dom'
import { motion }          from 'framer-motion'
import { ArrowRight, Zap, Shield, Globe, Code2, Lock, Layers } from 'lucide-react'

// ── Hero chain animation ──────────────────────────────────────────────────────

const CHAINS = [
  { name: 'Arbitrum', logo: '🔷', x: '10%',  y: '50%',  primary: true  },
  { name: 'Ethereum', logo: '⟠',  x: '70%',  y: '18%',  primary: false },
  { name: 'Base',     logo: '🔵', x: '85%',  y: '55%',  primary: false },
  { name: 'Polygon',  logo: '⬟',  x: '65%',  y: '80%',  primary: false },
  { name: 'Optimism', logo: '🔴', x: '45%',  y: '12%',  primary: false },
]

const FLOWS = [
  { from: 0, to: 1 }, { from: 0, to: 2 },
  { from: 0, to: 3 }, { from: 0, to: 4 },
]

// ── Steps ─────────────────────────────────────────────────────────────────────

const HOW_STEPS = [
  {
    n: '01',
    title: 'Send from Arbitrum',
    desc:  'Call sendMessage() on the MessageHub with your target chain, contract address, and encoded calldata. Pay a small fee.',
    icon:  Send,
    color: 'blue',
  },
  {
    n: '02',
    title: 'Relayer Picks Up',
    desc:  'A staked relayer detects the MessageSent event and calls receiveMessage() on the destination chain with an ECDSA proof.',
    icon:  Zap,
    color: 'violet',
  },
  {
    n: '03',
    title: 'Executed & Secured',
    desc:  'The receiver verifies the proof, executes the call, and a 5-minute optimistic challenge window opens. Anyone can dispute fraudulent relays.',
    icon:  Shield,
    color: 'emerald',
  },
]

// ── Features ──────────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: Code2,  title: 'One SDK Call',       desc: 'sendMessage() is all you need. No bridge config, no token wrapping, no chain-specific logic.' },
  { icon: Shield, title: 'Optimistic Security',desc: 'Relayers stake ETH. Fraudulent delivery gets slashed. You keep the incentives honest.' },
  { icon: Globe,  title: 'Any EVM Chain',       desc: 'Register any EVM destination via add_chain(). Ethereum, Base, Polygon, Optimism — and more.' },
  { icon: Zap,    title: 'Arbitrum Stylus',     desc: 'The hub is built in Rust on Stylus — 10x cheaper execution than an equivalent Solidity contract.' },
  { icon: Lock,   title: 'Replay Protection',   desc: 'Every message hash is stored. Replay attacks always revert, protecting the destination contract.' },
  { icon: Layers, title: 'Execute Anything',    desc: 'Encode any function call. Mint NFTs, transfer tokens, cast votes — all cross-chain.' },
]

function Send(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <div className="overflow-x-hidden">

      {/* ── Hero ── */}
      <section className="relative min-h-[88vh] flex flex-col items-center justify-center px-4 text-center overflow-hidden">

        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-blue-600/8 blur-[120px]" />
          <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] rounded-full bg-violet-600/6 blur-[100px]" />
        </div>

        {/* Chain network SVG */}
        <div className="absolute inset-0 pointer-events-none opacity-30">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {FLOWS.map(({ from, to }, i) => {
              const f = CHAINS[from], t = CHAINS[to]
              return (
                <motion.line
                  key={i}
                  x1={f.x} y1={f.y} x2={t.x} y2={t.y}
                  stroke="url(#lineGrad)"
                  strokeWidth="0.3"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 1.5, delay: i * 0.3, ease: 'easeOut' }}
                />
              )
            })}
            <defs>
              <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor="#3b82f6" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.8" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Content */}
        <motion.div
          className="relative z-10 max-w-4xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 text-sm font-medium mb-6">
            <Zap className="w-3.5 h-3.5" />
            Built on Arbitrum Stylus · Hackathon 2026
          </div>

          <h1 className="text-5xl sm:text-7xl font-black text-white leading-[1.05] tracking-tight mb-6">
            Cross-chain messaging
            <br />
            <span className="gradient-text">from Arbitrum.</span>
          </h1>

          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Send messages from Arbitrum to any EVM chain with a single function call.
            No bridges. No wrapped tokens. Just{' '}
            <code className="font-mono text-blue-300 bg-blue-950/60 px-1.5 py-0.5 rounded text-lg">sendMessage()</code>.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/demo"
              className="btn-primary inline-flex items-center gap-2 text-base shadow-xl shadow-blue-500/25"
            >
              Try the Demo
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="https://github.com/Martins-O/ArbiLink"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-slate-700 bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 hover:text-white font-semibold transition-all text-base"
            >
              View on GitHub
            </a>
          </div>
        </motion.div>

        {/* Chain nodes */}
        {CHAINS.map((chain, i) => (
          <motion.div
            key={chain.name}
            className="absolute hidden lg:flex flex-col items-center gap-1.5"
            style={{ left: chain.x, top: chain.y, transform: 'translate(-50%, -50%)' }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 + i * 0.15, type: 'spring' }}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl
              ${chain.primary
                ? 'bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-500/40'
                : 'glass border border-slate-700'
              }`}
            >
              {chain.logo}
            </div>
            <span className="text-xs text-slate-500 font-medium">{chain.name}</span>
          </motion.div>
        ))}
      </section>

      {/* ── How it works ── */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">How it works</h2>
            <p className="text-slate-400">Three steps from intent to execution</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {HOW_STEPS.map((step, i) => {
              const Icon = step.icon
              const colors: Record<string, string> = {
                blue:    'from-blue-500/20 to-blue-600/5   border-blue-500/30   text-blue-400',
                violet:  'from-violet-500/20 to-violet-600/5 border-violet-500/30 text-violet-400',
                emerald: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/30 text-emerald-400',
              }
              const cls = colors[step.color]
              return (
                <motion.div
                  key={step.n}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className={`relative glass rounded-2xl p-7 bg-gradient-to-b ${cls.split(' ')[0]} ${cls.split(' ')[1]}`}
                >
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-5 bg-gradient-to-b ${cls}`}>
                    <Icon className={`w-5 h-5 ${cls.split(' ')[3]}`} />
                  </div>
                  <div className="text-4xl font-black text-slate-800 absolute top-6 right-6">{step.n}</div>
                  <h3 className="font-bold text-white text-lg mb-2">{step.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{step.desc}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-20 px-4 border-t border-slate-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">Built for builders</h2>
            <p className="text-slate-400">Everything you need to go cross-chain</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => {
              const Icon = f.icon
              return (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07 }}
                  className="glass glass-hover rounded-2xl p-6"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-blue-400" />
                  </div>
                  <h3 className="font-bold text-white mb-1.5">{f.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="glass rounded-3xl p-10 border border-blue-500/20 bg-gradient-to-b from-blue-500/5 to-transparent"
          >
            <Zap className="w-12 h-12 text-blue-400 mx-auto mb-5" />
            <h2 className="text-3xl font-bold text-white mb-3">Ready to go cross-chain?</h2>
            <p className="text-slate-400 mb-8">
              One SDK. Any chain. Zero bridges.
            </p>
            <Link to="/demo" className="btn-primary inline-flex items-center gap-2 text-base px-8 py-4 shadow-xl shadow-blue-500/30">
              Launch Demo  <ArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>
        </div>
      </section>

    </div>
  )
}
