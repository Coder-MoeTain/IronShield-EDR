const { Kafka, logLevel } = require('kafkajs');
const config = require('../config');
const logger = require('../utils/logger');

let kafka = null;

function isEnabled() {
  return !!config.kafka?.enabled;
}

function getKafka() {
  if (!isEnabled()) return null;
  if (kafka) return kafka;

  const brokers = config.kafka?.brokers?.length ? config.kafka.brokers : ['localhost:9092'];
  kafka = new Kafka({
    clientId: config.kafka?.clientId || 'ironshield-edr',
    brokers,
    logLevel: logLevel.NOTHING,
  });

  logger.info({ brokers }, 'Kafka client initialized');
  return kafka;
}

async function createProducer() {
  const k = getKafka();
  if (!k) return null;
  const producer = k.producer();
  await producer.connect();
  logger.info('Kafka producer connected');
  return producer;
}

async function createConsumer({ groupId }) {
  const k = getKafka();
  if (!k) return null;
  const consumer = k.consumer({ groupId });
  await consumer.connect();
  logger.info({ groupId }, 'Kafka consumer connected');
  return consumer;
}

module.exports = {
  isEnabled,
  getKafka,
  createProducer,
  createConsumer,
};

