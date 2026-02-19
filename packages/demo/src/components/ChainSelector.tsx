import type { Chain, ChainName } from '../lib/types';

interface ChainSelectorProps {
  chains: Chain[];
  selected: ChainName;
  onChange: (chain: ChainName) => void;
}

export function ChainSelector({ chains, selected, onChange }: ChainSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {chains.map((chain) => {
        const isSelected = selected === chain.id;
        return (
          <button
            key={chain.id}
            onClick={() => onChange(chain.id)}
            className={`relative p-4 rounded-xl border-2 text-left transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] ${
              isSelected
                ? chain.color
                : 'border-slate-700 bg-slate-800/40 hover:border-slate-600 hover:bg-slate-800/60'
            }`}
          >
            {isSelected && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.8)]" />
            )}
            <div className="text-2xl mb-2 leading-none">{chain.icon}</div>
            <div className="font-semibold text-white text-sm">{chain.name}</div>
          </button>
        );
      })}
    </div>
  );
}
