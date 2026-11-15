// server/test-rooms.js
// Quick smoke test for roomStore logic (no network needed).
// Run:  node test-rooms.js

import {
  createRoom, joinRoom, removePlayerBySocket,
  getRoomBySocket, getPlayerBySocket, serializePlayers,
  PHASES,
} from './src/rooms/roomStore.js';

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

console.log('\n── createRoom ──');
const { room: r1, player: p1 } = createRoom('sock-1', 'Alice');
assert('room code is 6 chars', r1.code.length === 6);
assert('room code is uppercase', r1.code === r1.code.toUpperCase());
assert('phase is lobby', r1.phase === PHASES.LOBBY);
assert('creator is host', p1.isHost === true);
assert('creator is in room', r1.players.has(p1.id));
assert('getRoomBySocket works', getRoomBySocket('sock-1')?.code === r1.code);
assert('getPlayerBySocket works', getPlayerBySocket('sock-1')?.id === p1.id);

const serialized = serializePlayers(r1, p1.id);
assert('serialize: isLocal=true for self', serialized[0].isLocal === true);
assert('serialize: no socketId exposed', !('socketId' in serialized[0]));

console.log('\n── joinRoom ──');
const { room: r2, player: p2 } = joinRoom('sock-2', r1.code, 'Bob');
assert('Bob joined same room', r2.code === r1.code);
assert('room has 2 players', r2.players.size === 2);
assert('Bob is NOT host', p2.isHost === false);
assert('Bob got different avatar', p2.avatar !== p1.avatar);

const ser2 = serializePlayers(r2, p2.id);
assert('serialize: Alice isLocal=false for Bob', ser2.find(p => p.id === p1.id)?.isLocal === false);
assert('serialize: Bob isLocal=true for Bob',   ser2.find(p => p.id === p2.id)?.isLocal === true);

console.log('\n── joinRoom errors ──');
try {
  joinRoom('sock-X', 'ZZZZZZ', 'Charlie');
  assert('missing room throws', false);
} catch(e) {
  assert('missing room throws', e.message.includes('not found'));
}

try {
  joinRoom('sock-2', r1.code, 'Dave'); // sock-2 already in room
  assert('duplicate socket throws', false);
} catch(e) {
  assert('duplicate socket throws', e.message.includes('already in a room'));
}

console.log('\n── removePlayerBySocket (non-host) ──');
const { roomDeleted, player: removed } = removePlayerBySocket('sock-2');
assert('Bob removed', removed.id === p2.id);
assert('room not deleted', !roomDeleted);
assert('1 player remaining', r1.players.size === 1);

console.log('\n── removePlayerBySocket (host leaves, host transferred) ──');
const { room: r3 } = createRoom('sock-A', 'HostPlayer');
joinRoom('sock-B', r3.code, 'GuestPlayer');
const { room: r3after } = removePlayerBySocket('sock-A');
const newHost = [...r3after.players.values()][0];
assert('host transferred', newHost.isHost === true);
assert('room not deleted', r3after.players.size === 1);

console.log('\n── removePlayerBySocket (last player, room deleted) ──');
const { room: r4 } = createRoom('sock-C', 'Solo');
const { roomDeleted: rd } = removePlayerBySocket('sock-C');
assert('room deleted when empty', rd === true);

console.log(`\n${'─'.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
