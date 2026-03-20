/**
 * MySQL connection pool
 */
const mysql = require('mysql2/promise');
const config = require('../config');
const logger = require('./logger');

let pool;

async function getPool() {
  if (!pool) {
    const poolConfig = {
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      database: config.db.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    };
    if (config.db.password !== undefined && config.db.password !== '') {
      poolConfig.password = config.db.password;
    }
    pool = mysql.createPool(poolConfig);
    logger.info('Database pool created');
  }
  return pool;
}

async function query(sql, params = []) {
  const p = await getPool();
  const [rows] = await p.execute(sql, params);
  return rows;
}

async function execute(sql, params = []) {
  const p = await getPool();
  const [result] = await p.execute(sql, params);
  return result;
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

module.exports = { getPool, query, queryOne, execute };
