/**
 * ClickHouse event store — placeholder for high-volume analytics backend.
 */
const mysqlEventStore = require('./mysqlEventStore');

async function insertRaw(event) {
  return mysqlEventStore.insertRaw(event);
}

async function insertNormalized(norm) {
  return mysqlEventStore.insertNormalized(norm);
}

module.exports = { insertRaw, insertNormalized, name: 'clickhouse' };
