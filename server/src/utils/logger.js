// server/src/utils/logger.js
// Simple structured logger.  Replace with winston/pino in production.

const levels = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = process.env.LOG_LEVEL || 'info';

function log(level, ...args) {
  if (levels[level] >= levels[currentLevel]) {
    const ts = new Date().toISOString();
    console[level === 'debug' ? 'log' : level](`[${ts}] [${level.toUpperCase()}]`, ...args);
  }
}

export const logger = {
  debug: (...a) => log('debug', ...a),
  info:  (...a) => log('info',  ...a),
  warn:  (...a) => log('warn',  ...a),
  error: (...a) => log('error', ...a),
};
