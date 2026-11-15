// src/services/gameService.js
// Mock game service that simulates what a real Socket.IO server would provide.
// ALL UI calls go through these functions — swap this file for a real socket
// implementation when connecting a real backend.
//
// Real backend interface contract:
//   createRoom(playerName)         → { roomCode, playerId }
//   joinRoom(roomCode, playerName) → { playerId }
//   startGame(totalRounds)
//   sendChatMessage(text)
//   setReady()
//   submitGuess(targetPlayerId)
//   nextRound()
//
//   onPlayerJoined(cb)   → cb({ player })
//   onPlayerLeft(cb)     → cb({ playerId })
//   onRoleAssigned(cb)   → cb({ role })
//   onPhaseChange(cb)    → cb({ phase, policePlayerId? })
//   onChat(cb)           → cb({ senderId, senderName, text, type })
//   onTimerTick(cb)      → cb({ seconds })
//   onRoundResult(cb)    → cb({ correct, policeId, thiefId, revealedRoles, points })
//   onGameEnd(cb)        → cb({ finalScores })

import useGameStore from '../store/gameStore';

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const BOT_NAMES = ['Arjun', 'Priya', 'Rajan', 'Meera', 'Vikram'];
const AVATARS = ['🦁', '🐯', '🦊', '🐺', '🦝', '🐻'];
const ROLES = ['King', 'Queen', 'Mantri', 'Soldier', 'Police', 'Thief'];

const ROLE_META = {
  King:    { icon: '👑', color: '#f59e0b', description: 'Ruler of the kingdom. Worth 900 points.' },
  Queen:   { icon: '💎', color: '#ec4899', description: 'The most valuable — worth 1000 points.' },
  Mantri:  { icon: '📜', color: '#3b82f6', description: 'Wise minister. Worth 250 points.' },
  Soldier: { icon: '⚔️',  color: '#10b981', description: 'Brave guard. Worth 200 points.' },
  Police:  { icon: '🔵', color: '#6366f1', description: 'Find the Thief to earn 500 points!' },
  Thief:   { icon: '🗡️',  color: '#dc2626', description: 'Stay hidden! Get caught = 0 pts.' },
};

const BASE_SCORES = { King: 900, Queen: 1000, Mantri: 250, Soldier: 200 };
const BOT_CHAT_LINES = [
  'Let\'s go! 🎉',
  'Who is the thief? 🤔',
  'I\'m definitely not the thief 😇',
  'This is so exciting!',
  'Police is thinking hard...',
  'May the best player win! 👑',
  'Ek dum ready! 🔥',
  'Chor kidhar hai? 👀',
];

// ── State ─────────────────────────────────────────────────────────────────────

let _listeners = {};
let _timerId = null;
let _botChatIntervals = [];
let _roleMap = {};     // playerId → role name
let _localPlayerId = null;
let _players = [];
let _totalRounds = 3;
let _currentRound = 0;
let _policeId = null;
let _thiefId = null;
let _readyPlayers = new Set();

function emit(event, data) {
  (_listeners[event] || []).forEach((cb) => {
    try { cb(data); } catch (e) { console.error('[mock] listener error', e); }
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

// ── Bot simulation ────────────────────────────────────────────────────────────

function startBotChat() {
  BOT_NAMES.forEach((name, i) => {
    const interval = setInterval(() => {
      if (Math.random() < 0.3) {
        const bot = _players.find((p) => p.name === name);
        if (!bot) return;
        emit('chat', {
          senderId: bot.id,
          senderName: bot.name,
          text: BOT_CHAT_LINES[Math.floor(Math.random() * BOT_CHAT_LINES.length)],
          type: 'player',
        });
      }
    }, 8000 + i * 1500);
    _botChatIntervals.push(interval);
  });
}

function stopBotChat() {
  _botChatIntervals.forEach(clearInterval);
  _botChatIntervals = [];
}

function assignRoles() {
  const shuffled = [...ROLES].sort(() => Math.random() - 0.5);
  _players.forEach((p, i) => {
    _roleMap[p.id] = shuffled[i];
  });
  _policeId = Object.entries(_roleMap).find(([, r]) => r === 'Police')?.[0];
  _thiefId  = Object.entries(_roleMap).find(([, r]) => r === 'Thief')?.[0];
}

function startRound() {
  _currentRound++;
  _readyPlayers.clear();
  assignRoles();

  useGameStore.getState().setCurrentRound(_currentRound);
  useGameStore.getState().setPolicePlayerId(_policeId);

  // Emit role to local player
  const myRole = _roleMap[_localPlayerId];
  emit('roleAssigned', { role: { name: myRole, ...ROLE_META[myRole] } });

  // Phase: role-reveal
  setTimeout(() => {
    emit('phaseChange', { phase: 'role-reveal' });
  }, 300);

  // Auto-ready bots after 3s
  _players.filter((p) => !p.isLocal).forEach((p) => {
    setTimeout(() => {
      _readyPlayers.add(p.id);
      checkAllReady();
    }, 3000 + Math.random() * 2000);
  });
}

function checkAllReady() {
  if (_readyPlayers.size >= _players.length) {
    // Transition to police-guess
    emit('phaseChange', { phase: 'police-guess', policePlayerId: _policeId });
    useGameStore.getState().setTimerSeconds(60);
    startTimer();

    // If a bot is police, they guess randomly after 5-15s
    if (_policeId !== _localPlayerId) {
      const delay = 5000 + Math.random() * 10000;
      setTimeout(() => {
        const others = _players.filter((p) => p.id !== _policeId);
        const guess = others[Math.floor(Math.random() * others.length)];
        resolveGuess(guess.id);
      }, delay);
    }
  }
}

function startTimer() {
  clearInterval(_timerId);
  let t = 60;
  _timerId = setInterval(() => {
    t--;
    emit('timerTick', { seconds: t });
    useGameStore.getState().setTimerSeconds(t);
    if (t <= 0) {
      clearInterval(_timerId);
      // Auto-fail: police runs out of time
      resolveGuess(null);
    }
  }, 1000);
}

function resolveGuess(guessedId) {
  clearInterval(_timerId);
  const correct = guessedId === _thiefId;

  // Build points
  const points = {};
  _players.forEach((p) => {
    const role = _roleMap[p.id];
    if (BASE_SCORES[role] !== undefined) {
      points[p.id] = BASE_SCORES[role];
    } else if (role === 'Police') {
      points[p.id] = correct ? 500 : 0;
    } else if (role === 'Thief') {
      points[p.id] = correct ? 0 : 500;
    }
  });

  const revealedRoles = _players.map((p) => ({ id: p.id, role: _roleMap[p.id] }));

  emit('roundResult', {
    correct,
    policeId: _policeId,
    thiefId: _thiefId,
    guessedId,
    revealedRoles,
    points,
  });
  emit('phaseChange', { phase: 'round-result' });
  useGameStore.getState().updateScores(points);
}

// ── Public API ────────────────────────────────────────────────────────────────

export function createRoom(playerName) {
  return new Promise((resolve) => {
    const playerId = 'local-' + uid();
    const roomCode = Math.random().toString(36).slice(2, 8).toUpperCase();
    _localPlayerId = playerId;
    _players = [];

    const localPlayer = {
      id: playerId,
      name: playerName,
      avatar: AVATARS[0],
      isHost: true,
      isLocal: true,
      isMuted: false,
      isCameraOff: false,
    };
    _players.push(localPlayer);
    useGameStore.getState().setPlayers([..._players]);
    useGameStore.getState().setIsHost(true);
    useGameStore.getState().setPlayerId(playerId);
    useGameStore.getState().setRoomCode(roomCode);

    // Bots join one-by-one
    BOT_NAMES.forEach((name, i) => {
      setTimeout(() => {
        const bot = {
          id: 'bot-' + uid(),
          name,
          avatar: AVATARS[i + 1],
          isHost: false,
          isLocal: false,
          isMuted: false,
          isCameraOff: false,
        };
        _players.push(bot);
        useGameStore.getState().setPlayers([..._players]);
        emit('playerJoined', { player: bot });
        emit('chat', {
          senderId: 'system',
          senderName: 'System',
          text: `${name} joined the room 🎉`,
          type: 'system',
        });
      }, (i + 1) * 1200);
    });

    resolve({ roomCode, playerId });
  });
}

export function joinRoom(roomCode, playerName) {
  return new Promise((resolve, reject) => {
    if (roomCode.length !== 6) {
      reject(new Error('Invalid room code'));
      return;
    }
    // In the mock, joining also creates the room (single-tab demo)
    createRoom(playerName).then(({ playerId }) => {
      useGameStore.getState().setIsHost(false);
      resolve({ playerId });
    });
  });
}

export function startGame(totalRounds) {
  _totalRounds = totalRounds;
  _currentRound = 0;
  useGameStore.getState().resetGame();
  useGameStore.getState().setCurrentRound(0);
  useGameStore.getState().setPlayers([..._players]);
  startBotChat();
  emit('chat', {
    senderId: 'system',
    senderName: 'System',
    text: '👑 The game begins! Good luck everyone!',
    type: 'system',
  });
  setTimeout(() => startRound(), 800);
}

export function sendChatMessage(text) {
  const store = useGameStore.getState();
  emit('chat', {
    senderId: store.playerId,
    senderName: store.playerName,
    text,
    type: 'player',
  });
}

export function setReady() {
  _readyPlayers.add(_localPlayerId);
  checkAllReady();
}

export function submitGuess(targetPlayerId) {
  resolveGuess(targetPlayerId);
}

export function nextRound() {
  if (_currentRound >= _totalRounds) {
    // Game over
    const finalScores = useGameStore.getState().scores;
    stopBotChat();
    emit('phaseChange', { phase: 'final-leaderboard' });
    emit('gameEnd', { finalScores });
  } else {
    startRound();
  }
}

export function leaveRoom() {
  clearInterval(_timerId);
  stopBotChat();
  _listeners = {};
  _players = [];
  _roleMap = {};
  _localPlayerId = null;
  _readyPlayers.clear();
}

// ── Event listeners ───────────────────────────────────────────────────────────

export function onPlayerJoined(cb)  { on('playerJoined', cb);  return () => off('playerJoined', cb);  }
export function onPlayerLeft(cb)    { on('playerLeft', cb);    return () => off('playerLeft', cb);    }
export function onRoleAssigned(cb)  { on('roleAssigned', cb);  return () => off('roleAssigned', cb);  }
export function onPhaseChange(cb)   { on('phaseChange', cb);   return () => off('phaseChange', cb);   }
export function onChat(cb)          { on('chat', cb);          return () => off('chat', cb);          }
export function onTimerTick(cb)     { on('timerTick', cb);     return () => off('timerTick', cb);     }
export function onRoundResult(cb)   { on('roundResult', cb);   return () => off('roundResult', cb);   }
export function onGameEnd(cb)       { on('gameEnd', cb);       return () => off('gameEnd', cb);       }

