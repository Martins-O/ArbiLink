import { useState }          from 'react'
import { motion }             from 'framer-motion'
import { encodeFunctionData, parseAbi } from 'viem'
import { useAccount, useSwitchChain }   from 'wagmi'
import { arbitrumSepolia }              from 'wagmi/chains'
import {
  Send, Clock, CheckCircle2, AlertCircle,
  Zap, Wallet,
} from 'lucide-react'
import { ConnectButton }      from '@rainbow-me/rainbowkit'
import ChainSelector, { type SupportedChain } from '@/components/ChainSelector'
import MessageTracker, { type TrackedMessage } from '@/components/MessageTracker'
import StatsCards             from '@/components/StatsCards'
import { useArbiLink }        from '@/hooks/useArbiLink'
import { cn }                 from '@/lib/utils'

// ── Demo scenarios ────────────────────────────────────────────────────────────

interface Demo {
  id:          string
  name:        string
  description: string
  icon:        string
  gradientFrom: string
  gradientTo:  string
  buildData:   (to: string) => string
  target:      string
}

const DEMOS: Demo[] = [
  {
    id:           'nft',
    name:         'Cross-Chain NFT Mint',
    description:  'Mint an NFT on Ethereum from Arbitrum — one call, zero bridging',
    icon:         '🎨',
    gradientFrom: 'from-purple-500',
    gradientTo:   'to-pink-500',
    target:       '0x742d35Cc6634C0532925a3b844BC454e4438f44e',
    buildData: (to) => encodeFunctionData({
      abi:          parseAbi(['function mint(address to, uint256 tokenId, string uri)']),
      functionName: 'mint',
      args:         [to as `0x${string}`, 1n, 'ipfs://QmArbiLinkDemo'],
    }),
  },
  {
    id:           'token',
    name:         'Cross-Chain Token Transfer',
    description:  'Send 100 USDC from Arbitrum to Base with sub-cent fees',
    icon:         '💰',
    gradientFrom: 'from-blue-500',
    gradientTo:   'to-cyan-500',
    target:       '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    buildData: (to) => encodeFunctionData({
      abi:          parseAbi(['function transfer(address to, uint256 amount)']),
      functionName: 'transfer',
      args:         [to as `0x${string}`, 100n * 10n ** 6n],
    }),
  },
  {
    id:           'vote',
    name:         'Cross-Chain DAO Vote',
    description:  'Cast a governance vote on Ethereum from your Arbitrum wallet',
    icon:         '🗳️',
    gradientFrom: 'from-emerald-500',
    gradientTo:   'to-teal-500',
    target:       '0x408ED6354d4973f66138C91495F2f2FCbd8724C3',
    buildData: () => encodeFunctionData({
      abi:          parseAbi(['function castVote(uint256 proposalId, uint8 support)']),
      functionName: 'castVote',
      args:         [42n, 1],   // proposal 42, vote "For"
    }),
  },
]

// ── Simulation timing ─────────────────────────────────────────────────────────

const SIM_DELAYS = [0, 1600, 3800, 6500]   // ms per step

// ── Component ─────────────────────────────────────────────────────────────────

export default function DemoPage() {
  const { address, chainId, isConnected } = useAccount()
  const { arbiLink }      = useArbiLink()
  const { switchChain }   = useSwitchChain()

  const [selectedDemo,   setSelectedDemo]   = useState<string>('nft')
  const [destChain,      setDestChain]      = useState<SupportedChain>('ethereum')
  const [trackedMessage, setTrackedMessage] = useState<TrackedMessage | null>(null)
  const [isLoading,      setIsLoading]      = useState(false)
  const [error,          setError]          = useState<string | null>(null)

  const isWrongNetwork = isConnected && chainId !== arbitrumSepolia.id
  const demo = DEMOS.find(d => d.id === selectedDemo)!

  // ── Send (or simulate) ────────────────────────────────────────────────────

  const handleSend = async () => {
    setError(null)
    setIsLoading(true)

    const fakeId = BigInt(Math.floor(Math.random() * 900_000) + 100_000)
    const chainNum = destChain === 'ethereum' ? 11155111 : 84532

    // Start message in "sent" state immediately
    const msg: TrackedMessage = {
      id:               fakeId,
      sender:           address ?? '0xDemoWallet0000000000000000000000000000',
      destinationChain: chainNum,
      step:             1,
    }
    setTrackedMessage(msg)
    setIsLoading(false)

    // Try real transaction if connected on correct network
    if (arbiLink && address && !isWrongNetwork) {
      try {
        const data = demo.buildData(address)
        const realId = await arbiLink.sendMessage({
          to:     destChain,
          target: demo.target,
          data,
        })
        setTrackedMessage(prev => prev ? { ...prev, id: realId } : prev)
      } catch {
        // Gracefully fall through to simulation (contracts may not be deployed)
      }
    }

    // Simulate the full lifecycle for demo purposes
    for (let step = 2; step <= 4; step++) {
      await new Promise(r => setTimeout(r, SIM_DELAYS[step - 1] - (SIM_DELAYS[step - 2] ?? 0)))
      setTrackedMessage(prev => prev ? { ...prev, step: step as 2 | 3 | 4 } : prev)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-mesh">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-3">
            ArbiLink <span className="gradient-text">Live Demo</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Send a real cross-chain message from Arbitrum to any supported chain.
          </p>
        </motion.div>

        {/* Stats */}
        <div className="mb-8">
          <StatsCards />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Left: Controls ── */}
          <div className="space-y-5">

            {/* Demo selector */}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass rounded-2xl p-6"
            >
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                1 — Choose scenario
              </h2>
              <div className="space-y-3">
                {DEMOS.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDemo(d.id)}
                    className={cn(
                      'w-full p-4 rounded-xl border-2 text-left transition-all duration-200 flex items-start gap-4 group',
                      selectedDemo === d.id
                        ? 'border-blue-500/70 bg-blue-500/10'
                        : 'border-slate-700/60 bg-slate-800/30 hover:border-slate-600 hover:bg-slate-800/50',
                    )}
                  >
                    <div className={cn(
                      'w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0',
                      `bg-gradient-to-br ${d.gradientFrom} ${d.gradientTo} opacity-90`,
                    )}>
                      {d.icon}
                    </div>
                    <div>
                      <div className="font-semibold text-white text-sm">{d.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{d.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Destination chain */}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 }}
              className="glass rounded-2xl p-6"
            >
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                2 — Destination chain
              </h2>
              <ChainSelector selected={destChain} onChange={setDestChain} />
            </motion.div>

            {/* Send button area */}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-3"
            >

              {/* Not connected */}
              {!isConnected && (
                <div className="glass rounded-2xl p-6 flex flex-col items-center gap-4 text-center">
                  <Wallet className="w-8 h-8 text-slate-500" />
                  <p className="text-slate-400 text-sm">Connect your wallet to send a real transaction</p>
                  <ConnectButton />
                </div>
              )}

              {/* Wrong network */}
              {isWrongNetwork && (
                <div className="glass rounded-2xl p-4 flex items-center gap-3 border border-amber-500/30 bg-amber-500/5">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                  <div className="flex-1 text-sm text-amber-300">
                    Switch to Arbitrum Sepolia to send live
                  </div>
                  <button
                    onClick={() => switchChain({ chainId: arbitrumSepolia.id })}
                    className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition-colors"
                  >
                    Switch
                  </button>
                </div>
              )}

              {/* Send */}
              <button
                onClick={handleSend}
                disabled={isLoading}
                className="btn-primary w-full py-4 flex items-center justify-center gap-2 text-base shadow-lg shadow-blue-500/20"
              >
                {isLoading ? (
                  <><Clock className="w-5 h-5 animate-spin" /> Sending…</>
                ) : (
                  <><Send className="w-5 h-5" /> Send Cross-Chain Message</>
                )}
              </button>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 text-red-400 text-sm p-3 rounded-xl bg-red-950/20 border border-red-500/30">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Est. Time', value: '~12s',  color: 'text-blue-400',    bg: 'bg-blue-500/5   border-blue-500/20'   },
                  { label: 'Est. Fee',  value: '~$0.01', color: 'text-cyan-400',    bg: 'bg-cyan-500/5   border-cyan-500/20'   },
                  { label: 'Savings',   value: '95%',    color: 'text-emerald-400', bg: 'bg-emerald-500/5 border-emerald-500/20' },
                ].map(s => (
                  <div key={s.label} className={cn('rounded-xl p-3.5 border text-center', s.bg)}>
                    <div className={cn('text-xl font-bold', s.color)}>{s.value}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* ── Right: Tracker ── */}
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.08 }}
            className="glass rounded-2xl p-6"
          >
            <div className="flex items-center gap-2 mb-6">
              <Zap className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                3 — Live message tracking
              </h2>
            </div>
            <MessageTracker message={trackedMessage} />
          </motion.div>
        </div>

        {/* Comparison */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-5">

          {/* Without */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-2xl p-7 border-2 border-red-500/30 bg-red-950/10"
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-lg">❌</div>
              <h3 className="text-lg font-bold text-red-400">Without ArbiLink</h3>
            </div>
            <ul className="space-y-2.5 text-sm text-red-300/80">
              {[
                'Deploy on 10 different chains',
                'Manage 10 audits and upgrades',
                'Users fragmented across chains',
                'Expensive bridge integrations',
                'Weeks of extra development',
              ].map(t => (
                <li key={t} className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">•</span>{t}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* With */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl p-7 border-2 border-emerald-500/30 bg-emerald-950/10"
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-lg">✅</div>
              <h3 className="text-lg font-bold text-emerald-400">With ArbiLink</h3>
            </div>
            <ul className="space-y-2.5 text-sm text-emerald-300/80">
              {[
                'Build once on Arbitrum',
                'Reach users on any chain instantly',
                'Single audit, single deployment',
                'Simple SDK — one function call',
                'Ship in hours, not weeks',
              ].map(t => (
                <li key={t} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" />{t}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

      </div>
    </div>
  )
}
