// src/pages/LobbyPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, Mic, MicOff, Video, VideoOff, Users, Settings, Crown, ShieldAlert } from 'lucide-react';
import Button from '../components/Button';
import PlayerVideo from '../components/PlayerVideo';
import useGameStore from '../store/gameStore';
import { startGame } from '../services/gameService';
import { getLocalStream, toggleMic, toggleCamera } from '../services/videoService';
import useGameEvents from '../hooks/useGame';

export default function LobbyPage() {
  const navigate = useNavigate();
  useGameEvents();

  const players         = useGameStore((s) => s.players);
  const isHost          = useGameStore((s) => s.isHost);
  const roomCode        = useGameStore((s) => s.roomCode);
  const totalRounds     = useGameStore((s) => s.totalRounds);
  const phase           = useGameStore((s) => s.phase);
  const setTotalRounds  = useGameStore((s) => s.setTotalRounds);
  const isMuted         = useGameStore((s) => s.isMuted);
  const isCameraOff     = useGameStore((s) => s.isCameraOff);
  const cameraPermission = useGameStore((s) => s.cameraPermission);
  const localStream     = useGameStore((s) => s.localStream);
  const remoteStreams   = useGameStore((s) => s.remoteStreams);

  const [copied, setCopied]   = useState(false);
  const [loading, setLoading] = useState(false);

  // If game started, navigate to game page
  useEffect(() => {
    if (phase !== 'lobby') {
      navigate('/game');
    }
  }, [phase, navigate]);

  // Redirect if no room
  useEffect(() => {
    if (!roomCode) navigate('/');
  }, [roomCode, navigate]);

  // Start local stream if needed
  useEffect(() => {
    if (cameraPermission === 'unknown' && !localStream) {
      getLocalStream();
    }
  }, [cameraPermission, localStream]);

  async function handleCopyCode() {
    await navigator.clipboard.writeText(roomCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleStartGame() {
    setLoading(true);
    startGame(totalRounds);
  }

  const slots = Array(6).fill(null).map((_, i) => players[i] || null);

  return (
    <div className="min-h-screen flex flex-col items-center p-4 sm:p-6 relative">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-64 bg-violet-900/30 blur-3xl" />
      </div>

      <div className="w-full max-w-5xl relative z-10">
        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-6 pt-2"
        >
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-1 flex items-center justify-center gap-2">
            <span>👑</span> Chor Police
          </h1>
          <p className="text-white/50 text-xs sm:text-sm">Game Lobby · Waiting for players to join</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Room Code + Settings */}
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="space-y-4"
          >
            {/* Room code card */}
            <div className="glass rounded-2xl p-5 border border-white/10">
              <h3 className="text-xs text-white/50 uppercase tracking-widest mb-3 font-semibold">Room Code</h3>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-black/40 rounded-xl px-4 py-3 font-mono text-2xl font-black tracking-widest text-amber-400 text-center border border-white/5">
                  {roomCode}
                </div>
                <button
                  onClick={handleCopyCode}
                  aria-label="Copy room code"
                  className="bg-white/10 hover:bg-white/20 p-3 rounded-xl transition text-white cursor-pointer"
                >
                  {copied ? <Check size={20} className="text-green-400" /> : <Copy size={20} />}
                </button>
              </div>
              {copied && (
                <p className="text-green-400 text-xs text-center mt-2 font-medium">Copied to clipboard!</p>
              )}
              <p className="text-white/40 text-xs text-center mt-3">
                Share this 6-character code with your friends to join
              </p>
            </div>

            {/* Host settings */}
            {isHost && (
              <div className="glass rounded-2xl p-5 border border-white/10">
                <h3 className="text-xs text-white/50 uppercase tracking-widest mb-3 flex items-center gap-2 font-semibold">
                  <Settings size={14} /> Host Settings
                </h3>
                <div>
                  <label className="text-xs text-white/70 block mb-2 font-medium">Number of Rounds</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 5, 7].map((n) => (
                      <button
                        key={n}
                        onClick={() => setTotalRounds(n)}
                        className={`flex-1 py-2 rounded-xl text-sm font-bold transition cursor-pointer
                          ${totalRounds === n
                            ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/50'
                            : 'bg-white/10 hover:bg-white/20 text-white/70'}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Camera permission alert if blocked */}
            {cameraPermission === 'denied' && (
              <div className="glass rounded-2xl p-4 border border-red-500/30 bg-red-950/20 text-xs text-red-300 flex items-start gap-2.5">
                <ShieldAlert size={18} className="shrink-0 text-red-400 mt-0.5" />
                <div>
                  <strong className="block text-red-200 mb-0.5">Camera access blocked</strong>
                  Please allow camera access in your browser address bar to enable video call.
                </div>
              </div>
            )}

            {/* Game rules summary */}
            <div className="glass rounded-2xl p-4 border border-white/10 text-xs text-white/60 space-y-1.5">
              <div className="font-semibold text-white/80 uppercase tracking-wider text-[11px] mb-1">How it works:</div>
              <div>• 6 players join with camera & mic</div>
              <div>• Secret roles: King, Queen, Mantri, Soldier, Police, Thief</div>
              <div>• Police must guess who the Thief is!</div>
            </div>
          </motion.div>

          {/* Right Column: Player Slots with Live Video Feeds */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2"
          >
            <div className="glass rounded-2xl p-5 border border-white/10 h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white/90 flex items-center gap-2">
                  <Users size={16} className="text-violet-400" />
                  Players in Room ({players.length}/6)
                </h3>
                {players.length < 6 && (
                  <span className="text-xs text-amber-400 animate-pulse font-medium">
                    Waiting for {6 - players.length} more…
                  </span>
                )}
              </div>

              {/* 6 Player Slots Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 flex-1">
                {slots.map((player, i) => (
                  <AnimatePresence key={i} mode="wait">
                    {player ? (
                      <motion.div
                        key={player.id}
                        initial={{ scale: 0.85, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.85, opacity: 0 }}
                        className={`
                          glass-dark rounded-2xl p-3 sm:p-4 flex flex-col items-center gap-2 text-center relative border
                          ${player.isHost ? 'border-amber-400/50 bg-amber-950/10' : 'border-white/10'}
                          ${player.isLocal ? 'ring-2 ring-violet-500/60' : ''}
                        `}
                      >
                        {/* Live Camera Video (directly where the profile pic was) */}
                        <div className="relative">
                          <PlayerVideo
                            player={player}
                            stream={player.isLocal ? localStream : (remoteStreams && remoteStreams[player.id])}
                            avatarSize="lg"
                            className={`w-24 h-24 sm:w-28 sm:h-28 shadow-lg ${player.isHost ? 'ring-2 ring-amber-400' : 'ring-2 ring-violet-400/40'}`}
                          />
                          {player.isHost && (
                            <span className="absolute -top-2 -right-2 bg-amber-500 text-black p-1 rounded-full shadow" title="Host">
                              <Crown size={12} />
                            </span>
                          )}
                        </div>

                        {/* Player name & badges */}
                        <div className="w-full">
                          <p className="text-xs sm:text-sm font-bold text-white truncate px-1">
                            {player.name}
                            {player.isLocal && <span className="text-violet-300 font-normal"> (You)</span>}
                          </p>
                          {player.isHost && (
                            <span className="text-[11px] text-amber-400 font-semibold block">
                              👑 Room Host
                            </span>
                          )}
                        </div>

                        {/* If Local Player: show mic & camera toggle buttons right here */}
                        {player.isLocal ? (
                          <div className="flex items-center gap-1.5 mt-auto pt-1">
                            <button
                              onClick={toggleMic}
                              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer
                                ${isMuted ? 'bg-red-600 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                            >
                              {isMuted ? <MicOff size={12} /> : <Mic size={12} />}
                              <span>{isMuted ? 'Muted' : 'Mute'}</span>
                            </button>
                            <button
                              onClick={toggleCamera}
                              title={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer
                                ${isCameraOff ? 'bg-red-600 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                            >
                              {isCameraOff ? <VideoOff size={12} /> : <Video size={12} />}
                              <span>{isCameraOff ? 'Cam Off' : 'Cam On'}</span>
                            </button>
                          </div>
                        ) : (
                          // Remote player status badges
                          <div className="flex items-center gap-1.5 mt-auto text-[11px] text-white/50">
                            {player.isMuted && (
                              <span className="text-red-400 flex items-center gap-0.5">
                                <MicOff size={10} /> Muted
                              </span>
                            )}
                          </div>
                        )}
                      </motion.div>
                    ) : (
                      // Empty waiting slot
                      <motion.div
                        key={`empty-${i}`}
                        className="glass-dark rounded-2xl p-4 flex flex-col items-center justify-center gap-2 border border-dashed border-white/10 min-h-[160px]"
                      >
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
                          <span className="text-white/20 text-2xl font-light">?</span>
                        </div>
                        <span className="text-xs text-white/30 font-medium">Waiting…</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                ))}
              </div>

              {/* Start Game Action Bar */}
              <div className="mt-6 pt-4 border-t border-white/10">
                {isHost ? (
                  <div>
                    <Button
                      variant="gold"
                      size="lg"
                      className="w-full shadow-xl text-base font-extrabold cursor-pointer"
                      disabled={players.length < 6 || loading}
                      onClick={handleStartGame}
                    >
                      {loading
                        ? '🎲 Starting Game…'
                        : players.length < 6
                        ? `⏳ Waiting for ${6 - players.length} more player${6 - players.length !== 1 ? 's' : ''}`
                        : '▶️ Start Game'
                      }
                    </Button>
                    {players.length < 6 && (
                      <p className="text-white/40 text-xs text-center mt-2">
                        Exactly 6 players are required to start the game
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-2">
                    <p className="text-white/50 text-sm">
                      {players.length < 6
                        ? `Waiting for ${6 - players.length} more player${6 - players.length !== 1 ? 's' : ''} to join…`
                        : 'All 6 players present! Waiting for host to start the game…'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
