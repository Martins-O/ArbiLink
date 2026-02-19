import { Link, useLocation }   from 'react-router-dom'
import { ConnectButton }        from '@rainbow-me/rainbowkit'
import { Zap }                  from 'lucide-react'
import { cn }                   from '@/lib/utils'

const LINKS = [
  { to: '/',         label: 'Home'     },
  { to: '/demo',     label: 'Demo'     },
  { to: '/explorer', label: 'Explorer' },
]

export default function Navbar() {
  const { pathname } = useLocation()

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-[#030712]/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-8">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center glow-blue">
            <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-lg tracking-tight">
            Arbi<span className="gradient-text">Link</span>
          </span>
        </Link>

        {/* Nav links */}
        <nav className="hidden sm:flex items-center gap-1 flex-1">
          {LINKS.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                pathname === to
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60',
              )}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Wallet connect */}
        <div className="ml-auto">
          <ConnectButton
            showBalance={false}
            chainStatus="icon"
            accountStatus="avatar"
          />
        </div>
      </div>
    </header>
  )
}
