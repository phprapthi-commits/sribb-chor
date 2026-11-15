// server/src/socket/handlers.js
// All Socket.IO event handlers for Phase 1:
//   createRoom, joinRoom, leaveRoom, disconnect
//
// Phases 2-5 handlers will be added in later files and registered here.

import {
  createRoom,
  joinRoom,
  removePlayerBySocket,
  markDisconnected,
  getRoomBySocket,
  getPlayerBySocket,
  getSocketRoomInfo,
  serializePlayer,
  serializePlayers,
  PHASES,
} from '../rooms/roomStore.js';

import { validateUsername, validateRoomCode } from '../utils/sanitize.js';
import { logger } from '../utils/logger.js';

/**
 * Emit an error back to only the calling socket.
 */
function emitError(socket, message, code = 'GENERIC_ERROR') {
  socket.emit('onError', { message, code });
  logger.warn(`[socket ${socket.id}] error emitted: ${code} — ${message}`);
}

/**
 * Register all socket event handlers.
 * Called once per connected socket in the main io.on('connection') callback.
 */
export function registerHandlers(io, socket) {
  logger.info(`Socket connected: ${socket.id}`);

  // ── createRoom ─────────────────────────────────────────────────────────────
  socket.on('createRoom', ({ playerName } = {}) => {
    try {
      const nameResult = validateUsername(playerName);
      if (!nameResult.ok) return emitError(socket, nameResult.reason, 'INVALID_NAME');

      // Guard: socket already in a room
      if (getRoomBySocket(socket.id)) {
        return emitError(socket, 'You are already in a room.', 'ALREADY_IN_ROOM');
      }

      const { room, player } = createRoom(socket.id, nameResult.value);
      socket.join(room.code);

      // Confirm to the creator
      socket.emit('roomCreated', {
        roomCode: room.code,
        playerId: player.id,
        player: serializePlayer(player, player.id),
        players: serializePlayers(room, player.id),
      });

      logger.info(`Room ${room.code} created by ${player.name} (${player.id})`);
    } catch (err) {
      logger.error('createRoom error:', err);
      emitError(socket, err.message || 'Could not create room.', 'CREATE_ROOM_ERROR');
    }
  });

  // ── joinRoom ───────────────────────────────────────────────────────────────
  socket.on('joinRoom', ({ roomCode, playerName } = {}) => {
    try {
      const nameResult = validateUsername(playerName);
      if (!nameResult.ok) return emitError(socket, nameResult.reason, 'INVALID_NAME');

      if (!validateRoomCode(roomCode)) {
        return emitError(socket, 'Invalid room code format.', 'INVALID_CODE');
      }

      const normalizedCode = roomCode.trim().toUpperCase();
      const { room, player } = joinRoom(socket.id, normalizedCode, nameResult.value);
      socket.join(normalizedCode);

      // Tell the new player their own info + current player list
      socket.emit('roomJoined', {
        roomCode: normalizedCode,
        playerId: player.id,
        player: serializePlayer(player, player.id),
        players: serializePlayers(room, player.id),
        totalRounds: room.totalRounds,
      });

      // Tell everyone ELSE in the room that this player joined
      socket.to(normalizedCode).emit('onPlayerJoined', {
        player: serializePlayer(player),
      });

      // System chat to room
      io.to(normalizedCode).emit('onChat', {
        senderId: 'system',
        senderName: 'System',
        text: `${player.name} joined the room 🎉`,
        type: 'system',
        timestamp: Date.now(),
      });

      logger.info(`${player.name} joined room ${normalizedCode} (${room.players.size}/6)`);
    } catch (err) {
      logger.error('joinRoom error:', err.message);
      emitError(socket, err.message || 'Could not join room.', 'JOIN_ROOM_ERROR');
    }
  });

  // ── leaveRoom ──────────────────────────────────────────────────────────────
  socket.on('leaveRoom', () => {
    handleLeave(io, socket, false);
  });

  // ── disconnect ─────────────────────────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    logger.info(`Socket disconnected: ${socket.id} — reason: ${reason}`);
    handleLeave(io, socket, true);
  });
}

// ── Shared leave logic ────────────────────────────────────────────────────────

function handleLeave(io, socket, isDisconnect) {
  const info = getSocketRoomInfo(socket.id);
  if (!info) return;

  const result = removePlayerBySocket(socket.id);
  if (!result) return;

  const { room, player, roomDeleted } = result;

  if (roomDeleted) {
    logger.info(`Room ${info.roomCode} deleted (empty)`);
    return;
  }

  socket.leave(info.roomCode);

  // Notify remaining players
  io.to(room.code).emit('onPlayerLeft', { playerId: player.id });

  // If host changed, notify who the new host is
  const newHost = [...room.players.values()].find((p) => p.isHost);
  if (newHost) {
    // Push updated full player list so everyone re-renders correctly
    for (const p of room.players.values()) {
      const recipientSocket = io.sockets.sockets.get(p.socketId);
      if (recipientSocket) {
        recipientSocket.emit('onPlayersUpdated', {
          players: serializePlayers(room, p.id),
          hostId: room.hostId,
        });
      }
    }
  }

  io.to(room.code).emit('onChat', {
    senderId: 'system',
    senderName: 'System',
    text: `${player.name} left the game.`,
    type: 'system',
    timestamp: Date.now(),
  });

  logger.info(`${player.name} left room ${room.code}. Players remaining: ${room.players.size}`);
}
