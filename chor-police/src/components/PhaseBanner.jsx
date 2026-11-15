// src/components/PhaseBanner.jsx
import { motion, AnimatePresence } from 'framer-motion';

const PHASE_INFO = {
  'role-reveal':    { label: 'Roles Being Assigned', emoji: '🃏', color: 'from-violet-800 to-purple-900' },
  'police-guess':   { label: 'Police is Guessing!',  emoji: '🔵', color: 'from-indigo-800 to-blue-900' },
  'round-result':   { label: 'Round Result',          emoji: '🎉', color: 'from-amber-700 to-orange-900' },
  'final-leaderboard': { label: 'Game Over!',         emoji: '🏆', color: 'from-yellow-700 to-amber-900' },
};

export default function PhaseBanner({ phase }) {
  const info = PHASE_INFO[phase];
  if (!info) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={phase}
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -40, opacity: 0 }}
        transition={{ type: 'spring', damping: 20 }}
        className={`
          flex items-center justify-center gap-3 py-2 px-6 rounded-2xl
          bg-gradient-to-r ${info.color}
          border border-white/20 shadow-lg text-white font-semibold text-base
        `}
      >
        <span className="text-xl">{info.emoji}</span>
        <span>{info.label}</span>
      </motion.div>
    </AnimatePresence>
  );
}
