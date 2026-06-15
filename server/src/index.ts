import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { processDueMessages } from './services/messaging';

const app = createApp();

const server = app.listen(env.port, () => {
  logger.info('LeakHunter API listening', { port: env.port, env: env.nodeEnv });
});

// Lightweight in-process scheduler for scheduled/retry sends.
// In production, replace with a real cron / queue worker.
const SCHEDULER_INTERVAL_MS = 60 * 1000;
const interval = setInterval(async () => {
  try {
    const result = await processDueMessages();
    if (result.sent || result.failed || result.blocked) {
      logger.info('scheduler processed due messages', result);
    }
  } catch (err) {
    logger.error('scheduler error', { err: String(err) });
  }
}, SCHEDULER_INTERVAL_MS);

function shutdown() {
  logger.info('shutting down');
  clearInterval(interval);
  server.close(() => process.exit(0));
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
