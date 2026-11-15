// src/pages/overlays/RoundResultOverlay.jsx
import { motion } from 'framer-motion';
import Button from '../../components/Button';
import PlayerVideo from '../../components/PlayerVideo';
import useGameStore from '../../store/gameStore';
import { nextRound } from '../../services/gameService';

const ROLE_META = {
  King:    { icon: '👑', color: '#f59e0b' },
  Queen:   { icon: '💎', color: '#ec4899' },
  Mantri:  { icon: '📜', color: '#3b82f6' },
  Soldier: { icon: '⚔️',  color: '#10b981' },
  Police:  { icon: '🔵', color: '#6366f1' },
  Thief:   { icon: '🗡️',  color: '#dc2626' },
};

export default function RoundResultOverlay() {
  const roundResult   = useGameStore((s) => s.roundResult);
  const players       = useGameStore((s) => s.players);
  const isHost        = useGameStore((s) => s.isHost);
  const currentRound  = useGameStore((s) => s.currentRound);
  const totalRounds   = useGameStore((s) => s.totalRounds);
  const localStream   = useGameStore((s) => s.localStream);
  const remoteStreams = useGameStore((s) => s.remoteStreams);

  if (!roundResult) return null;

  const { correct, policeId, thiefId, guessedId, revealedRoles, points } = roundResult;

  function getPlayer(id) {
    return players.find((p) => p.id === id);
  }

  function getRoleMeta(id) {
    const r = revealedRoles?.find((r) => r.id === id);
    return r ? ROLE_META[r.role] || {} : {};
  }

  function getRoleName(id) {
    const r = revealedRoles?.find((r) => r.id === id);
    return r?.role || '?';
  }

  const isGameOver = currentRound >= totalRounds;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      style={{ background: 'rgba(10,0,30,0.92)' }}
    >
      <motion.div
        initial={{ scale: 0.88, y: 25 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 18 }}
        className="w-full max-w-3xl glass rounded-3xl overflow-hidden flex flex-col max-h-[92vh] shadow-2xl border border-white/20"
      >
        {/* Result banner (fixed top) */}
        <div
          className={`py-4 sm:py-5 px-6 text-center shrink-0 ${
            correct ? 'bg-green-900/70 border-b border-green-500/30' : 'bg-red-900/70 border-b border-red-500/30'
          }`}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 12, delay: 0.15 }}
            className="text-4xl sm:text-5xl mb-1"
          >
            {correct ? '✅' : '❌'}
          </motion.div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-wide">
            {correct ? 'Police Got It Right!' : 'Thief Escapes!'}
          </h2>
          <p className="text-white/80 text-xs sm:text-sm mt-0.5">
            {correct
              ? `${getPlayer(policeId)?.name || 'Police'} identified the Thief!`
              : `${getPlayer(policeId)?.name || 'Police'} guessed ${guessedId ? getPlayer(guessedId)?.name : 'nobody'} — wrong!`
            }
          </p>
        </div>

        {/* Revealed roles grid (scrollable middle) */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-xs font-bold text-white/60 uppercase tracking-widest">
              Everyone's Role Revealed
            </h3>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white/10 text-violet-300">
              Round {currentRound} of {totalRounds}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
            {players.map((player, i) => {
              const meta = getRoleMeta(player.id);
              const roleName = getRoleName(player.id);
              const earned = points?.[player.id] ?? 0;
              const isPolice = player.id === policeId;
              const isThief  = player.id === thiefId;
              const stream = player.isLocal ? localStream : (remoteStreams && remoteStreams[player.id]);

              return (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.06 }}
                  className={`
                    glass-dark rounded-2xl p-2.5 sm:p-3 flex flex-col items-center gap-1.5 text-center relative
                    transition-all duration-200
                    ${isPolice ? 'ring-2 ring-indigo-400/80 bg-indigo-950/40' : ''}
                    ${isThief  ? 'ring-2 ring-red-400/80 bg-red-950/40' : ''}
                  `}
                >
                  {/* Badges */}
                  {isThief && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[11px] px-2.5 py-0.5 rounded-full font-bold shadow-md z-10 animate-bounce">
                      Thief!
                    </span>
                  )}
                  {isPolice && !isThief && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[11px] px-2.5 py-0.5 rounded-full font-bold shadow-md z-10">
                      Police
                    </span>
                  )}

                  {/* Live Camera Video Feed (replaces static profile avatar) */}
                  <PlayerVideo
                    player={player}
                    stream={stream}
                    size="md"
                    rounded="rounded-2xl"
                    className="shadow-md"
                  />

                  {/* Player Name & Role */}
                  <div className="min-w-0 w-full mt-0.5">
                    <p className="text-xs sm:text-sm font-bold text-white truncate px-1">
                      {player.name}
                      {player.isLocal && <span className="text-violet-300 ml-1 text-xs font-normal">(You)</span>}
                    </p>
                    <div className="flex items-center justify-center gap-1 mt-0.5">
                      <span className="text-sm">{meta.icon}</span>
                      <span className="text-xs font-semibold" style={{ color: meta.color || '#ffffff' }}>
                        {roleName}
                      </span>
                    </div>
                  </div>

                  {/* Earned Points */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: i * 0.06 + 0.3, type: 'spring' }}
                    className={`text-sm sm:text-base font-black tabular-nums ${
                      earned > 0 ? 'text-amber-400 drop-shadow' : 'text-white/40'
                    }`}
                  >
                    +{earned} pts
                  </motion.div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Pinned Bottom Action Bar (always visible) */}
        <div className="p-3.5 sm:p-4 bg-black/40 border-t border-white/10 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-white/50 hidden sm:block">
            {isGameOver ? 'All rounds complete!' : `Next: Round ${currentRound + 1} of ${totalRounds}`}
          </div>

          <div className="flex items-center gap-2.5 mx-auto sm:mx-0">
            <Button
              variant="gold"
              size="md"
              className="px-6 sm:px-8 py-2.5 font-bold shadow-lg"
              onClick={nextRound}
            >
              {isGameOver ? '🏆 View Final Leaderboard' : '▶️ Start Next Round'}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
