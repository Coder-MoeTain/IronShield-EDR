/**
 * Investigation entity graph — normalized nodes and edges.
 */
const db = require('../utils/db');

const ENTITY_TYPES = new Set([
  'endpoint', 'user', 'process', 'file', 'hash', 'ip', 'domain', 'url',
  'alert', 'incident', 'response_action',
]);

const REL_TYPES = new Set([
  'process_started_process', 'process_connected_ip', 'process_created_file',
  'file_has_hash', 'alert_involves_endpoint', 'incident_contains_alert',
  'user_ran_process', 'process_accessed_url',
]);

async function ensureTables() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS graph_entities (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      entity_type VARCHAR(32) NOT NULL,
      entity_key VARCHAR(255) NOT NULL,
      label VARCHAR(512) NULL,
      metadata_json JSON NULL,
      tenant_id BIGINT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_graph_entity (entity_type, entity_key, tenant_id)
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS graph_relationships (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      from_entity_id BIGINT UNSIGNED NOT NULL,
      to_entity_id BIGINT UNSIGNED NOT NULL,
      rel_type VARCHAR(64) NOT NULL,
      weight DECIMAL(6,3) DEFAULT 1,
      metadata_json JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_graph_rel_from (from_entity_id),
      KEY idx_graph_rel_to (to_entity_id),
      KEY idx_graph_rel_type (rel_type)
    )
  `);
}

async function upsertEntity(type, key, label, tenantId = null, metadata = null) {
  if (!ENTITY_TYPES.has(type)) return null;
  await ensureTables();
  await db.execute(
    `INSERT INTO graph_entities (entity_type, entity_key, label, tenant_id, metadata_json)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE label = VALUES(label), metadata_json = COALESCE(VALUES(metadata_json), metadata_json)`,
    [type, String(key).slice(0, 255), label, tenantId, metadata ? JSON.stringify(metadata) : null]
  );
  return db.queryOne(
    'SELECT id FROM graph_entities WHERE entity_type = ? AND entity_key = ? AND (tenant_id <=> ?)',
    [type, String(key).slice(0, 255), tenantId]
  );
}

async function addRelationship(fromId, toId, relType, metadata = null) {
  if (!REL_TYPES.has(relType)) return;
  await db.execute(
    `INSERT INTO graph_relationships (from_entity_id, to_entity_id, rel_type, metadata_json)
     VALUES (?, ?, ?, ?)`,
    [fromId, toId, relType, metadata ? JSON.stringify(metadata) : null]
  );
}

async function buildFromAlert(alertId, tenantId = null) {
  const alert = await db.queryOne(
    `SELECT a.*, e.hostname, e.tenant_id FROM alerts a
     JOIN endpoints e ON e.id = a.endpoint_id WHERE a.id = ?`,
    [alertId]
  );
  if (!alert) return { nodes: [], edges: [] };
  const tid = tenantId ?? alert.tenant_id;

  const alertEnt = await upsertEntity('alert', alert.id, alert.title, tid);
  const epEnt = await upsertEntity('endpoint', alert.endpoint_id, alert.hostname, tid);
  if (alertEnt && epEnt) {
    await addRelationship(alertEnt.id, epEnt.id, 'alert_involves_endpoint');
  }

  return getSubgraph(alertEnt?.id, 2);
}

async function getSubgraph(rootEntityId, depth = 2) {
  await ensureTables();
  if (!rootEntityId) return { nodes: [], edges: [] };
  const nodes = await db.query(
    `SELECT * FROM graph_entities WHERE id = ? OR id IN (
       SELECT to_entity_id FROM graph_relationships WHERE from_entity_id = ?
       UNION SELECT from_entity_id FROM graph_relationships WHERE to_entity_id = ?
     )`,
    [rootEntityId, rootEntityId, rootEntityId]
  );
  const edges = await db.query(
    `SELECT * FROM graph_relationships
     WHERE from_entity_id IN (?) OR to_entity_id IN (?)`,
    [nodes.map((n) => n.id), nodes.map((n) => n.id)]
  ).catch(() => []);

  const nodeIds = nodes.map((n) => n.id);
  const filteredEdges = (edges || []).filter(
    (e) => nodeIds.includes(e.from_entity_id) && nodeIds.includes(e.to_entity_id)
  );

  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.entity_type,
      key: n.entity_key,
      label: n.label,
    })),
    edges: filteredEdges.map((e) => ({
      from: e.from_entity_id,
      to: e.to_entity_id,
      type: e.rel_type,
    })),
    depth,
  };
}

async function getInvestigationGraph(tenantId = null, limit = 100) {
  await ensureTables();
  let sql = 'SELECT * FROM graph_entities';
  const params = [];
  if (tenantId != null) {
    sql += ' WHERE tenant_id = ?';
    params.push(tenantId);
  }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);
  const nodes = await db.query(sql, params);
  if (!nodes.length) return { nodes: [], edges: [] };
  const ids = nodes.map((n) => n.id);
  const placeholders = ids.map(() => '?').join(',');
  const edges = await db.query(
    `SELECT * FROM graph_relationships WHERE from_entity_id IN (${placeholders}) AND to_entity_id IN (${placeholders})`,
    [...ids, ...ids]
  );
  return {
    nodes: nodes.map((n) => ({ id: n.id, type: n.entity_type, key: n.entity_key, label: n.label })),
    edges: (edges || []).map((e) => ({ from: e.from_entity_id, to: e.to_entity_id, type: e.rel_type })),
  };
}

module.exports = {
  ENTITY_TYPES,
  REL_TYPES,
  upsertEntity,
  addRelationship,
  buildFromAlert,
  getInvestigationGraph,
  getSubgraph,
};
