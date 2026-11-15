// src/pages/HomePage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Crown, Users, LogIn } from 'lucide-react';
import Button from '../components/Button';
import useGameStore from '../store/gameStore';
import { createRoom, joinRoom } from '../services/gameService';

export default function HomePage() {
  const navigate = useNavigate();
  const setPlayerName = useGameStore((s) => s.setPlayerName);
  const setRoomCode   = useGameStore((s) => s.setRoomCode);

  const [name, setName]     = useState('');
  const [code, setCode]     = useState('');
  const [mode, setMode]     = useState(null); // null | 'create' | 'join'
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  function validateName() {
    if (!name.trim()) { setError('Please enter your name'); return false; }
    if (name.trim().length < 2) { setError('Name must be at least 2 characters'); return false; }
    if (name.trim().length > 20) { setError('Name must be 20 characters or less'); return false; }
    return true;
  }

  async function handleCreate() {
    setError('');
    if (!validateName()) return;
    setLoading(true);
    try {
      const trimmed = name.trim();
      setPlayerName(trimmed);
      await createRoom(trimmed);
      navigate('/lobby');
    } catch (e) {
      setError(e.message || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    setError('');
    if (!validateName()) return;
    if (!code.trim()) { setError('Please enter a room code'); return; }
    if (code.trim().length !== 6) { setError('Room code must be exactly 6 characters'); return; }
    setLoading(true);
    try {
      const trimmed = name.trim();
      setPlayerName(trimmed);
      await joinRoom(code.toUpperCase().trim(), trimmed);
      navigate('/lobby');
    } catch (e) {
      setError(e.message || 'Failed to join room');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-violet-800/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-purple-800/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-700/10 rounded-full blur-3xl" />
      </div>

      {/* Floating crown particles */}
      {['👑', '⚔️', '🔵', '🗡️', '📜', '💎'].map((emoji, i) => (
        <motion.div
          key={i}
          className="absolute text-2xl opacity-20 pointer-events-none"
          style={{
            left: `${10 + i * 15}%`,
            top: `${15 + (i % 3) * 25}%`,
          }}
          animate={{ y: [0, -20, 0], rotate: [0, 10, -10, 0] }}
          transition={{ duration: 4 + i, repeat: Infinity, delay: i * 0.7 }}
        >
          {emoji}
        </motion.div>
      ))}

      {/* Main card */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 20 }}
        className="glass rounded-3xl p-8 w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="text-6xl mb-3"
          >
            👑
          </motion.div>
          <h1 className="text-4xl font-black text-white tracking-tight">
            Chor<span className="text-violet-400"> Police</span>
          </h1>
          <p className="text-white/50 mt-2 text-sm">
            राजा मंत्री चोर सिपाही · 6 Players
          </p>
        </div>

        {/* Name input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-white/70 mb-2" htmlFor="player-name">
            Your Name
          </label>
          <input
            id="player-name"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && (mode === 'join' ? handleJoin() : handleCreate())}
            placeholder="Enter your name…"
            maxLength={20}
            autoFocus
            className="
              w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3
              text-white placeholder-white/30 focus:outline-none focus:border-violet-400
              transition text-base
            "
          />
        </div>

        {/* Join code (only shown in join mode) */}
        {mode === 'join' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-6"
          >
            <label className="block text-sm font-medium text-white/70 mb-2" htmlFor="room-code">
              Room Code
            </label>
            <input
              id="room-code"
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              placeholder="6-character code"
              maxLength={6}
              autoFocus
              className="
                w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3
                text-white placeholder-white/30 focus:outline-none focus:border-violet-400
                transition text-base text-center tracking-widest uppercase font-mono text-xl
              "
            />
          </motion.div>
        )}

        {/* Error */}
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-red-400 text-sm mb-4 text-center"
            role="alert"
          >
            ⚠️ {error}
          </motion.p>
        )}

        {/* Buttons */}
        {mode === null ? (
          <div className="flex flex-col gap-3">
            <Button
              variant="gold"
              size="lg"
              className="w-full"
              icon={Crown}
              onClick={() => { setError(''); setMode('create'); }}
            >
              Create Room
            </Button>
            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              icon={LogIn}
              onClick={() => { setError(''); setMode('join'); }}
            >
              Join Room
            </Button>
          </div>
        ) : mode === 'create' ? (
          <div className="flex flex-col gap-3">
            <Button variant="gold" size="lg" className="w-full" disabled={loading} onClick={handleCreate}>
              {loading ? 'Creating…' : '👑 Create Room'}
            </Button>
            <Button variant="ghost" size="md" className="w-full" onClick={() => { setMode(null); setError(''); }}>
              ← Back
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Button variant="primary" size="lg" className="w-full" disabled={loading} onClick={handleJoin}>
              {loading ? 'Joining…' : '🚪 Join Room'}
            </Button>
            <Button variant="ghost" size="md" className="w-full" onClick={() => { setMode(null); setCode(''); setError(''); }}>
              ← Back
            </Button>
          </div>
        )}

        {/* Role legend */}
        <div className="mt-8 pt-6 border-t border-white/10">
          <p className="text-xs text-white/40 text-center mb-3">Roles in this game</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: '👑', name: 'King', pts: '900' },
              { icon: '💎', name: 'Queen', pts: '1000' },
              { icon: '📜', name: 'Mantri', pts: '250' },
              { icon: '⚔️',  name: 'Soldier', pts: '200' },
              { icon: '🔵', name: 'Police', pts: '500?' },
              { icon: '🗡️',  name: 'Thief', pts: '0/500' },
            ].map((r) => (
              <div key={r.name} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white/5">
                <span className="text-xl">{r.icon}</span>
                <span className="text-xs text-white/70 font-medium">{r.name}</span>
                <span className="text-xs text-violet-300">{r.pts}pts</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      <p className="text-white/20 text-xs mt-6 relative z-10">
        Frontend demo — mock service active
      </p>
    </div>
  );
}

