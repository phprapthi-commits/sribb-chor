// src/pages/overlays/FinalLeaderboard.jsx
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Avatar from '../../components/Avatar';
import PlayerVideo from '../../components/PlayerVideo';
import Button from '../../components/Button';
import useGameStore from '../../store/gameStore';
import { leaveRoom, startGame } from '../../services/gameService';
import { stopLocalStream } from '../../services/videoService';

const MEDAL = ['🥇', '🥈', '🥉'];
const PODIUM_HEIGHTS = ['h-28 sm:h-32', 'h-20 sm:h-24', 'h-14 sm:h-16'];
const PODIUM_COLORS  = ['bg-amber-500', 'bg-gray-400', 'bg-amber-700'];

export default function FinalLeaderboard() {
  const navigate      = useNavigate();
  const players       = useGameStore((s) => s.players);
  const scores        = useGameStore((s) => s.scores);
  const totalRounds   = useGameStore((s) => s.totalRounds);
  const isHost        = useGameStore((s) => s.isHost);
  const resetGame     = useGameStore((s) => s.resetGame);
  const setPlayers    = useGameStore((s) => s.setPlayers);
  const localStream   = useGameStore((s) => s.localStream);
  const remoteStreams = useGameStore((s) => s.remoteStreams);

  const ranked = [...players]
    .map((p) => ({ ...p, total: scores[p.id] || 0 }))
    .sort((a, b) => b.total - a.total);

  const top3 = ranked.slice(0, 3);

  // Podium order: 2nd, 1st, 3rd
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);
  const podiumIdx   = [1, 0, 2];

  function handlePlayAgain() {
    resetGame();
    setPlayers([...players]); // keep same players
    startGame(totalRounds);
  }

  function handleHome() {
    stopLocalStream();
    leaveRoom();
    useGameStore.getState().fullReset();
    navigate('/');
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6"
      style={{ background: 'rgba(10,0,30,0.95)' }}
    >
      {/* Confetti particles */}
      {['🎊', '🎉', '⭐', '✨', '🌟', '🏆'].map((e, i) => (
        <motion.span
          key={i}
          className="absolute text-3xl pointer-events-none select-none"
          style={{ left: `${5 + i * 15}%`, top: `${5 + (i % 3) * 20}%` }}
          animate={{ y: [0, -30, 0], rotate: [0, 20, -20, 0], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2 + i * 0.4, repeat: Infinity, delay: i * 0.3 }}
        >
          {e}
        </motion.span>
      ))}

      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 18 }}
        className="w-full max-w-2xl glass rounded-3xl overflow-hidden max-h-[92vh] flex flex-col shadow-2xl border border-white/20"
      >
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          <div className="text-center mb-6">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-5xl sm:text-6xl mb-2"
            >
              🏆
            </motion.div>
            <h1 className="text-3xl sm:text-4xl font-black text-white">Game Over!</h1>
            <p className="text-white/60 text-xs sm:text-sm mt-1">Final Kingdom Rankings</p>
          </div>

          {/* Podium */}
          {top3.length >= 1 && (
            <div className="flex items-end justify-center gap-2 sm:gap-4 mb-8">
              {podiumOrder.map((player, idx) => {
                const rank = podiumIdx[idx];
                const stream = player.isLocal ? localStream : (remoteStreams && remoteStreams[player.id]);
                return (
                  <motion.div
                    key={player.id}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ delay: 0.2 + idx * 0.1, type: 'spring', damping: 15 }}
                    className="flex flex-col items-center gap-1.5"
                    style={{ transformOrigin: 'bottom' }}
                  >
                    {rank === 0 && (
                      <motion.div
                        animate={{ rotate: [-5, 5, -5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="text-2xl sm:text-3xl"
                      >
                        👑
                      </motion.div>
                    )}
                    <PlayerVideo
                      player={player}
                      stream={stream}
                      avatarSize={rank === 0 ? 'lg' : 'md'}
                      className={rank === 0 ? 'w-20 h-20 sm:w-24 sm:h-24 ring-2 ring-amber-400' : 'w-16 h-16 sm:w-18 sm:h-18'}
                    />
                    <span className="text-xs text-white font-bold truncate max-w-[90px]">{player.name}</span>
                    <span className="text-amber-400 font-black text-xs sm:text-sm tabular-nums">{player.total} pts</span>
                    <div
                      className={`
                        w-20 sm:w-24 ${PODIUM_HEIGHTS[rank]} ${PODIUM_COLORS[rank]}
                        rounded-t-2xl flex items-start justify-center pt-2
                        podium-bar shadow-lg
                      `}
                      style={{ animationDelay: `${0.2 + idx * 0.1}s` }}
                    >
                      <span className="text-2xl">{MEDAL[rank]}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Full ranking table */}
          <div className="glass-dark rounded-2xl overflow-hidden mb-2">
            {ranked.map((player, i) => (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.05 }}
                className={`flex items-center gap-3 px-4 py-2.5 ${i < ranked.length - 1 ? 'border-b border-white/5' : ''} ${player.isLocal ? 'bg-violet-900/30' : ''}`}
              >
                <span className="text-base sm:text-lg w-7 text-center font-bold">{MEDAL[i] || `${i + 1}.`}</span>
                <Avatar name={player.name} emoji={player.avatar} size="xs" />
                <span className="flex-1 text-sm font-semibold text-white truncate">
                  {player.name}
                  {player.isLocal && <span className="text-violet-400 ml-1 text-xs">(You)</span>}
                </span>
                <span className="font-black text-amber-400 tabular-nums text-sm">{player.total} pts</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Action buttons (Sticky pinned footer) */}
        <div className="p-4 border-t border-white/10 bg-black/60 backdrop-blur-md flex flex-wrap gap-3 justify-center shrink-0">
          <Button variant="gold" size="lg" className="px-6 font-black" onClick={handlePlayAgain}>
            🔄 Start Next Game
          </Button>
          <Button variant="secondary" size="lg" className="px-6" onClick={handleHome}>
            🏠 Main Menu
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
