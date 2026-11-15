// src/pages/overlays/RoleRevealOverlay.jsx
import { useState } from 'react';
import { motion } from 'framer-motion';
import RoleCard from '../../components/RoleCard';
import Button from '../../components/Button';
import useGameStore from '../../store/gameStore';
import { setReady } from '../../services/gameService';

export default function RoleRevealOverlay() {
  const myRole    = useGameStore((s) => s.myRole);
  const myId      = useGameStore((s) => s.playerId);
  const setRoleReady = useGameStore((s) => s.setRoleReady);
  const roleReady    = useGameStore((s) => s.roleReady);
  const currentRound = useGameStore((s) => s.currentRound);

  const [flipped, setFlipped] = useState(false);

  function handleFlip() {
    setFlipped(true);
  }

  function handleReady() {
    setRoleReady(true);
    setReady();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex flex-col items-center justify-center p-6"
      style={{ background: 'rgba(10,0,30,0.92)' }}
    >
      {/* Floating particles */}
      {['✨', '⭐', '🌟'].map((star, i) => (
        <motion.span
          key={i}
          className="absolute text-2xl pointer-events-none"
          style={{ left: `${20 + i * 30}%`, top: `${15 + i * 10}%` }}
          animate={{ y: [0, -20, 0], opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 2 + i, repeat: Infinity, delay: i * 0.5 }}
        >
          {star}
        </motion.span>
      ))}

      <motion.div
        initial={{ scale: 0.8, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 20 }}
        className="text-center"
      >
        <div className="mb-2">
          <span className="text-xs font-mono text-violet-400 uppercase tracking-widest">Round {currentRound}</span>
        </div>
        <h2 className="text-3xl font-black text-white mb-2">Your Secret Role</h2>
        <p className="text-white/50 text-sm mb-8">
          {flipped ? 'Remember — keep it secret! 🤫' : 'Tap the card to reveal your role'}
        </p>

        <div className="flex justify-center mb-8">
          <RoleCard role={myRole} onFlip={handleFlip} />
        </div>

        <AnimateButton show={flipped && !roleReady}>
          <Button
            variant="gold"
            size="lg"
            onClick={handleReady}
          >
            ✅ I'm Ready!
          </Button>
        </AnimateButton>

        {roleReady && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-green-400 font-semibold"
          >
            ✅ Marked as ready — waiting for others…
          </motion.p>
        )}
      </motion.div>
    </motion.div>
  );
}

function AnimateButton({ show, children }) {
  if (!show) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      {children}
    </motion.div>
  );
}

