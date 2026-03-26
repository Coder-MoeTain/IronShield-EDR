#!/usr/bin/env node
/**
 * Phase 4 worker: consumes xdr.normalized and runs detections against xdr_events.
 * Emits alerts (for UI continuity) and stores xdr_detections.
 */
require('dotenv').config();

const config = require('../config');
const logger = require('../utils/logger');
const { createConsumer, isEnabled } = require('../kafka/kafkaClient');
const { topics } = require('../kafka/topics');
const { detectFromXdrEventId } = require('../xdr/xdrDetectionService');

async function main() {
  if (!isEnabled()) {
    logger.info('Kafka disabled (set KAFKA_ENABLED=true). Exiting.');
    process.exit(0);
  }

  const consumer = await createConsumer({ groupId: (config.kafka.groupId || 'ironshield-workers') + '-detect' });
  const topic = topics().normalized;
  await consumer.subscribe({ topic, fromBeginning: false });

  logger.info({ topic }, 'Kafka normalized detection worker started');

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const s = message.value?.toString('utf8') || '';
        const payload = JSON.parse(s);
        const xdrEventId = payload.xdr_event_id;
        if (!xdrEventId) return;
        const out = await detectFromXdrEventId(xdrEventId);
        logger.debug({ xdrEventId, ...out }, 'XDR detection processed');
      } catch (e) {
        logger.warn({ err: e.message }, 'XDR detection message failed');
      }
    },
  });
}

main().catch((e) => {
  logger.error({ err: e.message }, 'Detection worker crashed');
  process.exit(1);
});

