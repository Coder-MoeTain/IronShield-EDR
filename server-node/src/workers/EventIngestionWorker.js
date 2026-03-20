/**
 * BullMQ worker - processes raw events (normalize, IOC match, detect, alert)
 */
const { Worker } = require('bullmq');
const config = require('../config');
const logger = require('../utils/logger');
const EventIngestionService = require('../services/EventIngestionService');
const { QUEUE_NAME } = require('../services/QueueService');

function getConnection() {
  if (config.redis?.url) {
    return { url: config.redis.url };
  }
  return {
    host: config.redis?.host || 'localhost',
    port: config.redis?.port || 6379,
    password: config.redis?.password || undefined,
  };
}

function startWorker() {
  if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
    logger.info('Redis not configured, worker not started');
    return null;
  }

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { endpointId, count } = job.data;
      logger.info({ jobId: job.id, endpointId }, 'Processing event batch');
      const processed = await EventIngestionService.processUnprocessed(endpointId, count || 100);
      return { processed };
    },
    {
      connection: getConnection(),
      concurrency: 3,
    }
  );

  worker.on('completed', (job) => {
    logger.debug({ jobId: job.id }, 'Job completed');
  });

  worker.on('failed', (job, err) => {
    logger.warn({ jobId: job?.id, err: err.message }, 'Job failed');
  });

  worker.on('error', (err) => {
    logger.error({ err: err.message }, 'Worker error');
  });

  logger.info('Event ingestion worker started');
  return worker;
}

module.exports = { startWorker };
