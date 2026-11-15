// server/src/socket/handlers.js
// All Socket.IO event handlers — Phases 1-5.
// Events handled:
//   createRoom, joinRoom, startGame, playerReady, submitGuess,
//   sendChatMessage, nextRound, leaveRoom, reconnect,
//   rtc:offer, rtc:answer, rtc:ice-candidate

import {
  createRoom,
  joinRoom,
  removePlayerBySocket,
  markDisconnected,
  reconnectPlayer,
  getRoomBySocket,
  getPlayerBySocket,
  getSocketRoomInfo,
  serializePlayer,
  serializePlayers,
  clearRoomTimer,
  PHASES,
} from '../rooms/roomStore.js';

import { validateUsername, validateRoomCode, validateChatMessage } from '../utils/sanitize.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';
import {
  startRound,
  handlePlayerReady,
  handleGuess,
  handleNextRound,
  handleMidGameDisconnect,
  handleReconnectExpired,
} from '../game/roundManager.js';

// ── Per-socket state (rate limiting, reconnect timers) ────────────────────────
// Map<socketId, { lastChatAt: number, reconnectTimer: NodeJS timer | null }>
const socketMeta = new Map();

function getMeta(socketId) {
  if (!socketMeta.has(socketId)) {
    socketMeta.set(socketId, { lastChatAt: 0, reconnectTimer: null });
  }
  return socketMeta.get(socketId);
}

function cleanMeta(socketId) {
  const m = socketMeta.get(socketId);
  if (m?.reconnectTimer) clearTimeout(m.reconnectTimer);
  socketMeta.delete(socketId);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function emitError(socket, message, code = 'GENERIC_ERROR') {
  socket.emit('onError', { message, code });
  logger.warn(`[socket ${socket.id}] onError: ${code} — ${message}`);
}

/** Push the full serialised player list to every player in the room (each sees isLocal:true for self). */
function broadcastPlayerList(io, room) {
  for (const p of room.players.values()) {
    const sock = io.sockets.sockets.get(p.socketId);
    if (sock) {
      sock.emit('onPlayersUpdated', {
        players: serializePlayers(room, p.id),
        hostId: room.hostId,
      });
    }
  }
}

// ── Main handler registration ─────────────────────────────────────────────────

export function registerHandlers(io, socket) {
  logger.info(`Socket connected: ${socket.id}`);

  // ── PHASE 1: createRoom ───────────────────────────────────────────────────
  socket.on('createRoom', ({ playerName } = {}) => {
    try {
      const nameResult = validateUsername(playerName);
      if (!nameResult.ok) return emitError(socket, nameResult.reason, 'INVALID_NAME');
      if (getRoomBySocket(socket.id)) return emitError(socket, 'Already in a room.', 'ALREADY_IN_ROOM');

      const { room, player } = createRoom(socket.id, nameResult.value);
      socket.join(room.code);

      socket.emit('roomCreated', {
        roomCode: room.code,
        playerId: player.id,
        player: serializePlayer(player, player.id),
        players: serializePlayers(room, player.id),
        totalRounds: room.totalRounds,
      });

      logger.info(`Room ${room.code} created by "${player.name}"`);
    } catch (err) {
      logger.error('createRoom:', err.message);
      emitError(socket, err.message || 'Could not create room.', 'CREATE_ROOM_ERROR');
    }
  });

  // ── PHASE 1: joinRoom ─────────────────────────────────────────────────────
  socket.on('joinRoom', ({ roomCode, playerName } = {}) => {
    try {
      const nameResult = validateUsername(playerName);
      if (!nameResult.ok) return emitError(socket, nameResult.reason, 'INVALID_NAME');
      if (!validateRoomCode(roomCode)) return emitError(socket, 'Invalid room code.', 'INVALID_CODE');

      const code = roomCode.trim().toUpperCase();
      const { room, player } = joinRoom(socket.id, code, nameResult.value);
      socket.join(code);

      // Confirm to joiner
      socket.emit('roomJoined', {
        roomCode: code,
        playerId: player.id,
        player: serializePlayer(player, player.id),
        players: serializePlayers(room, player.id),
        totalRounds: room.totalRounds,
      });

      // Notify existing players
      socket.to(code).emit('onPlayerJoined', { player: serializePlayer(player) });

      // Tell existing players to initiate a WebRTC peer connection to the newcomer
      // (the newcomer's socket.id acts as the WebRTC peer address for signaling)
      socket.to(code).emit('rtc:new-peer', {
        peerId: player.id,
        socketId: socket.id,
      });

      io.to(code).emit('onChat', {
        senderId: 'system', senderName: 'System',
        text: `${player.name} joined the room 🎉`,
        type: 'system', timestamp: Date.now(),
      });

      logger.info(`"${player.name}" joined ${code} (${room.players.size}/6)`);
    } catch (err) {
      logger.error('joinRoom:', err.message);
      emitError(socket, err.message || 'Could not join room.', 'JOIN_ROOM_ERROR');
    }
  });

  // ── PHASE 1: reconnect ────────────────────────────────────────────────────
  socket.on('reconnect', ({ playerId } = {}) => {
    if (!playerId) return emitError(socket, 'Missing playerId.', 'INVALID_PAYLOAD');

    const result = reconnectPlayer(socket.id, playerId);
    if (!result) return emitError(socket, 'Reconnect window expired or session not found.', 'RECONNECT_FAILED');

    const { room, player } = result;
    socket.join(room.code);

    // Cancel any pending removal timer
    const meta = getMeta(playerId); // keyed by playerId for reconnect
    if (meta?.reconnectTimer) {
      clearTimeout(meta.reconnectTimer);
      meta.reconnectTimer = null;
    }

    // Send current game state back
    socket.emit('reconnected', {
      roomCode: room.code,
      playerId: player.id,
      player: serializePlayer(player, player.id),
      players: serializePlayers(room, player.id),
      phase: room.phase,
      currentRound: room.currentRound,
      totalRounds: room.totalRounds,
      scores: Object.fromEntries(room.scores),
    });

    // Tell others this player is back
    socket.to(room.code).emit('onPlayerRejoined', { player: serializePlayer(player) });
    io.to(room.code).emit('onChat', {
      senderId: 'system', senderName: 'System',
      text: `${player.name} reconnected! 👋`,
      type: 'system', timestamp: Date.now(),
    });

    logger.info(`"${player.name}" reconnected to room ${room.code}`);
  });

  // ── PHASE 2: startGame ────────────────────────────────────────────────────
  socket.on('startGame', ({ totalRounds } = {}) => {
    try {
      const room = getRoomBySocket(socket.id);
      const player = getPlayerBySocket(socket.id);
      if (!room || !player) return emitError(socket, 'Not in a room.', 'NOT_IN_ROOM');
      if (!player.isHost) return emitError(socket, 'Only the host can start the game.', 'NOT_HOST');
      if (room.phase !== PHASES.LOBBY && room.phase !== PHASES.GAME_END) {
        return emitError(socket, 'Game already started.', 'ALREADY_STARTED');
      }
      if (room.players.size < config.maxPlayersPerRoom) {
        return emitError(socket, `Need ${config.maxPlayersPerRoom} players to start. Currently ${room.players.size}.`, 'NOT_ENOUGH_PLAYERS');
      }

      // Set rounds (clamp 1–10)
      const rounds = typeof totalRounds === 'number' ? Math.min(10, Math.max(1, Math.floor(totalRounds))) : room.totalRounds;
      room.totalRounds = rounds;

      io.to(room.code).emit('onChat', {
        senderId: 'system', senderName: 'System',
        text: '👑 The game begins! Good luck everyone!',
        type: 'system', timestamp: Date.now(),
      });

      startRound(io, room);
      logger.info(`Room ${room.code}: game started — ${rounds} rounds`);
    } catch (err) {
      logger.error('startGame:', err.message);
      emitError(socket, 'Could not start game.', 'START_GAME_ERROR');
    }
  });

  // ── PHASE 2: playerReady ──────────────────────────────────────────────────
  socket.on('playerReady', () => {
    const room   = getRoomBySocket(socket.id);
    const player = getPlayerBySocket(socket.id);
    if (!room || !player) return;
    if (room.phase !== PHASES.ROLE_REVEAL) return;
    handlePlayerReady(io, room, player.id);
  });

  // ── PHASE 3: submitGuess ──────────────────────────────────────────────────
  socket.on('submitGuess', ({ targetPlayerId } = {}) => {
    const room   = getRoomBySocket(socket.id);
    const player = getPlayerBySocket(socket.id);
    if (!room || !player) return emitError(socket, 'Not in a room.', 'NOT_IN_ROOM');
    if (room.phase !== PHASES.POLICE_GUESS) return emitError(socket, 'Not in guess phase.', 'WRONG_PHASE');
    if (player.id !== room.policeId) return emitError(socket, 'Only the Police can guess.', 'NOT_POLICE');
    if (room.guessedId !== null) return emitError(socket, 'Already guessed.', 'ALREADY_GUESSED');
    if (typeof targetPlayerId !== 'string') return emitError(socket, 'Invalid target.', 'INVALID_PAYLOAD');
    if (targetPlayerId === player.id) return emitError(socket, 'You cannot guess yourself.', 'SELF_GUESS');
    if (!room.players.has(targetPlayerId)) return emitError(socket, 'Target player not in room.', 'INVALID_TARGET');

    handleGuess(io, room, player.id, targetPlayerId);
  });

  // ── PHASE 3: nextRound ────────────────────────────────────────────────────
  socket.on('nextRound', () => {
    const room   = getRoomBySocket(socket.id);
    const player = getPlayerBySocket(socket.id);
    if (!room || !player) return;
    if (room.phase !== PHASES.ROUND_RESULT) return;
    handleNextRound(io, room);
  });

  // ── PHASE 4: sendChatMessage ──────────────────────────────────────────────
  socket.on('sendChatMessage', ({ text } = {}) => {
    const room   = getRoomBySocket(socket.id);
    const player = getPlayerBySocket(socket.id);
    if (!room || !player) return;

    // Rate limit
    const meta = getMeta(socket.id);
    const now = Date.now();
    if (now - meta.lastChatAt < config.chatRateLimitMs) {
      return emitError(socket, 'Sending messages too fast.', 'RATE_LIMIT');
    }
    meta.lastChatAt = now;

    const msgResult = validateChatMessage(text);
    if (!msgResult.ok) return emitError(socket, msgResult.reason, 'INVALID_CHAT');

    io.to(room.code).emit('onChat', {
      senderId:   player.id,
      senderName: player.name,
      text:       msgResult.value,
      type:       'player',
      timestamp:  Date.now(),
    });
  });

  // ── PHASE 1: leaveRoom ────────────────────────────────────────────────────
  socket.on('leaveRoom', () => {
    handleLeave(io, socket, false);
  });

  // ── PHASE 4: disconnect ───────────────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    logger.info(`Socket disconnected: ${socket.id} — ${reason}`);
    handleLeave(io, socket, true);
  });

  // ── PHASE 5: WebRTC signaling relay & media ──────────────────────────────
  // The server never touches SDP or ICE data — just forwards to the target socket.

  socket.on('toggleMedia', ({ isMuted, isCameraOff } = {}) => {
    const room = getRoomBySocket(socket.id);
    const player = getPlayerBySocket(socket.id);
    if (!room || !player) return;
    if (typeof isMuted === 'boolean') player.isMuted = isMuted;
    if (typeof isCameraOff === 'boolean') player.isCameraOff = isCameraOff;
    io.to(room.code).emit('onPlayerMediaChanged', {
      playerId: player.id,
      isMuted: player.isMuted,
      isCameraOff: player.isCameraOff,
    });
  });

  socket.on('rtc:offer', ({ targetSocketId, targetPlayerId, offer } = {}) => {
    const target = targetPlayerId || targetSocketId;
    if (!target || !offer) return;
    const room = getRoomBySocket(socket.id);
    const sender = getPlayerBySocket(socket.id);
    if (!room || !sender) return;

    // Find the target player to get their current socketId
    const targetPlayer = [...room.players.values()].find(p => p.id === target || p.socketId === target);
    const targetSock = targetPlayer ? io.sockets.sockets.get(targetPlayer.socketId) : null;
    if (targetSock) {
      targetSock.emit('rtc:offer', { fromSocketId: socket.id, fromPlayerId: sender.id, offer });
    }
  });

  socket.on('rtc:answer', ({ targetSocketId, targetPlayerId, answer } = {}) => {
    const target = targetPlayerId || targetSocketId;
    if (!target || !answer) return;
    const room = getRoomBySocket(socket.id);
    const sender = getPlayerBySocket(socket.id);
    if (!room || !sender) return;

    const targetPlayer = [...room.players.values()].find(p => p.id === target || p.socketId === target);
    const targetSock = targetPlayer ? io.sockets.sockets.get(targetPlayer.socketId) : null;
    if (targetSock) {
      targetSock.emit('rtc:answer', { fromSocketId: socket.id, fromPlayerId: sender.id, answer });
    }
  });

  socket.on('rtc:ice-candidate', ({ targetSocketId, targetPlayerId, candidate } = {}) => {
    const target = targetPlayerId || targetSocketId;
    if (!target || !candidate) return;
    const room = getRoomBySocket(socket.id);
    const sender = getPlayerBySocket(socket.id);
    if (!room || !sender) return;

    const targetPlayer = [...room.players.values()].find(p => p.id === target || p.socketId === target);
    const targetSock = targetPlayer ? io.sockets.sockets.get(targetPlayer.socketId) : null;
    if (targetSock) {
      targetSock.emit('rtc:ice-candidate', { fromSocketId: socket.id, fromPlayerId: sender.id, candidate });
    }
  });
}

// ── Shared leave / disconnect logic ───────────────────────────────────────────

function handleLeave(io, socket, isDisconnect) {
  const info = getSocketRoomInfo(socket.id);
  if (!info) {
    cleanMeta(socket.id);
    return;
  }

  const { roomCode, playerId } = info;

  // For disconnects during an active game, keep the player in the room
  // and start a 30s reconnect window before fully removing them.
  if (isDisconnect) {
    const result = markDisconnected(socket.id);
    if (!result) { cleanMeta(socket.id); return; }

    const { room, player } = result;
    if (!room || !player) { cleanMeta(socket.id); return; }

    if (room.phase !== PHASES.LOBBY) {
      // Mid-game disconnect: keep slot, start timer
      handleMidGameDisconnect(io, room, player);

      // Store reconnect timer keyed by playerId (not socketId — that's gone)
      const meta = getMeta(playerId);
      meta.reconnectTimer = setTimeout(() => {
        // Check if they reconnected in time
        if (player.disconnectedAt !== null) {
          handleReconnectExpired(io, room, player);
        }
        cleanMeta(playerId);
      }, config.reconnectWindowMs);

      cleanMeta(socket.id); // clean old socketId entry
      return;
    }
  }

  // Lobby disconnect or explicit leaveRoom: remove immediately
  const result = isDisconnect
    ? (() => {
        // markDisconnected already called above for mid-game; this branch is lobby-only
        const r = markDisconnected(socket.id); // re-mark (noop if already done)
        if (!r) return null;
        // Actually remove them from the room
        r.room.players.delete(r.player.id);
        const roomDeleted = r.room.players.size === 0;
        if (roomDeleted) {
          clearRoomTimer(r.room);
          // rooms map cleanup happens in roomStore; we just signal
        }
        if (!roomDeleted && r.room.hostId === r.player.id) {
          const newHost = r.room.players.values().next().value;
          if (newHost) { newHost.isHost = true; r.room.hostId = newHost.id; }
        }
        return { room: r.room, player: r.player, roomDeleted };
      })()
    : removePlayerBySocket(socket.id);

  cleanMeta(socket.id);

  if (!result) return;
  const { room, player, roomDeleted } = result;

  if (roomDeleted) {
    logger.info(`Room ${roomCode} deleted (empty)`);
    return;
  }

  socket.leave(roomCode);
  io.to(room.code).emit('onPlayerLeft', { playerId: player.id });
  broadcastPlayerList(io, room);

  io.to(room.code).emit('onChat', {
    senderId: 'system', senderName: 'System',
    text: `${player.name} left the game.`,
    type: 'system', timestamp: Date.now(),
  });

  logger.info(`"${player.name}" left room ${room.code}. Players: ${room.players.size}`);
}
