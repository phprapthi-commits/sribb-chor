// src/pages/overlays/PoliceGuessOverlay.jsx
import { useState } from 'react';
import { motion } from 'framer-motion';
import PlayerVideo from '../../components/PlayerVideo';
import Timer from '../../components/Timer';
import Button from '../../components/Button';
import useGameStore from '../../store/gameStore';
import { submitGuess } from '../../services/gameService';

export default function PoliceGuessOverlay() {
  const players       = useGameStore((s) => s.players);
  const policeId      = useGameStore((s) => s.policePlayerId);
  const myId          = useGameStore((s) => s.playerId);
  const timerSeconds  = useGameStore((s) => s.timerSeconds);
  const myRole        = useGameStore((s) => s.myRole);
  const localStream   = useGameStore((s) => s.localStream);
  const remoteStreams = useGameStore((s) => s.remoteStreams);

  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const isPolice = myId === policeId;
  const policePlayer = players.find((p) => p.id === policeId);

  // The suspects the police can choose from (everyone except the police)
  const suspects = players.filter((p) => p.id !== policeId);

  function handleConfirm() {
    if (!selected || submitted) return;
    setSubmitted(true);
    submitGuess(selected);
  }

  if (!isPolice) {
    // Other players see waiting screen
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 flex flex-col items-center justify-center p-6"
        style={{ background: 'rgba(10,0,30,0.88)' }}
      >
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          className="glass rounded-3xl p-10 text-center max-w-sm w-full"
        >
          <div className="text-5xl mb-4">🔍</div>
          <h2 className="text-2xl font-black text-white mb-2">Police is Thinking…</h2>
          <p className="text-white/50 text-sm mb-6">
            {policePlayer?.name} is deciding who the thief is
          </p>
          <div className="flex justify-center">
            <Timer seconds={timerSeconds} totalSeconds={60} size="lg" />
          </div>
          {myRole && (
            <div className="mt-6 glass-dark rounded-2xl px-4 py-3 inline-flex items-center gap-2">
              <span className="text-xl">{myRole.icon}</span>
              <span className="text-sm text-white/70">
                Your role: <strong className="text-white">{myRole.name}</strong>
              </span>
            </div>
          )}
        </motion.div>
      </motion.div>
    );
  }

  // Police player view
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex flex-col items-center justify-center p-6"
      style={{ background: 'rgba(10,0,30,0.92)' }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 20 }}
        className="w-full max-w-2xl"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">🔵</div>
          <h2 className="text-3xl font-black text-white">You are the Police!</h2>
          <p className="text-white/60 text-sm mt-1">Who is the Thief? Choose wisely…</p>
        </div>

        {/* Timer */}
        <div className="flex justify-center mb-6">
          <Timer seconds={timerSeconds} totalSeconds={60} size="md" />
        </div>

        {/* Suspect grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {suspects.map((player) => (
            <motion.button
              key={player.id}
              onClick={() => !submitted && setSelected(player.id)}
              whileHover={!submitted ? { scale: 1.05 } : {}}
              whileTap={!submitted ? { scale: 0.97 } : {}}
              className={`
                glass rounded-2xl p-4 flex flex-col items-center gap-3 text-center
                transition cursor-pointer
                ${selected === player.id
                  ? 'ring-2 ring-red-400 bg-red-900/30'
                  : 'hover:bg-white/10'}
                ${submitted ? 'opacity-70 cursor-not-allowed' : ''}
              `}
            >
              <PlayerVideo
                player={player}
                stream={player.isLocal ? localStream : (remoteStreams && remoteStreams[player.id])}
                size="md"
                rounded="rounded-2xl"
              />
              <span className="text-sm font-semibold text-white">{player.name}</span>
              {selected === player.id && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-bold"
                >
                  Suspect!
                </motion.span>
              )}
            </motion.button>
          ))}
        </div>

        {/* Confirm */}
        <div className="flex justify-center">
          <Button
            variant="danger"
            size="lg"
            disabled={!selected || submitted}
            onClick={handleConfirm}
            className="px-12"
          >
            {submitted ? '⏳ Guess submitted…' : '🔵 Confirm Guess'}
          </Button>
        </div>
        {!selected && !submitted && (
          <p className="text-white/40 text-xs text-center mt-3">Select a suspect first</p>
        )}
      </motion.div>
    </motion.div>
  );
}
