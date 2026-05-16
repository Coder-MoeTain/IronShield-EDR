/**
 * OpenSearch event store — placeholder for scalable telemetry indexing.
 */
const mysqlEventStore = require('./mysqlEventStore');

async function insertRaw(event) {
  return mysqlEventStore.insertRaw(event);
}

async function insertNormalized(norm) {
  return mysqlEventStore.insertNormalized(norm);
}

module.exports = { insertRaw, insertNormalized, name: 'opensearch' };
