# 👑 Chor Police — Multiplayer Role-Based Game (Frontend)

A fun, colorful web frontend for the classic Indian card game *Raja Mantri Chor Sipahi* (King Minister Thief Police), reimagined for 6 players with video call and chat support.

## 🚀 Setup

```bash
cd chor-police
npm install
npm run dev
# Open http://localhost:5173
```

## 🗂️ Folder Structure

```
src/
├── components/       # Reusable UI components
│   ├── Avatar.jsx      Circular avatar with initials fallback
│   ├── Button.jsx      Styled button (primary/gold/danger/secondary/ghost)
│   ├── ChatBox.jsx     Chat panel with auto-scroll and system messages
│   ├── Modal.jsx       Animated modal/dialog
│   ├── PhaseBanner.jsx Top banner showing current game phase
│   ├── RoleCard.jsx    3D card-flip animation for role reveal
│   ├── ScoreBoard.jsx  Live score table with animated updates
│   ├── Timer.jsx       SVG circular countdown timer
│   └── VideoTile.jsx   Video tile (real stream or avatar placeholder)
│
├── hooks/
│   ├── useGame.js      Wires gameService events → Zustand store
│   └── useMedia.js     Camera/mic toggle helpers
│
├── pages/
│   ├── HomePage.jsx    Name input, Create/Join room
│   ├── LobbyPage.jsx   Player slots, camera preview, host settings
│   ├── GamePage.jsx    Video grid, chat, scoreboard, media controls
│   └── overlays/
│       ├── RoleRevealOverlay.jsx   Card-flip reveal + Ready button
│       ├── PoliceGuessOverlay.jsx  Police picks suspect; others wait
│       ├── RoundResultOverlay.jsx  All roles + points earned
│       └── FinalLeaderboard.jsx   Podium + rankings + Play Again
│
├── services/         ← Only these two files change for a real backend
│   ├── gameService.js  Mock game server (rooms, bots, events)
│   └── videoService.js WebRTC helpers (getUserMedia, toggleMic/Camera, stubs)
│
└── store/
    └── gameStore.js    Zustand global state
```

## 🎮 Game Rules

| Role    | Points |
|---------|--------|
| Queen   | 1000 (fixed) |
| King    | 900 (fixed) |
| Mantri  | 250 (fixed) |
| Soldier | 200 (fixed) |
| Police  | 500 if correct / 0 if wrong |
| Thief   | 0 if caught / 500 if escaped |

Requires exactly 6 players. Roles are assigned secretly. The Police must identify the Thief. Play N rounds and tally total scores.

## 🤖 Mock Service

`src/services/gameService.js` simulates a full Socket.IO server in-browser:

- Creates a room with a 6-character code
- Spawns 5 bot players who join one by one over ~6 seconds
- Assigns roles randomly each round
- Bots send chat messages every ~8–12 seconds
- If a bot is Police, they guess randomly after 5–15 seconds
- Timer counts down from 60 seconds; auto-fail if Police runs out of time

## 🔌 Connecting a Real Backend

Replace **only** `src/services/gameService.js` and `src/services/videoService.js`:

```js
// gameService.js: replace in-process emit with socket.io-client
import { io } from 'socket.io-client';
const socket = io('https://your-server.com');

// videoService.js: fill in the RTCPeerConnection stubs
```

All UI components, hooks, pages, and store stay unchanged.

## 🎨 Tech Stack

- React 18 + Vite
- Tailwind CSS v4
- Framer Motion (animations)
- Zustand (state)
- React Router v6
- Lucide React (icons)
- Browser WebRTC / getUserMedia
