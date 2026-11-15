// src/components/ScoreBoard.jsx
import { motion } from 'framer-motion';
import useGameStore from '../store/gameStore';
import Avatar from './Avatar';

export default function ScoreBoard({ className = '' }) {
  const players = useGameStore((s) => s.players);
  const scores = useGameStore((s) => s.scores);
  const currentRound = useGameStore((s) => s.currentRound);
  const totalRounds = useGameStore((s) => s.totalRounds);

  const ranked = [...players]
    .map((p) => ({ ...p, total: scores[p.id] || 0 }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className={`glass rounded-2xl overflow-hidden ${className}`}>
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/80">🏆 Scores</h3>
        {currentRound > 0 && (
          <span className="text-xs text-violet-300">
            Round {currentRound}/{totalRounds}
          </span>
        )}
      </div>
      <div className="p-2 space-y-1">
        {ranked.map((player, i) => (
          <motion.div
            key={player.id}
            layout
            className="flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-white/5 transition"
          >
            <span className="text-xs text-white/40 w-5 text-right font-mono">{i + 1}.</span>
            <Avatar name={player.name} emoji={player.avatar} size="xs" />
            <span className="flex-1 text-sm text-white truncate">
              {player.name}
              {player.isLocal && <span className="text-violet-400 ml-1 text-xs">(you)</span>}
            </span>
            <motion.span
              key={player.total}
              initial={{ scale: 1.3, color: '#a78bfa' }}
              animate={{ scale: 1, color: '#ffffff' }}
              transition={{ duration: 0.5 }}
              className="text-sm font-bold tabular-nums"
            >
              {player.total}
            </motion.span>
          </motion.div>
        ))}
        {ranked.length === 0 && (
          <p className="text-xs text-white/30 text-center py-4">No scores yet</p>
        )}
      </div>
    </div>
  );
}

