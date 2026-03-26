const WebSocket = require('ws');
const logger = require('../utils/logger');
const config = require('../config');
const { createConsumer, isEnabled } = require('../kafka/kafkaClient');
const { topics } = require('../kafka/topics');

let wss = null;

function attachRealtime(server) {
  if (wss) return wss;
  if (process.env.WS_ENABLED === 'false') return null;

  wss = new WebSocket.Server({ server, path: '/ws' });
  wss.on('connection', (socket) => {
    socket.send(JSON.stringify({ type: 'hello', ts: new Date().toISOString() }));
  });
  logger.info('WebSocket realtime server attached at /ws');

  // Kafka -> WS bridge
  if (isEnabled()) {
    startKafkaBridge().catch((e) => logger.warn({ err: e.message }, 'Kafka WS bridge failed'));
  }
  return wss;
}

async function broadcast(obj) {
  if (!wss) return;
  const msg = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  }
}

async function startKafkaBridge() {
  const consumer = await createConsumer({ groupId: (config.kafka.groupId || 'ironshield-workers') + '-ws' });
  const t = topics();
  const topicList = [t.normalized, t.detections].filter(Boolean);
  for (const topic of topicList) {
    await consumer.subscribe({ topic, fromBeginning: false });
  }
  logger.info({ topics: topicList }, 'Kafka WS bridge started');

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      try {
        const s = message.value?.toString('utf8') || '';
        const payload = JSON.parse(s);
        await broadcast({ type: 'kafka', topic, payload, ts: new Date().toISOString() });
      } catch (_) {
        // ignore malformed messages
      }
    },
  });
}

module.exports = { attachRealtime };

