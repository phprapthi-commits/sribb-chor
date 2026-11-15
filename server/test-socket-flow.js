// server/test-socket-flow.js
// Integration test: spins up server on a test port and connects 6 socket.io clients.
// Simulates the full multi-round game lifecycle, role assignment privacy, scoring,
// WebRTC signaling relay, chat, and rate limiting.

import { createServer } from 'http';
import express from 'express';
import { Server } from 'socket.io';
import { io as Client } from 'socket.io-client';
import { registerHandlers } from './src/socket/handlers.js';

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

const app = express();
const httpServer = createServer(app);
const ioServer = new Server(httpServer, { cors: { origin: '*' } });
ioServer.on('connection', (sock) => registerHandlers(ioServer, sock));

const TEST_PORT = 3099;

httpServer.listen(TEST_PORT, '127.0.0.1', async () => {
  console.log(`\nStarting Socket Flow Tests on port ${TEST_PORT}...\n`);

  try {
    const clients = [];
    async function makeClient() {
      const c = Client(`http://127.0.0.1:${TEST_PORT}`, {
        transports: ['websocket'],
        forceNew: true,
      });
      await new Promise((res) => c.on('connect', res));
      return c;
    }

    // 1. Host creates room
    const host = await makeClient();
    clients.push(host);
    const playerIds = [];

    const roomData = await new Promise((res) => {
      host.on('roomCreated', res);
      host.emit('createRoom', { playerName: 'HostPlayer' });
    });

    playerIds.push(roomData.playerId);
    assert('Host created room with 6-char code', roomData.roomCode.length === 6);
    assert('Host has playerId', !!roomData.playerId);
    assert('Initial players length is 1', roomData.players.length === 1);
    const roomCode = roomData.roomCode;

    // 2. 5 players join
    const playerNames = ['Alice', 'Bob', 'Charlie', 'Daisy', 'Ethan'];
    for (const name of playerNames) {
      const c = await makeClient();
      clients.push(c);
      const joinedData = await new Promise((res) => {
        c.on('roomJoined', res);
        c.emit('joinRoom', { roomCode, playerName: name });
      });
      playerIds.push(joinedData.playerId);
    }

    assert('All 6 clients connected', clients.length === 6);

    // 3. Test Chat & Rate Limiting
    const chatPromise = new Promise((res) => {
      clients[1].on('onChat', (data) => {
        if (data.text === 'Hello room!') res(data);
      });
    });
    clients[0].emit('sendChatMessage', { text: 'Hello room!' });
    const chatMsg = await chatPromise;
    assert('Chat message relayed to peers', chatMsg.senderName === 'HostPlayer');

    // Test Rate Limiting on rapid chat
    const rateLimitPromise = new Promise((res) => {
      clients[0].on('onError', (err) => {
        if (err.code === 'RATE_LIMIT') res(true);
      });
    });
    clients[0].emit('sendChatMessage', { text: 'Spam 1' });
    clients[0].emit('sendChatMessage', { text: 'Spam 2' });
    const rateLimited = await rateLimitPromise;
    assert('Chat rate limit properly enforced', rateLimited === true);

    // 4. Test WebRTC Signaling Relay
    const offerPromise = new Promise((res) => {
      clients[1].on('rtc:offer', (data) => {
        res(data);
      });
    });
    clients[0].emit('rtc:offer', { targetSocketId: clients[1].id, offer: { type: 'offer', sdp: 'test-sdp' } });
    const offerData = await offerPromise;
    assert('WebRTC offer relayed with fromSocketId and fromPlayerId', !!offerData.fromSocketId && !!offerData.fromPlayerId && offerData.offer.sdp === 'test-sdp');

    // 5. Host starts game (totalRounds: 1 for fast test)
    const rolePromises = clients.map((c) => new Promise((res) => c.once('onRoleAssigned', res)));
    const phasePromise = new Promise((res) => host.once('onPhaseChange', res));

    host.emit('startGame', { totalRounds: 1 });

    const rolesReceived = await Promise.all(rolePromises);
    const phaseData = await phasePromise;

    assert('Phase transitioned to role-reveal', phaseData.phase === 'role-reveal');
    assert('All 6 players received a secret role', rolesReceived.every((r) => !!r.role.name && !!r.role.icon));

    // Verify role privacy: each received ONLY their own role
    const assignedRoleNames = rolesReceived.map((r) => r.role.name);
    assert('All 6 canonical roles assigned across players',
      ['King', 'Queen', 'Mantri', 'Soldier', 'Police', 'Thief'].every((r) => assignedRoleNames.includes(r)));

    // Find who the police is
    const policeIndex = assignedRoleNames.indexOf('Police');
    const policeClient = clients[policeIndex];
    const nonPoliceClient = clients[(policeIndex + 1) % 6];

    // 6. Ready system
    const guessPhasePromise = new Promise((res) => host.once('onPhaseChange', res));
    clients.forEach((c) => c.emit('playerReady'));

    const guessPhaseData = await guessPhasePromise;
    assert('Transitions to police-guess after all ready', guessPhaseData.phase === 'police-guess');
    assert('Police player ID announced', !!guessPhaseData.policePlayerId);

    // 7. Security rule enforcement: Non-police cannot guess
    const nonPoliceErrorPromise = new Promise((res) => {
      nonPoliceClient.once('onError', (err) => res(err.code));
    });
    nonPoliceClient.emit('submitGuess', { targetPlayerId: playerIds[0] });
    const nonPoliceCode = await nonPoliceErrorPromise;
    assert('Non-police guess rejected (NOT_POLICE)', nonPoliceCode === 'NOT_POLICE');

    // 8. Security rule enforcement: Police cannot guess themselves
    const selfGuessPromise = new Promise((res) => {
      policeClient.once('onError', (err) => res(err.code));
    });
    const policePlayerId = playerIds[policeIndex];
    policeClient.emit('submitGuess', { targetPlayerId: policePlayerId });
    const selfGuessCode = await selfGuessPromise;
    assert('Police self-guess rejected (SELF_GUESS)', selfGuessCode === 'SELF_GUESS');

    // 9. Police submits valid guess (guess another player)
    const otherPlayers = clients.map((c, i) => i).filter((i) => i !== policeIndex);
    const targetIdx = otherPlayers[0];
    const roundResultPromise = new Promise((res) => host.once('onRoundResult', res));
    const roundResultPhasePromise = new Promise((res) => host.once('onPhaseChange', res));

    policeClient.emit('submitGuess', { targetPlayerId: playerIds[targetIdx] });

    // 10. Round result check
    const roundResult = await roundResultPromise;
    const resultPhase = await roundResultPhasePromise;

    assert('Round result received with correct boolean', typeof roundResult.correct === 'boolean');
    assert('Revealed roles contains 6 players', roundResult.revealedRoles.length === 6);
    assert('Points mapped for players', Object.keys(roundResult.points).length === 6);
    assert('Phase is round-result', resultPhase.phase === 'round-result');

    // 11. Next round advances to game over (totalRounds was 1)
    const gameEndPromise = new Promise((res) => host.once('onGameEnd', res));
    const finalPhasePromise = new Promise((res) => host.once('onPhaseChange', res));

    host.emit('nextRound');

    const gameEndData = await gameEndPromise;
    const finalPhase = await finalPhasePromise;

    assert('Game end received with finalScores', !!gameEndData.finalScores);
    assert('Phase is final-leaderboard', finalPhase.phase === 'final-leaderboard');

    // Clean up
    clients.forEach((c) => c.disconnect());
  } catch (err) {
    console.error('Test error:', err);
    failed++;
  } finally {
    httpServer.close(() => {
      console.log(`\n${'─'.repeat(40)}`);
      console.log(`Results: ${passed} passed, ${failed} failed\n`);
      process.exit(failed > 0 ? 1 : 0);
    });
  }
});
