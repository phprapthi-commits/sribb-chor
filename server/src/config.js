// server/src/config.js
import 'dotenv/config';

export const config = {
  port:              parseInt(process.env.PORT || '3001', 10),
  clientUrl:         process.env.CLIENT_URL || 'http://localhost:5173',
  nodeEnv:           process.env.NODE_ENV || 'development',

  maxPlayersPerRoom: 6,
  guessTimerSeconds: 60,
  reconnectWindowMs: 30_000,
  chatRateLimitMs:   500,
  maxChatLength:     200,
  maxUsernameLength: 20,
  roomCodeLength:    6,
};
