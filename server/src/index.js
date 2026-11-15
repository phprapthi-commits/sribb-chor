// server/src/index.js
// Entry point: sets up Express + Socket.IO and boots the server.

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { registerHandlers } from './socket/handlers.js';

// ── Express app ───────────────────────────────────────────────────────────────
const app = express();

app.use(express.json());

// Health-check endpoint — useful for deployment / uptime monitors
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ── HTTP + Socket.IO ──────────────────────────────────────────────────────────
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: config.clientUrl,
    methods: ['GET', 'POST'],
  },
  // Tune connection settings
  pingTimeout: 20_000,
  pingInterval: 10_000,
});

// ── Socket connection ─────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  registerHandlers(io, socket);
});

// ── Start ─────────────────────────────────────────────────────────────────────
httpServer.listen(config.port, () => {
  logger.info(`🟢 Chor Police server running on port ${config.port}`);
  logger.info(`   Accepting connections from: ${config.clientUrl}`);
  logger.info(`   Environment: ${config.nodeEnv}`);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function shutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully`);
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
