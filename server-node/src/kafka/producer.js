const logger = require('../utils/logger');
const { createProducer, isEnabled } = require('./kafkaClient');
const { topics } = require('./topics');

let producerPromise = null;

async function getProducer() {
  if (!isEnabled()) return null;
  if (!producerPromise) producerPromise = createProducer();
  return producerPromise;
}

async function publishRawEndpointEvent(payload) {
  const p = await getProducer();
  if (!p) return { published: false, reason: 'kafka_disabled' };
  const t = topics().rawEndpoint;
  const value = JSON.stringify(payload);
  await p.send({
    topic: t,
    messages: [{ value }],
  });
  logger.debug({ topic: t }, 'Kafka published raw endpoint event');
  return { published: true, topic: t };
}

async function publishNormalizedEvent(payload) {
  const p = await getProducer();
  if (!p) return { published: false, reason: 'kafka_disabled' };
  const t = topics().normalized;
  const value = JSON.stringify(payload);
  await p.send({
    topic: t,
    messages: [{ value }],
  });
  logger.debug({ topic: t }, 'Kafka published normalized event');
  return { published: true, topic: t };
}

async function publishRawWebEvent(payload) {
  const p = await getProducer();
  if (!p) return { published: false, reason: 'kafka_disabled' };
  const t = topics().rawWeb;
  await p.send({ topic: t, messages: [{ value: JSON.stringify(payload) }] });
  return { published: true, topic: t };
}

async function publishRawAuthEvent(payload) {
  const p = await getProducer();
  if (!p) return { published: false, reason: 'kafka_disabled' };
  const t = topics().rawAuth;
  await p.send({ topic: t, messages: [{ value: JSON.stringify(payload) }] });
  return { published: true, topic: t };
}

async function publishRawZeekEvent(payload) {
  const p = await getProducer();
  if (!p) return { published: false, reason: 'kafka_disabled' };
  const t = topics().rawZeek;
  await p.send({ topic: t, messages: [{ value: JSON.stringify(payload) }] });
  return { published: true, topic: t };
}

module.exports = {
  getProducer,
  publishRawEndpointEvent,
  publishNormalizedEvent,
  publishRawWebEvent,
  publishRawAuthEvent,
  publishRawZeekEvent,
};

