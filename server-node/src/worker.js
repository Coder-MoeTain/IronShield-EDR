#!/usr/bin/env node
/**
 * Standalone BullMQ worker for event processing.
 * Run with: REDIS_URL=redis://localhost:6379 node src/worker.js
 * Or: REDIS_HOST=localhost node src/worker.js
 */
require('dotenv').config();
const { startWorker } = require('./workers/EventIngestionWorker');
const logger = require('./utils/logger');

const worker = startWorker();
if (!worker) {
  logger.info('Exiting: Redis not configured. Set REDIS_URL or REDIS_HOST to enable the worker.');
  process.exit(0);
}

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing worker');
  await worker.close();
  process.exit(0);
});
