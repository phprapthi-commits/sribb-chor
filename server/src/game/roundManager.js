// server/src/game/roundManager.js
// Owns all server-side game timers and phase transitions.
// Imported by socket handlers; calls io.to(room.code).emit(...)

import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import {
  PHASES, clearRoomTimer, serializePlayers,
} from '../rooms/roomStore.js';
import {
  assignRoles, calcPoints, buildRoundResult, buildRolePayload,
} from './gameEngine.js';

// ── Exported phase-transition functions ───────────────────────────────────────

/**
 * Phase 1 → 2: start a new round (called by startGame or nextRound).
 * Assigns roles privately and moves to ROLE_REVEAL.
 */
export function startRound(io, room) {
  clearRoomTimer(room);

  room.currentRound++;
  room.readySet = new Set();
  room.guessedId = null;

  const playerIds = [...room.players.keys()];
  const { roleMap, policeId, thiefId } = assignRoles(playerIds);
  room.roleMap  = roleMap;
  room.policeId = policeId;
  room.thiefId  = thiefId;

  // Send each player ONLY their own role (private)
  for (const player of room.players.values()) {
    const roleName = roleMap.get(player.id);
    const sock = io.sockets.sockets.get(player.socketId);
    if (sock) {
      sock.emit('onRoleAssigned', { role: buildRolePayload(roleName) });
    }
  }

  // Broadcast phase change to everyone
  room.phase = PHASES.ROLE_REVEAL;
  io.to(room.code).emit('onPhaseChange', {
    phase: PHASES.ROLE_REVEAL,
    currentRound: room.currentRound,
    totalRounds: room.totalRounds,
  });

  logger.info(`[${room.code}] Round ${room.currentRound} started — Police: ${policeId}, Thief: ${thiefId}`);
}

/**
 * Called when a player sends 'playerReady'.
 * When everyone is ready, transition to POLICE_GUESS.
 */
export function handlePlayerReady(io, room, playerId) {
  if (room.phase !== PHASES.ROLE_REVEAL) return;

  room.readySet.add(playerId);
  logger.debug(`[${room.code}] ${playerId} ready (${room.readySet.size}/${room.players.size})`);

  if (room.readySet.size >= room.players.size) {
    startPoliceGuess(io, room);
  }
}

/**
 * Transition to POLICE_GUESS phase and start the 60-second countdown.
 */
export function startPoliceGuess(io, room) {
  clearRoomTimer(room);
  room.phase = PHASES.POLICE_GUESS;

  io.to(room.code).emit('onPhaseChange', {
    phase: PHASES.POLICE_GUESS,
    policePlayerId: room.policeId,
    currentRound: room.currentRound,
    totalRounds: room.totalRounds,
  });

  let remaining = config.guessTimerSeconds;

  room.timerRef = setInterval(() => {
    remaining--;
    io.to(room.code).emit('onTimerTick', { seconds: remaining });

    if (remaining <= 0) {
      clearRoomTimer(room);
      // Time's up — auto-fail (null = no guess)
      resolveRound(io, room, null);
    }
  }, 1000);

  logger.info(`[${room.code}] Police guess phase started (${config.guessTimerSeconds}s)`);
}

/**
 * Police submits a guess; validate, then resolve the round.
 */
export function handleGuess(io, room, policePlayerId, guessedPlayerId) {
  if (room.phase !== PHASES.POLICE_GUESS) return;
  if (policePlayerId !== room.policeId) return;
  if (room.guessedId !== null) return; // already guessed

  room.guessedId = guessedPlayerId;
  clearRoomTimer(room);
  resolveRound(io, room, guessedPlayerId);
}

/**
 * Compute scores, persist them, emit result, move to ROUND_RESULT.
 */
function resolveRound(io, room, guessedId) {
  const { points, correct } = calcPoints(room.roleMap, room.policeId, room.thiefId, guessedId);

  // Accumulate total scores
  for (const [pid, earned] of points) {
    room.scores.set(pid, (room.scores.get(pid) || 0) + earned);
  }

  const result = buildRoundResult(room.roleMap, room.policeId, room.thiefId, guessedId, points);

  room.phase = PHASES.ROUND_RESULT;

  // First send roundResult so the frontend has data before phaseChange re-renders
  io.to(room.code).emit('onRoundResult', result);
  io.to(room.code).emit('onPhaseChange', {
    phase: PHASES.ROUND_RESULT,
    currentRound: room.currentRound,
    totalRounds: room.totalRounds,
  });

  logger.info(
    `[${room.code}] Round ${room.currentRound} result — correct: ${correct}, guessedId: ${guessedId}`
  );
}

/**
 * Host triggers next round or ends the game.
 */
export function handleNextRound(io, room) {
  if (room.currentRound >= room.totalRounds) {
    endGame(io, room);
  } else {
    startRound(io, room);
  }
}

/**
 * End the game — emit final scores.
 */
export function endGame(io, room) {
  clearRoomTimer(room);
  room.phase = PHASES.GAME_END;

  const finalScores = Object.fromEntries(room.scores);

  io.to(room.code).emit('onPhaseChange', { phase: PHASES.GAME_END });
  io.to(room.code).emit('onGameEnd', { finalScores });

  logger.info(`[${room.code}] Game ended. Final scores: ${JSON.stringify(finalScores)}`);
}

/**
 * Handle a player disconnecting mid-game.
 * If in POLICE_GUESS and the police disconnected, auto-fail the round.
 * Otherwise notify and continue; if too few players, end the game.
 */
export function handleMidGameDisconnect(io, room, player) {
  const msg = `${player.name} disconnected. ${config.reconnectWindowMs / 1000}s to reconnect…`;
  io.to(room.code).emit('onChat', {
    senderId: 'system', senderName: 'System',
    text: msg, type: 'system', timestamp: Date.now(),
  });

  // If police disconnected during POLICE_GUESS, auto-resolve immediately
  if (room.phase === PHASES.POLICE_GUESS && player.id === room.policeId) {
    logger.info(`[${room.code}] Police disconnected — auto-resolving round`);
    clearRoomTimer(room);
    resolveRound(io, room, null);
  }
}

/**
 * Called when the reconnect window expires for a player.
 * Removes them from the room and decides whether the game can continue.
 */
export function handleReconnectExpired(io, room, player) {
  room.players.delete(player.id);
  room.scores.delete(player.id);

  io.to(room.code).emit('onPlayerLeft', { playerId: player.id });
  io.to(room.code).emit('onChat', {
    senderId: 'system', senderName: 'System',
    text: `${player.name} did not reconnect and was removed.`,
    type: 'system', timestamp: Date.now(),
  });

  // If fewer than 2 players remain, end the game
  if (room.players.size < 2) {
    io.to(room.code).emit('onChat', {
      senderId: 'system', senderName: 'System',
      text: 'Not enough players. Game ended.',
      type: 'system', timestamp: Date.now(),
    });
    endGame(io, room);
    return;
  }

  // If we were in POLICE_GUESS and police timed out already, nothing to do
  // (resolveRound already fired). Just push updated player list.
  for (const p of room.players.values()) {
    const sock = io.sockets.sockets.get(p.socketId);
    if (sock) {
      sock.emit('onPlayersUpdated', {
        players: serializePlayers(room, p.id),
        hostId: room.hostId,
      });
    }
  }

  logger.info(`[${room.code}] ${player.name} removed (reconnect window expired). ${room.players.size} players left.`);
}
