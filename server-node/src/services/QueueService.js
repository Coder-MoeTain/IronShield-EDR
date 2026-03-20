/**
 * BullMQ queue for event processing - optional when Redis is configured
 */
const { Queue } = require('bullmq');
const config = require('../config');
const logger = require('../utils/logger');

const QUEUE_NAME = 'edr-event-processing';

let queue = null;

function isEnabled() {
  return !!(process.env.REDIS_URL || process.env.REDIS_HOST);
}

function getQueue() {
  if (!isEnabled()) return null;
  if (queue) return queue;
  try {
    const opts = {
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { count: 1000 },
      },
    };
    if (config.redis?.url) {
      opts.connection = { url: config.redis.url };
    } else {
      opts.connection = {
        host: config.redis.host || 'localhost',
        port: config.redis.port || 6379,
        password: config.redis.password || undefined,
      };
    }
    queue = new Queue(QUEUE_NAME, opts);
    logger.info('BullMQ event queue initialized');
    return queue;
  } catch (err) {
    logger.warn({ err: err.message }, 'BullMQ queue init failed, falling back to sync');
    return null;
  }
}

/**
 * Add a batch processing job for an endpoint
 * @param {number} endpointId
 * @param {number} count - number of raw events to process
 */
async function addProcessJob(endpointId, count = 100) {
  const q = getQueue();
  if (!q) return null;
  try {
    const job = await q.add('process', { endpointId, count }, { jobId: `ep-${endpointId}-${Date.now()}` });
    return job.id;
  } catch (err) {
    logger.warn({ err: err.message, endpointId }, 'Failed to add process job');
    return null;
  }
}

async function close() {
  if (queue) {
    await queue.close();
    queue = null;
    logger.info('BullMQ queue closed');
  }
}

module.exports = { getQueue, isEnabled, addProcessJob, close, QUEUE_NAME };
