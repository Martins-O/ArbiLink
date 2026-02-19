/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
      },
      animation: {
        'spin-slow':   'spin 3s linear infinite',
        'pulse-slow':  'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'flow':        'flow 3s ease-in-out infinite',
        'glow':        'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        flow: {
          '0%, 100%': { transform: 'translateX(0)', opacity: '0.4' },
          '50%':      { transform: 'translateX(6px)', opacity: '1' },
        },
        glow: {
          from: { boxShadow: '0 0 10px rgba(59, 130, 246, 0.3)' },
          to:   { boxShadow: '0 0 30px rgba(59, 130, 246, 0.8)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'mesh': 'radial-gradient(at 40% 20%, hsla(228,100%,74%,0.1) 0px, transparent 50%), radial-gradient(at 80% 0%, hsla(189,100%,56%,0.1) 0px, transparent 50%)',
      },
    },
  },
  plugins: [],
}
