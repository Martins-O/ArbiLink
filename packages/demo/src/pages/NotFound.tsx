import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-md"
      >
        <h1 className="text-7xl font-bold gradient-text mb-4">404</h1>
        <p className="text-xl text-slate-300 mb-8">
          This chain doesn't exist yet.
        </p>
        <Link
          to="/"
          className="button-primary inline-flex items-center gap-2 px-6 py-3"
        >
          <Home className="w-4 h-4" />
          Back Home
        </Link>
      </motion.div>
    </div>
  );
}
