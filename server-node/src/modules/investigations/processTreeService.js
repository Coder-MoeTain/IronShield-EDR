/**
 * Process tree builder from normalized events
 */
const db = require('../../utils/db');

async function buildFromEvents(endpointId, since = null) {
  let sql = `
    SELECT id, process_id, parent_process_id, process_name, process_path, command_line, username, timestamp
    FROM normalized_events
    WHERE endpoint_id = ? AND event_type = 'process_create'
  `;
  const params = [endpointId];
  if (since) {
    sql += ' AND timestamp >= ?';
    params.push(since);
  }
  sql += ' ORDER BY timestamp ASC';

  const events = await db.query(sql, params);
  const nodes = new Map();
  const roots = [];

  for (const evt of events) {
    const node = {
      id: evt.process_id,
      pid: evt.process_id,
      parentPid: evt.parent_process_id,
      name: evt.process_name,
      path: evt.process_path,
      commandLine: evt.command_line,
      username: evt.username,
      timestamp: evt.timestamp,
      children: [],
    };
    nodes.set(evt.process_id, node);
  }

  for (const [pid, node] of nodes) {
    const parent = node.parentPid ? nodes.get(node.parentPid) : null;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return { roots, nodes: Array.from(nodes.values()) };
}

async function getCached(endpointId) {
  return db.queryOne(
    'SELECT * FROM process_trees WHERE endpoint_id = ? ORDER BY snapshot_at DESC LIMIT 1',
    [endpointId]
  );
}

async function saveTree(endpointId, treeJson) {
  await db.execute(
    'INSERT INTO process_trees (endpoint_id, tree_json, snapshot_at) VALUES (?, ?, NOW())',
    [endpointId, JSON.stringify(treeJson)]
  );
}

module.exports = {
  buildFromEvents,
  getCached,
  saveTree,
};
