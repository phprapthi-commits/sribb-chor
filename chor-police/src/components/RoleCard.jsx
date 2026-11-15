// src/components/RoleCard.jsx
// Animated card-flip that reveals the player's role.

import { useState } from 'react';
import { motion } from 'framer-motion';

const ROLE_COLORS = {
  King:    { from: '#78350f', to: '#d97706', accent: '#fbbf24' },
  Queen:   { from: '#831843', to: '#db2777', accent: '#f9a8d4' },
  Mantri:  { from: '#1e3a5f', to: '#2563eb', accent: '#93c5fd' },
  Soldier: { from: '#064e3b', to: '#059669', accent: '#6ee7b7' },
  Police:  { from: '#312e81', to: '#4f46e5', accent: '#a5b4fc' },
  Thief:   { from: '#7f1d1d', to: '#dc2626', accent: '#fca5a5' },
};

export default function RoleCard({ role, onFlip }) {
  const [flipped, setFlipped] = useState(false);
  const colors = ROLE_COLORS[role?.name] || ROLE_COLORS.King;

  function handleFlip() {
    if (!flipped) {
      setFlipped(true);
      onFlip?.();
    }
  }

  return (
    <div
      className="card-flip-container w-56 h-80 cursor-pointer select-none"
      onClick={handleFlip}
      onKeyDown={(e) => e.key === 'Enter' && handleFlip()}
      tabIndex={0}
      aria-label={flipped ? `Your role: ${role?.name}` : 'Click to reveal your role'}
      role="button"
    >
      <div className={`card-flip-inner w-full h-full ${flipped ? 'flipped' : ''}`}>
        {/* Front (unrevealed) */}
        <div className="card-front rounded-3xl overflow-hidden">
          <div className="w-full h-full flex flex-col items-center justify-center gap-4
            bg-gradient-to-br from-purple-900 to-violet-800
            border-2 border-violet-500/50"
          >
            <div className="text-6xl float-anim">🃏</div>
            <p className="text-white/60 text-sm font-medium">Tap to reveal</p>
            <div className="shimmer absolute inset-0 rounded-3xl" />
          </div>
        </div>

        {/* Back (revealed) */}
        <div
          className="card-back rounded-3xl overflow-hidden border-2"
          style={{ borderColor: colors.accent + '80' }}
        >
          <div
            className="w-full h-full flex flex-col items-center justify-center gap-4 p-6 text-center"
            style={{ background: `linear-gradient(135deg, ${colors.from}, ${colors.to})` }}
          >
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={flipped ? { scale: 1, rotate: 0 } : {}}
              transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.2 }}
              className="text-7xl"
            >
              {role?.icon}
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={flipped ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.5, duration: 0.4 }}
            >
              <div className="text-2xl font-black text-white mb-2">{role?.name}</div>
              <div className="text-sm text-white/80 leading-snug">{role?.description}</div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
