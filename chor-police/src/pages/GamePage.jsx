// src/pages/GamePage.jsx
// Main game screen — video grid, chat, scoreboard, phase overlays

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Video, VideoOff, LogOut } from 'lucide-react';
import VideoTile from '../components/VideoTile';
import ChatBox from '../components/ChatBox';
import ScoreBoard from '../components/ScoreBoard';
import PhaseBanner from '../components/PhaseBanner';
import Button from '../components/Button';
import useGameStore from '../store/gameStore';
import useGameEvents from '../hooks/useGame';
import { toggleMic, toggleCamera, stopLocalStream, getLocalStream } from '../services/videoService';
import { leaveRoom } from '../services/gameService';

// Sub-screens (overlays) rendered on top of the game layout
import RoleRevealOverlay from './overlays/RoleRevealOverlay';
import PoliceGuessOverlay from './overlays/PoliceGuessOverlay';
import RoundResultOverlay from './overlays/RoundResultOverlay';
import FinalLeaderboard from './overlays/FinalLeaderboard';

export default function GamePage() {
  const navigate = useNavigate();
  useGameEvents();

  const players      = useGameStore((s) => s.players);
  const phase        = useGameStore((s) => s.phase);
  const localStream  = useGameStore((s) => s.localStream);
  const remoteStreams = useGameStore((s) => s.remoteStreams);
  const isMuted      = useGameStore((s) => s.isMuted);
  const isCameraOff  = useGameStore((s) => s.isCameraOff);
  const roomCode     = useGameStore((s) => s.roomCode);
  const myId         = useGameStore((s) => s.playerId);
  const cameraPermission = useGameStore((s) => s.cameraPermission);
  const fullReset    = useGameStore((s) => s.fullReset);

  // Auto request camera stream if not yet started
  useEffect(() => {
    if (!localStream && cameraPermission !== 'denied') {
      getLocalStream();
    }
  }, [localStream, cameraPermission]);

  // Redirect if no session
  useEffect(() => {
    if (!roomCode) navigate('/');
  }, [roomCode, navigate]);

  // Ensure local video stream is active
  useEffect(() => {
    if (!localStream) {
      getLocalStream();
    }
  }, [localStream]);

  function handleLeave() {
    stopLocalStream();
    leaveRoom();
    fullReset();
    navigate('/');
  }

  const myPlayer = players.find((p) => p.id === myId);

  return (
    <div className="min-h-screen flex flex-col p-3 md:p-4 relative">
      {/* Phase overlays */}
      <AnimatePresence mode="wait">
        {phase === 'role-reveal'       && <RoleRevealOverlay key="role-reveal" />}
        {phase === 'police-guess'      && <PoliceGuessOverlay key="police-guess" />}
        {phase === 'round-result'      && <RoundResultOverlay key="round-result" />}
        {phase === 'final-leaderboard' && <FinalLeaderboard key="final" />}
      </AnimatePresence>

      {/* Top bar */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-white font-black text-lg">👑 Chor Police</span>
          <span className="glass text-xs text-white/60 px-3 py-1 rounded-full font-mono">
            {roomCode}
          </span>
        </div>
        <PhaseBanner phase={phase} />
        <Button variant="danger" size="sm" icon={LogOut} onClick={handleLeave}>
          Leave
        </Button>
      </div>

      {/* Main layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-3 min-h-0">
        {/* Video grid (3 columns on large screens) */}
        <div className="lg:col-span-3 flex flex-col gap-3 min-h-0">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 flex-1">
            {players.map((player) => (
              <VideoTile
                key={player.id}
                player={player}
                stream={player.isLocal ? localStream : (remoteStreams && remoteStreams[player.id])}
                showBorder={player.isLocal}
              />
            ))}
            {/* Empty slots if fewer than 6 */}
            {Array(Math.max(0, 6 - players.length)).fill(null).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="aspect-video rounded-2xl bg-black/20 border border-dashed border-white/10 flex items-center justify-center"
              >
                <span className="text-white/20 text-sm">Empty</span>
              </div>
            ))}
          </div>

          {/* Media controls */}
          <div className="flex items-center justify-center gap-3 py-2 shrink-0">
            <button
              onClick={toggleMic}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              className={`p-3 rounded-2xl transition ${isMuted ? 'bg-red-600 text-white' : 'glass text-white/80 hover:text-white'}`}
            >
              {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
            </button>
            <button
              onClick={toggleCamera}
              aria-label={isCameraOff ? 'Start camera' : 'Stop camera'}
              className={`p-3 rounded-2xl transition ${isCameraOff ? 'bg-red-600 text-white' : 'glass text-white/80 hover:text-white'}`}
            >
              {isCameraOff ? <VideoOff size={22} /> : <Video size={22} />}
            </button>
          </div>
        </div>

        {/* Right sidebar: Chat + Scoreboard */}
        <div className="flex flex-col gap-3 min-h-0 lg:max-h-full">
          <ScoreBoard className="shrink-0" />
          <ChatBox className="flex-1 min-h-0" />
        </div>
      </div>
    </div>
  );
}
