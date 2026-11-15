// server/test-game.js
// Tests game logic: role assignment, scoring, round progression, edge cases.

import { assignRoles, calcPoints, buildRoundResult, ROLES } from './src/game/gameEngine.js';

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

console.log('\n── Role Assignment Tests ──');
const players = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
const { roleMap, policeId, thiefId } = assignRoles(players);

assert('Exactly 6 roles assigned', roleMap.size === 6);
assert('All 6 players have a role', players.every(id => roleMap.has(id)));
const assignedRoles = [...roleMap.values()];
assert('Contains all 6 canonical roles', ROLES.every(r => assignedRoles.includes(r)));
assert('Police assigned to a player', policeId && players.includes(policeId));
assert('Thief assigned to a player', thiefId && players.includes(thiefId));
assert('Police and Thief are distinct players', policeId !== thiefId);

console.log('\n── Scoring Tests: Police Guesses Correctly ──');
// Mock role map
const testRoles = new Map([
  ['p_queen', 'Queen'],
  ['p_king', 'King'],
  ['p_mantri', 'Mantri'],
  ['p_soldier', 'Soldier'],
  ['p_police', 'Police'],
  ['p_thief', 'Thief'],
]);

const correctResult = calcPoints(testRoles, 'p_police', 'p_thief', 'p_thief');
assert('Correct guess returns correct = true', correctResult.correct === true);
assert('Queen gets 1000 pts', correctResult.points.get('p_queen') === 1000);
assert('King gets 900 pts', correctResult.points.get('p_king') === 900);
assert('Mantri gets 250 pts', correctResult.points.get('p_mantri') === 250);
assert('Soldier gets 200 pts', correctResult.points.get('p_soldier') === 200);
assert('Police gets 500 pts when correct', correctResult.points.get('p_police') === 500);
assert('Thief gets 0 pts when caught', correctResult.points.get('p_thief') === 0);

console.log('\n── Scoring Tests: Police Guesses Wrong ──');
const wrongResult = calcPoints(testRoles, 'p_police', 'p_thief', 'p_soldier');
assert('Wrong guess returns correct = false', wrongResult.correct === false);
assert('Queen gets 1000 pts', wrongResult.points.get('p_queen') === 1000);
assert('King gets 900 pts', wrongResult.points.get('p_king') === 900);
assert('Mantri gets 250 pts', wrongResult.points.get('p_mantri') === 250);
assert('Soldier gets 200 pts', wrongResult.points.get('p_soldier') === 200);
assert('Police gets 0 pts when wrong', wrongResult.points.get('p_police') === 0);
assert('Thief gets 500 pts when escaped', wrongResult.points.get('p_thief') === 500);

console.log('\n── Scoring Tests: Timer Expires (No Guess / null) ──');
const timeoutResult = calcPoints(testRoles, 'p_police', 'p_thief', null);
assert('Timeout returns correct = false', timeoutResult.correct === false);
assert('Police gets 0 pts on timeout', timeoutResult.points.get('p_police') === 0);
assert('Thief gets 500 pts on timeout', timeoutResult.points.get('p_thief') === 500);

console.log('\n── Round Result Payload Tests ──');
const payload = buildRoundResult(testRoles, 'p_police', 'p_thief', 'p_thief', correctResult.points);
assert('Payload has revealedRoles for all 6 players', payload.revealedRoles.length === 6);
assert('Payload has correct points map', payload.points.p_queen === 1000 && payload.points.p_police === 500);
assert('Payload flags correct as true', payload.correct === true);

console.log(`\n${'─'.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
