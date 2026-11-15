// server/src/utils/sanitize.js
// Light input sanitisation helpers used by socket handlers.

import { config } from '../config.js';

/**
 * Strip HTML/script-ish characters and trim whitespace.
 * Returns a safe string capped at maxLength.
 */
export function sanitizeText(raw, maxLength = 200) {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[<>]/g, '')          // remove angle brackets
    .replace(/\s+/g, ' ')          // collapse whitespace
    .trim()
    .slice(0, maxLength);
}

/**
 * Sanitize and validate a player username.
 * Returns { ok: true, value } or { ok: false, reason }.
 */
export function validateUsername(raw) {
  const name = sanitizeText(raw, config.maxUsernameLength);
  if (!name || name.length < 2) {
    return { ok: false, reason: 'Name must be at least 2 characters.' };
  }
  return { ok: true, value: name };
}

/**
 * Validate a room code (6 uppercase alphanumeric chars).
 */
export function validateRoomCode(raw) {
  if (typeof raw !== 'string') return false;
  return /^[A-Z0-9]{6}$/.test(raw.trim().toUpperCase());
}

/**
 * Sanitize and validate a chat message.
 */
export function validateChatMessage(raw) {
  const text = sanitizeText(raw, config.maxChatLength);
  if (!text) return { ok: false, reason: 'Empty message.' };
  return { ok: true, value: text };
}
