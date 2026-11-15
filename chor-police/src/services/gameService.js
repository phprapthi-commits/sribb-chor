// src/services/gameService.js
// REAL Socket.IO implementation — replaces the mock.
// Exported function signatures are IDENTICAL to the mock so no other file changes.
// To use the mock instead, change the import in your app to gameService.mock.js

import { io } from 'socket.io-client';
import useGameStore from '../store/gameStore';

// ── Socket setup ──────────────────────────────────────────────────────────────

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export const socket = io(SERVER_URL, {
  autoConnect: false,   // we connect manually in createRoom / joinRoom
  reconnection: false,  // we handle reconnect ourselves via the 'reconnect' event
});

// ── Internal listener registry (mirrors the mock API) ────────────────────────

const _listeners = {};

function emit(event, data) {
  (_listeners[event] || []).forEach((cb) => {
    try { cb(data); } catch (e) { console.error('[gameService] listener error', e); }
  });
}

function on(event, cb) {
  if (!_listeners[event]) _listeners[event] = [];
  _listeners[event].push(cb);
}

function off(event, cb) {
  if (!_listeners[event]) return;
  _listeners[event] = _listeners[event].filter((fn) => fn !== cb);
}

// ── Wire server events → internal listeners ───────────────────────────────────

socket.on('onPlayerJoined',   (data) => emit('playerJoined',  data));
socket.on('onPlayerLeft',     (data) => emit('playerLeft',    data));
socket.on('onPlayerRejoined', (data) => emit('playerJoined',  data)); // treat rejoin like join
socket.on('onPlayersUpdated', (data) => {
  // Full player list refresh (host change, reconnect, etc.)
  const store = useGameStore.getState();
  store.setPlayers(data.players);
  if (data.hostId) {
    const me = data.players.find((p) => p.isLocal);
    if (me) store.setIsHost(me.isHost);
  }
});
socket.on('onRoleAssigned',   (data) => emit('roleAssigned',  data));
socket.on('onPhaseChange',    (data) => {
  emit('phaseChange', data);
  // Keep currentRound in sync
  const store = useGameStore.getState();
  if (data.currentRound !== undefined) store.setCurrentRound(data.currentRound);
  if (data.totalRounds  !== undefined) store.setTotalRounds(data.totalRounds);
  if (data.policePlayerId) store.setPolicePlayerId(data.policePlayerId);
});
socket.on('onChat',           (data) => emit('chat',          data));
socket.on('onTimerTick',      (data) => emit('timerTick',     data));
socket.on('onRoundResult',    (data) => {
  emit('roundResult', data);
  // Persist scores
  if (data.points) useGameStore.getState().updateScores(data.points);
});
socket.on('onGameEnd',        (data) => emit('gameEnd',       data));
socket.on('onError',          ({ message }) => {
  useGameStore.getState().setError(message);
  console.error('[server error]', message);
});

// Reconnect restore
socket.on('reconnected', (data) => {
  const store = useGameStore.getState();
  store.setPlayers(data.players);
  store.setPhase(data.phase);
  store.setCurrentRound(data.currentRound);
  store.setTotalRounds(data.totalRounds);
  if (data.scores) {
    // Overwrite scores map
    Object.entries(data.scores).forEach(([id, total]) => {
      store.scores[id] = total;
    });
  }
});

// ── Public API ────────────────────────────────────────────────────────────────

export function createRoom(playerName) {
  return new Promise((resolve, reject) => {
    socket.connect();

    socket.once('roomCreated', (data) => {
      const store = useGameStore.getState();
      store.setPlayerId(data.playerId);
      store.setRoomCode(data.roomCode);
      store.setIsHost(true);
      store.setPlayers(data.players);
      store.setTotalRounds(data.totalRounds);
      resolve({ roomCode: data.roomCode, playerId: data.playerId });
    });

    socket.once('onError', ({ message }) => reject(new Error(message)));

    socket.emit('createRoom', { playerName });
  });
}

export function joinRoom(roomCode, playerName) {
  return new Promise((resolve, reject) => {
    socket.connect();

    socket.once('roomJoined', (data) => {
      const store = useGameStore.getState();
      store.setPlayerId(data.playerId);
      store.setRoomCode(data.roomCode);
      store.setIsHost(false);
      store.setPlayers(data.players);
      store.setTotalRounds(data.totalRounds);
      resolve({ playerId: data.playerId });
    });

    socket.once('onError', ({ message }) => reject(new Error(message)));

    socket.emit('joinRoom', { roomCode: roomCode.toUpperCase(), playerName });
  });
}

export function startGame(totalRounds) {
  const store = useGameStore.getState();
  const rounds = totalRounds || store.totalRounds || 3;
  socket.emit('startGame', { totalRounds: rounds });
}

export function sendChatMessage(text) {
  socket.emit('sendChatMessage', { text });
}

export function setReady() {
  socket.emit('playerReady');
}

export function submitGuess(targetPlayerId) {
  socket.emit('submitGuess', { targetPlayerId });
}

export function nextRound() {
  socket.emit('nextRound');
}

export function leaveRoom() {
  socket.emit('leaveRoom');
  socket.disconnect();
  _listeners && Object.keys(_listeners).forEach((k) => { _listeners[k] = []; });
}

// ── Event listeners (identical signatures to mock) ────────────────────────────

export function onPlayerJoined(cb)  { on('playerJoined', cb);  return () => off('playerJoined', cb);  }
export function onPlayerLeft(cb)    { on('playerLeft', cb);    return () => off('playerLeft', cb);    }
export function onRoleAssigned(cb)  { on('roleAssigned', cb);  return () => off('roleAssigned', cb);  }
export function onPhaseChange(cb)   { on('phaseChange', cb);   return () => off('phaseChange', cb);   }
export function onChat(cb)          { on('chat', cb);          return () => off('chat', cb);          }
export function onTimerTick(cb)     { on('timerTick', cb);     return () => off('timerTick', cb);     }
export function onRoundResult(cb)   { on('roundResult', cb);   return () => off('roundResult', cb);   }
export function onGameEnd(cb)       { on('gameEnd', cb);       return () => off('gameEnd', cb);       }
