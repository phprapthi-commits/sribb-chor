// server/src/utils/rateLimiter.js
// Simple per-socket in-memory rate limiter.
// Map<socketId, lastMessageTimestamp>

import { config } from '../config.js';

const lastMessage = new Map();

/**
 * Returns true if this socket is allowed to send a chat message right now.
 * Rejects if the previous message was sent less than chatRateLimitMs ago.
 */
export function allowChat(socketId) {
  const now = Date.now();
  const last = lastMessage.get(socketId) || 0;
  if (now - last < config.chatRateLimitMs) return false;
  lastMessage.set(socketId, now);
  return true;
}

/**
 * Clean up when a socket disconnects.
 */
export function clearRateLimit(socketId) {
  lastMessage.delete(socketId);
}
