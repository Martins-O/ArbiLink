import { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, Clock, Zap, TrendingDown, Loader2, RefreshCw } from 'lucide-react';
import { MessageTracker, MessageTrackerEmpty } from '../components/MessageTracker';
import { ChainSelector } from '../components/ChainSelector';
import { ComparisonSection } from '../components/ComparisonSection';
import { useSimulation } from '../hooks/useSimulation';
import { DEMOS, CHAINS } from '../lib/constants';
import type { ChainName } from '../lib/types';

export function Demo() {
  const [selectedDemo, setSelectedDemo] = useState('nft');
  const [destination, setDestination] = useState<ChainName>('ethereum');

  const {
    isSimulating,
    messageId,
    simulationSteps,
    progress,
    startSimulation,
    resetSimulation,
  } = useSimulation();

  const done = progress >= 100;

  const chainIdFor: Record<ChainName, string> = {
    ethereum: '11155111',
    base:     '84532',
    polygon:  '80002',
    optimism: '11155420',
  };

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
            Send cross-chain messages from Arbitrum to any chain — watch the
            full lifecycle in real time.
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
                chains={CHAINS}
                selected={destination}
                onChange={setDestination}
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
                onClick={done ? resetSimulation : startSimulation}
                disabled={isSimulating}
                className="w-full button-primary flex items-center justify-center gap-2 py-4 text-base"
              >
                {isSimulating ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Sending Message…</>
                ) : done ? (
                  <><RefreshCw className="w-5 h-5" /> Send Another Message</>
                ) : (
                  <><Send className="w-5 h-5" /> Send Cross-Chain Message</>
                )}
              </button>

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
                  <span className="text-amber-400">{chainIdFor[destination]}</span>
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
                { icon: Clock,       color: 'blue',   label: 'Est. Time', value: '12s'   },
                { icon: Zap,         color: 'green',  label: 'Cost',      value: '$0.23' },
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
                  <div className="text-2xl font-bold text-white">{value}</div>
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
              {messageId ? (
                <MessageTracker
                  messageId={messageId}
                  steps={simulationSteps}
                  progress={progress}
                  destination={destination}
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
