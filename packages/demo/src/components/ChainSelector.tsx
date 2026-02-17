import { cn } from '@/lib/utils'

export type SupportedChain = 'ethereum' | 'base'

interface Chain {
  id:          SupportedChain
  name:        string
  description: string
  logo:        string
  color:       string
  border:      string
}

const CHAINS: Chain[] = [
  {
    id:          'ethereum',
    name:        'Ethereum Sepolia',
    description: 'Slower · 15s finality',
    logo:        '⟠',
    color:       'from-blue-500/10 to-indigo-500/10',
    border:      'border-blue-500/60',
  },
  {
    id:          'base',
    name:        'Base Sepolia',
    description: 'Fast · 2s finality',
    logo:        '🔵',
    color:       'from-blue-400/10 to-cyan-400/10',
    border:      'border-cyan-500/60',
  },
]

interface ChainSelectorProps {
  selected: SupportedChain
  onChange: (chain: SupportedChain) => void
}

export default function ChainSelector({ selected, onChange }: ChainSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {CHAINS.map((chain) => {
        const isSelected = selected === chain.id
        return (
          <button
            key={chain.id}
            onClick={() => onChange(chain.id)}
            className={cn(
              'relative p-4 rounded-xl border-2 text-left transition-all duration-200 group',
              isSelected
                ? `bg-gradient-to-br ${chain.color} ${chain.border}`
                : 'border-slate-700/80 bg-slate-800/40 hover:border-slate-600 hover:bg-slate-800/60',
            )}
          >
            {isSelected && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.8)]" />
            )}
            <div className="text-2xl mb-2">{chain.logo}</div>
            <div className="font-semibold text-white text-sm">{chain.name}</div>
            <div className="text-xs text-slate-400 mt-0.5">{chain.description}</div>
          </button>
        )
      })}
    </div>
  )
}
