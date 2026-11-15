// server/src/game/gameEngine.js
// Pure game logic — no I/O, no socket references.
// Called by socket handlers; easier to unit test.

export const ROLES = ['King', 'Queen', 'Mantri', 'Soldier', 'Police', 'Thief'];

export const ROLE_META = {
  King:    { icon: '👑', color: '#f59e0b', description: 'Ruler of the kingdom. Worth 900 points.' },
  Queen:   { icon: '💎', color: '#ec4899', description: 'The most valuable — worth 1000 points.' },
  Mantri:  { icon: '📜', color: '#3b82f6', description: 'Wise minister. Worth 250 points.' },
  Soldier: { icon: '⚔️',  color: '#10b981', description: 'Brave guard. Worth 200 points.' },
  Police:  { icon: '🔵', color: '#6366f1', description: 'Find the Thief to earn 500 points!' },
  Thief:   { icon: '🗡️',  color: '#dc2626', description: 'Stay hidden! Get caught = 0 pts.' },
};

const BASE_SCORES = { King: 900, Queen: 1000, Mantri: 250, Soldier: 200 };

/**
 * Assign roles randomly to all players.
 * Returns { roleMap: Map<playerId, roleName>, policeId, thiefId }
 */
export function assignRoles(playerIds) {
  const shuffled = [...ROLES].sort(() => Math.random() - 0.5);
  const roleMap = new Map();
  playerIds.forEach((id, i) => roleMap.set(id, shuffled[i]));

  const policeId = [...roleMap.entries()].find(([, r]) => r === 'Police')?.[0] ?? null;
  const thiefId  = [...roleMap.entries()].find(([, r]) => r === 'Thief')?.[0]  ?? null;

  return { roleMap, policeId, thiefId };
}

/**
 * Calculate points for a completed round.
 * Returns Map<playerId, pointsEarned>
 */
export function calcPoints(roleMap, policeId, thiefId, guessedId) {
  const correct = guessedId !== null && guessedId === thiefId;
  const points = new Map();

  for (const [playerId, role] of roleMap) {
    if (BASE_SCORES[role] !== undefined) {
      points.set(playerId, BASE_SCORES[role]);
    } else if (role === 'Police') {
      points.set(playerId, correct ? 500 : 0);
    } else if (role === 'Thief') {
      points.set(playerId, correct ? 0 : 500);
    }
  }

  return { points, correct };
}

/**
 * Build the round-result payload sent to all clients.
 * revealedRoles is safe to broadcast — it's the end of the round.
 */
export function buildRoundResult(roleMap, policeId, thiefId, guessedId, points) {
  const revealedRoles = [...roleMap.entries()].map(([id, role]) => ({ id, role }));
  const pointsObj = Object.fromEntries(points);
  const correct = guessedId !== null && guessedId === thiefId;

  return { correct, policeId, thiefId, guessedId, revealedRoles, points: pointsObj };
}

/**
 * Build the per-player role payload (private — only sent to that one player).
 */
export function buildRolePayload(roleName) {
  const meta = ROLE_META[roleName] || {};
  return { name: roleName, ...meta };
}
