/**
 * Event storage abstraction — pluggable backends for telemetry at scale.
 */
const config = require('../config');
const mysqlEventStore = require('./mysqlEventStore');
const opensearchEventStore = require('./opensearchEventStore');
const clickhouseEventStore = require('./clickhouseEventStore');

const STORES = {
  mysql: mysqlEventStore,
  opensearch: opensearchEventStore,
  clickhouse: clickhouseEventStore,
};

function getEventStore() {
  const kind = (config.eventStore?.type || process.env.EVENT_STORE || 'mysql').toLowerCase();
  const store = STORES[kind];
  if (!store) {
    throw new Error(`Unknown EVENT_STORE: ${kind}. Use mysql, opensearch, or clickhouse.`);
  }
  return store;
}

module.exports = { getEventStore, STORES };
