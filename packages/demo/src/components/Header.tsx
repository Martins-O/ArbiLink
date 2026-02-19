import { Link, useLocation } from 'react-router-dom';

const NAV_LINKS = [
  { to: '/',         label: 'Home',     internal: true  },
  { to: '/demo',     label: 'Demo',     internal: true  },
  { to: '/explorer', label: 'Explorer', internal: true  },
  { to: import.meta.env.VITE_DOCS_URL ?? 'https://docs.arbilink.dev', label: 'Docs', internal: false },
  { to: 'https://github.com/Martins-O/ArbiLink', label: 'GitHub', internal: false },
];

export function Header() {
  const { pathname } = useLocation();

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-shadow">
              AL
            </div>
            <span className="text-xl font-bold text-white">ArbiLink</span>
          </Link>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ to, label, internal }) =>
              internal ? (
                <Link
                  key={to}
                  to={to}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    pathname === to
                      ? 'text-white bg-slate-800'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  {label}
                </Link>
              ) : (
                <a
                  key={to}
                  href={to}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
                >
                  {label}
                </a>
              )
            )}
          </nav>

          {/* CTA */}
          <a
            href="https://github.com/Martins-O/ArbiLink"
            target="_blank"
            rel="noopener noreferrer"
            className="button-primary text-sm py-2 px-5"
          >
            View on GitHub
          </a>
        </div>
      </div>
    </header>
  );
}
