// src/pages/overlays/RoundResultOverlay.jsx
import { motion } from 'framer-motion';
import PlayerVideo from '../../components/PlayerVideo';
import Button from '../../components/Button';
import useGameStore from '../../store/gameStore';
import { nextRound } from '../../services/gameService';

const ROLE_META = {
  King: { icon: '👑', color: '#f59e0b' },
  Queen: { icon: '💎', color: '#ec4899' },
  Mantri: { icon: '📜', color: '#3b82f6' },
  Soldier: { icon: '⚔️', color: '#10b981' },
  Police: { icon: '🔵', color: '#6366f1' },
  Thief: { icon: '🗡️', color: '#dc2626' },
};

export default function RoundResultOverlay() {
  const roundResult = useGameStore((s) => s.roundResult);
  const players = useGameStore((s) => s.players);
  const isHost = useGameStore((s) => s.isHost);
  const currentRound = useGameStore((s) => s.currentRound);
  const totalRounds = useGameStore((s) => s.totalRounds);
  const localStream = useGameStore((s) => s.localStream);
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
      className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6"
      style={{ background: 'rgba(10,0,30,0.92)' }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 20 }}
        className="w-full max-w-4xl glass rounded-3xl overflow-hidden max-h-[92vh] flex flex-col shadow-2xl border border-white/20"
      >
        {/* Result banner (Fixed Header) */}
        <div
          className={`py-4 px-6 text-center shrink-0 ${correct ? 'bg-green-950/70 border-b border-green-500/30' : 'bg-red-950/70 border-b border-red-500/30'}`}
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-3xl">{correct ? '✅' : '❌'}</span>
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              {correct ? 'Police Got It Right!' : 'Thief Escapes!'}
            </h2>
          </div>
          <p className="text-white/70 text-xs sm:text-sm">
            {correct
              ? `${getPlayer(policeId)?.name || 'Police'} correctly identified the Thief 🎉`
              : `${getPlayer(policeId)?.name || 'Police'} guessed ${guessedId ? (getPlayer(guessedId)?.name || 'suspect') : 'nobody'} — wrong!`
            }
          </p>
        </div>

        {/* Revealed roles (Scrollable Body) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs sm:text-sm font-bold text-white/70 uppercase tracking-widest">
              Live Role Reveal
            </h3>
            <span className="text-xs font-mono px-3 py-1 rounded-full bg-violet-600/30 text-violet-300 border border-violet-500/30">
              Round {currentRound} of {totalRounds}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            {players.map((player, i) => {
              const meta = getRoleMeta(player.id);
              const roleName = getRoleName(player.id);
              const earned = points?.[player.id] ?? 0;
              const isPolice = player.id === policeId;
              const isThief = player.id === thiefId;
              const stream = player.isLocal ? localStream : (remoteStreams && remoteStreams[player.id]);

              return (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className={`
                    glass-dark rounded-2xl p-3 sm:p-4 flex flex-col items-center gap-2 text-center relative
                    ${isPolice ? 'ring-2 ring-indigo-500/80 bg-indigo-950/20' : ''}
                    ${isThief ? 'ring-2 ring-red-500/80 bg-red-950/20' : ''}
                  `}
                >
                  {/* Badges */}
                  {isThief && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[11px] px-2.5 py-0.5 rounded-full font-bold shadow-md shadow-red-950/50">
                      Thief!
                    </span>
                  )}
                  {isPolice && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[11px] px-2.5 py-0.5 rounded-full font-bold shadow-md shadow-indigo-950/50">
                      Police
                    </span>
                  )}

                  {/* Live Camera Video (instead of static avatar) */}
                  <PlayerVideo
                    player={player}
                    stream={stream}
                    avatarSize="lg"
                    className="w-24 h-24 sm:w-28 sm:h-28 shadow-inner"
                  />

                  <div>
                    <p className="text-sm font-bold text-white truncate max-w-[130px]">
                      {player.name} {player.isLocal && <span className="text-violet-400 font-normal text-xs">(You)</span>}
                    </p>
                    <div className="flex items-center justify-center gap-1.5 mt-0.5">
                      <span className="text-base">{meta.icon}</span>
                      <span className="text-xs font-semibold" style={{ color: meta.color || 'white' }}>
                        {roleName}
                      </span>
                    </div>
                  </div>

                  <div className={`text-base sm:text-lg font-black ${earned > 0 ? 'text-amber-400' : 'text-white/40'}`}>
                    +{earned} pts
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Action Button Bar (Fixed / Sticky Footer - Always Visible) */}
        <div className="p-4 border-t border-white/10 bg-black/60 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-white/50 text-center sm:text-left">
            {isGameOver ? 'All rounds completed! Ready for podium.' : `Ready for Round ${currentRound + 1} of ${totalRounds}?`}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="gold"
              size="lg"
              className="px-8 shadow-xl text-base font-extrabold cursor-pointer"
              onClick={() => nextRound()}
            >
              {isGameOver ? '🏆 See Final Results' : `▶️ Start Next Round (${currentRound + 1}/${totalRounds})`}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
