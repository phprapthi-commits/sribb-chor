// server/src/config.js
// All environment configuration lives here.
// Add to .env, never hardcode in source.

import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  nodeEnv: process.env.NODE_ENV || 'development',

  // Game constants
  maxPlayersPerRoom: 6,
  guessTimerSeconds: 60,
  reconnectWindowMs: 30_000,     // 30 s to reconnect after disconnect
  chatRateLimitMs: 500,          // min ms between chat messages per socket
  maxChatLength: 200,
  maxUsernameLength: 20,
  roomCodeLength: 6,
};
