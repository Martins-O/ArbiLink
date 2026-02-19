import { motion } from 'framer-motion';
import { CheckCircle2, XCircle } from 'lucide-react';
import { COMPARISON_WITHOUT, COMPARISON_WITH } from '../lib/constants';

export function ComparisonSection() {
  return (
    <section className="mt-16">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-white mb-3">Why ArbiLink?</h2>
        <p className="text-slate-400 max-w-xl mx-auto">
          Stop rebuilding the same dApp on every chain. Build once on Arbitrum, reach everyone.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Without ArbiLink */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-red-950/30 to-red-900/10 border-2 border-red-500/40 rounded-2xl p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
              <XCircle className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-2xl font-bold text-red-400">Without ArbiLink</h3>
          </div>
          <ul className="space-y-3">
            {COMPARISON_WITHOUT.map((item, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.05 }}
                className="flex items-start gap-3 text-red-300/80"
              >
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                <span>{item}</span>
              </motion.li>
            ))}
          </ul>
        </motion.div>

        {/* With ArbiLink */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-green-950/30 to-green-900/10 border-2 border-green-500/40 rounded-2xl p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-400" />
            </div>
            <h3 className="text-2xl font-bold text-green-400">With ArbiLink</h3>
          </div>
          <ul className="space-y-3">
            {COMPARISON_WITH.map((item, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.05 }}
                className="flex items-start gap-3 text-green-300/90"
              >
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span>{item}</span>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      </div>
    </section>
  );
}
