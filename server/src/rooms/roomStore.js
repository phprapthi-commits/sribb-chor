// server/src/rooms/roomStore.js
// In-memory room registry.
// All mutable state lives here so it can be swapped for Redis later:
// just replace the Map reads/writes with async Redis calls.

import { config } from '../config.js';

// ── Data shapes ───────────────────────────────────────────────────────────────
//
// Room:
// {
//   code        : string            6-char uppercase code
//   hostId      : string            playerId of the current host
//   phase       : PHASES.*
//   players     : Map<playerId, Player>
//   totalRounds : number
//   currentRound: number
//   scores      : Map<playerId, number>   total across rounds
//   roleMap     : Map<playerId, string>   current round roles (private)
//   policeId    : string | null
//   thiefId     : string | null
//   readySet    : Set<playerId>
//   guessedId   : string | null    target the police picked (or null = timeout)
//   timerRef    : NodeJS timer ref
//   createdAt   : number
// }
//
// Player:
// {
//   id          : string   stable across reconnects (session ID)
//   name        : string
//   avatar      : string   emoji
//   socketId    : string   current socket.id (changes on reconnect)
//   isHost      : boolean
//   isMuted     : boolean
//   isCameraOff : boolean
//   disconnectedAt: number | null   epoch ms, null if connected
// }

export const PHASES = Object.freeze({
  LOBBY:          'lobby',
  ROLE_REVEAL:    'role-reveal',
  POLICE_GUESS:   'police-guess',
  ROUND_RESULT:   'round-result',
  GAME_END:       'final-leaderboard',
});

// emoji avatars — assigned in join order
const AVATARS = ['🦁', '🐯', '🦊', '🐺', '🦝', '🐻'];

/** rooms: Map<roomCode, Room> */
const rooms = new Map();

/** socketToRoom: Map<socketId, { roomCode, playerId }> */
const socketToRoom = new Map();

/** sessionToSocket: Map<playerId (session), socketId> — for reconnect */
const sessionToSocket = new Map();

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  let code;
  do {
    code = Array.from({ length: config.roomCodeLength }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');
  } while (rooms.has(code));
  return code;
}

function generatePlayerId() {
  return 'p_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ── Room CRUD ─────────────────────────────────────────────────────────────────

/**
 * Create a new room and add the creator as host.
 * Returns { room, player }.
 */
export function createRoom(socketId, playerName) {
  const code = generateCode();
  const playerId = generatePlayerId();

  const player = {
    id: playerId,
    name: playerName,
    avatar: AVATARS[0],
    socketId,
    isHost: true,
    isMuted: false,
    isCameraOff: false,
    disconnectedAt: null,
  };

  const room = {
    code,
    hostId: playerId,
    phase: PHASES.LOBBY,
    players: new Map([[playerId, player]]),
    totalRounds: 3,
    currentRound: 0,
    scores: new Map([[playerId, 0]]),
    roleMap: new Map(),
    policeId: null,
    thiefId: null,
    readySet: new Set(),
    guessedId: null,
    timerRef: null,
    createdAt: Date.now(),
  };

  rooms.set(code, room);
  socketToRoom.set(socketId, { roomCode: code, playerId });
  sessionToSocket.set(playerId, socketId);

  return { room, player };
}

/**
 * Add a player to an existing room.
 * Returns { room, player } or throws an Error with a user-visible message.
 */
export function joinRoom(socketId, roomCode, playerName) {
  const room = rooms.get(roomCode);
  if (!room) throw new Error('Room not found. Check the code and try again.');
  if (room.phase !== PHASES.LOBBY) throw new Error('Game has already started. You cannot join now.');
  if (room.players.size >= config.maxPlayersPerRoom) throw new Error('Room is full (6/6 players).');

  // Prevent duplicate socket in a room
  if (socketToRoom.has(socketId)) throw new Error('You are already in a room. Leave first.');

  const avatarIndex = room.players.size; // 0-based, capped at 5
  const playerId = generatePlayerId();

  const player = {
    id: playerId,
    name: playerName,
    avatar: AVATARS[Math.min(avatarIndex, AVATARS.length - 1)],
    socketId,
    isHost: false,
    isMuted: false,
    isCameraOff: false,
    disconnectedAt: null,
  };

  room.players.set(playerId, player);
  room.scores.set(playerId, 0);
  socketToRoom.set(socketId, { roomCode, playerId });
  sessionToSocket.set(playerId, socketId);

  return { room, player };
}

/**
 * Remove a player from their room by socketId.
 * Returns { room, player, roomDeleted } or null if socket wasn't in a room.
 */
export function removePlayerBySocket(socketId) {
  const info = socketToRoom.get(socketId);
  if (!info) return null;

  const { roomCode, playerId } = info;
  const room = rooms.get(roomCode);
  if (!room) return null;

  const player = room.players.get(playerId);
  room.players.delete(playerId);
  socketToRoom.delete(socketId);
  sessionToSocket.delete(playerId);

  let roomDeleted = false;
  if (room.players.size === 0) {
    clearRoomTimer(room);
    rooms.delete(roomCode);
    roomDeleted = true;
  } else if (room.hostId === playerId) {
    // Transfer host to the first remaining player
    const newHost = room.players.values().next().value;
    newHost.isHost = true;
    room.hostId = newHost.id;
  }

  return { room, player, roomDeleted };
}

/**
 * Mark a player as disconnected (keep them in the room for reconnect window).
 */
export function markDisconnected(socketId) {
  const info = socketToRoom.get(socketId);
  if (!info) return null;

  const room = rooms.get(info.roomCode);
  if (!room) return null;

  const player = room.players.get(info.playerId);
  if (player) player.disconnectedAt = Date.now();

  socketToRoom.delete(socketId);
  sessionToSocket.delete(info.playerId);

  return { room, player };
}

/**
 * Attempt reconnect: bind a new socketId to an existing session playerId.
 * Returns { room, player } or null.
 */
export function reconnectPlayer(socketId, playerId) {
  // Find which room this playerId is in
  for (const room of rooms.values()) {
    const player = room.players.get(playerId);
    if (!player) continue;
    if (player.disconnectedAt === null) return null; // already connected

    const elapsed = Date.now() - player.disconnectedAt;
    if (elapsed > config.reconnectWindowMs) return null; // window expired

    player.socketId = socketId;
    player.disconnectedAt = null;
    socketToRoom.set(socketId, { roomCode: room.code, playerId });
    sessionToSocket.set(playerId, socketId);
    return { room, player };
  }
  return null;
}

// ── Accessors ─────────────────────────────────────────────────────────────────

export function getRoomBySocket(socketId) {
  const info = socketToRoom.get(socketId);
  return info ? rooms.get(info.roomCode) : null;
}

export function getPlayerBySocket(socketId) {
  const info = socketToRoom.get(socketId);
  if (!info) return null;
  const room = rooms.get(info.roomCode);
  return room ? room.players.get(info.playerId) : null;
}

export function getSocketRoomInfo(socketId) {
  return socketToRoom.get(socketId) || null;
}

export function getRoom(roomCode) {
  return rooms.get(roomCode) || null;
}

export function getRoomPlayerCount(roomCode) {
  const room = rooms.get(roomCode);
  return room ? room.players.size : 0;
}

// ── Serialization ─────────────────────────────────────────────────────────────

/**
 * Convert a Player to a safe shape to send to clients.
 * Never includes socketId or server-only fields.
 */
export function serializePlayer(player, localPlayerId = null) {
  return {
    id: player.id,
    name: player.name,
    avatar: player.avatar,
    isHost: player.isHost,
    isLocal: player.id === localPlayerId,
    isMuted: player.isMuted,
    isCameraOff: player.isCameraOff,
  };
}

/**
 * Serialize all players in a room for a specific recipient.
 */
export function serializePlayers(room, localPlayerId = null) {
  return [...room.players.values()].map((p) => serializePlayer(p, localPlayerId));
}

// ── Timer helpers ──────────────────────────────────────────────────────────────

export function clearRoomTimer(room) {
  if (room.timerRef) {
    clearInterval(room.timerRef);
    room.timerRef = null;
  }
}
