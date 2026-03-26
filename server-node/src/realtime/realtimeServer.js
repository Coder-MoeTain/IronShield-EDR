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
    socket.subscriptions = { streams: ['xdr_event', 'xdr_detection', 'kafka'], endpoint_id: null };
    socket.send(JSON.stringify({ type: 'hello', ts: new Date().toISOString() }));
    socket.on('message', (buf) => {
      try {
        const msg = JSON.parse(String(buf || ''));
        if (msg?.type !== 'subscribe') return;
        const streams = Array.isArray(msg.streams)
          ? msg.streams.filter((s) => ['xdr_event', 'xdr_detection', 'kafka'].includes(String(s)))
          : socket.subscriptions.streams;
        socket.subscriptions = {
          streams: streams && streams.length ? streams : socket.subscriptions.streams,
          endpoint_id: msg.endpoint_id != null ? parseInt(msg.endpoint_id, 10) || null : null,
        };
        socket.send(JSON.stringify({ type: 'subscribed', payload: socket.subscriptions, ts: new Date().toISOString() }));
      } catch {
        // ignore malformed subscribe messages
      }
    });
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

async function publishXdrEvent(event) {
  if (!wss) return;
  const msg = JSON.stringify({ type: 'xdr_event', ts: new Date().toISOString(), payload: event });
  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) continue;
    const sub = client.subscriptions || {};
    if (Array.isArray(sub.streams) && !sub.streams.includes('xdr_event')) continue;
    if (sub.endpoint_id != null && Number(event?.endpoint_id) !== Number(sub.endpoint_id)) continue;
    client.send(msg);
  }
}

async function publishXdrDetection(detection) {
  if (!wss) return;
  const msg = JSON.stringify({ type: 'xdr_detection', ts: new Date().toISOString(), payload: detection });
  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) continue;
    const sub = client.subscriptions || {};
    if (Array.isArray(sub.streams) && !sub.streams.includes('xdr_detection')) continue;
    if (sub.endpoint_id != null && Number(detection?.endpoint_id) !== Number(sub.endpoint_id)) continue;
    client.send(msg);
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

module.exports = { attachRealtime, broadcast, publishXdrEvent, publishXdrDetection };

