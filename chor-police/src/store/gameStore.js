// src/store/gameStore.js
// Central Zustand store for all game state

import { create } from 'zustand';

const useGameStore = create((set, get) => ({
  // ── Player / Room ──────────────────────────────────────────────
  playerName: '',
  playerId: null,
  roomCode: '',
  isHost: false,
  players: [],          // [{ id, name, avatar, isHost, isLocal, isMuted, isCameraOff }]
  totalRounds: 3,

  // ── Game state ─────────────────────────────────────────────────
  phase: 'lobby',
  // phases: lobby | role-reveal | police-guess | round-result | final-leaderboard
  currentRound: 0,
  myRole: null,         // { name, icon, description, color }
  roleReady: false,

  // ── Police guess ───────────────────────────────────────────────
  policePlayerId: null,
  guessedPlayerId: null,
  timerSeconds: 60,

  // ── Round result ───────────────────────────────────────────────
  roundResult: null,
  // { correct: bool, policeId, thiefId, revealedRoles: [{id, role}], points: [{id, earned}] }

  // ── Scores ─────────────────────────────────────────────────────
  scores: {},           // { playerId: totalScore }

  // ── Chat ───────────────────────────────────────────────────────
  messages: [],         // [{ id, senderId, senderName, text, type, timestamp }]

  // ── Video / Media ──────────────────────────────────────────────
  localStream: null,
  remoteStreams: {},    // { [playerId]: MediaStream }
  isMuted: false,
  isCameraOff: false,
  cameraPermission: 'unknown', // unknown | granted | denied

  // ── UI ─────────────────────────────────────────────────────────
  error: null,

  // ── Actions ───────────────────────────────────────────────────
  setPlayerName: (name) => set({ playerName: name }),
  setPlayerId: (id) => set({ playerId: id }),
  setRoomCode: (code) => set({ roomCode: code }),
  setIsHost: (v) => set({ isHost: v }),
  setPlayers: (players) => set({ players }),
  setTotalRounds: (n) => set({ totalRounds: n }),

  addPlayer: (player) =>
    set((s) => ({ players: [...s.players.filter((p) => p.id !== player.id), player] })),
  removePlayer: (id) =>
    set((s) => ({ players: s.players.filter((p) => p.id !== id) })),

  setPhase: (phase) => set({ phase }),
  setCurrentRound: (n) => set({ currentRound: n }),
  setMyRole: (role) => set({ myRole: role, roleReady: false }),
  setRoleReady: (v) => set({ roleReady: v }),

  setPolicePlayerId: (id) => set({ policePlayerId: id }),
  setGuessedPlayerId: (id) => set({ guessedPlayerId: id }),
  setTimerSeconds: (s) => set({ timerSeconds: s }),

  setRoundResult: (result) => set({ roundResult: result }),

  updateScores: (newScores) =>
    set((s) => {
      const merged = { ...s.scores };
      Object.entries(newScores).forEach(([id, earned]) => {
        merged[id] = (merged[id] || 0) + earned;
      });
      return { scores: merged };
    }),

  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, { id: Date.now() + Math.random(), ...msg }] })),

  setLocalStream: (stream) => set({ localStream: stream }),
  setRemoteStream: (peerId, stream) =>
    set((s) => ({ remoteStreams: { ...s.remoteStreams, [peerId]: stream } })),
  removeRemoteStream: (peerId) =>
    set((s) => {
      const copy = { ...s.remoteStreams };
      delete copy[peerId];
      return { remoteStreams: copy };
    }),
  clearRemoteStreams: () => set({ remoteStreams: {} }),
  setIsMuted: (v) => set({ isMuted: v }),
  setIsCameraOff: (v) => set({ isCameraOff: v }),
  setCameraPermission: (v) => set({ cameraPermission: v }),

  updatePlayerMedia: (playerId, { isMuted, isCameraOff }) =>
    set((s) => ({
      players: s.players.map((p) =>
        p.id === playerId ? { ...p, isMuted, isCameraOff } : p
      ),
    })),

  setError: (error) => set({ error }),

  resetGame: () =>
    set({
      phase: 'lobby',
      currentRound: 0,
      myRole: null,
      roleReady: false,
      policePlayerId: null,
      guessedPlayerId: null,
      timerSeconds: 60,
      roundResult: null,
      scores: {},
      messages: [],
    }),

  fullReset: () =>
    set({
      playerName: '',
      playerId: null,
      roomCode: '',
      isHost: false,
      players: [],
      totalRounds: 3,
      phase: 'lobby',
      currentRound: 0,
      myRole: null,
      roleReady: false,
      policePlayerId: null,
      guessedPlayerId: null,
      timerSeconds: 60,
      roundResult: null,
      scores: {},
      messages: [],
      localStream: null,
      remoteStreams: {},
      isMuted: false,
      isCameraOff: false,
      cameraPermission: 'unknown',
      error: null,
    }),
}));

export default useGameStore;
