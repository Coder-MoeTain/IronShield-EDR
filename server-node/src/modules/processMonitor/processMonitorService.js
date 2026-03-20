/**
 * Process Monitor - aggregates process events with suspect/suspicious indicators
 */
const db = require('../../utils/db');

const SUSPICIOUS_PATHS = ['\\temp\\', '\\downloads\\', '\\appdata\\', '\\users\\', '\\programdata\\'];
const SUSPICIOUS_PROCS = ['powershell.exe', 'cmd.exe', 'wscript.exe', 'cscript.exe', 'mshta.exe', 'regsvr32.exe', 'rundll32.exe'];

function isSuspiciousPath(path) {
  if (!path) return false;
  const p = path.toLowerCase();
  return SUSPICIOUS_PATHS.some((sp) => p.includes(sp));
}

function isSuspiciousProcess(name) {
  if (!name) return false;
  return SUSPICIOUS_PROCS.includes(name.toLowerCase());
}

async function list(filters = {}) {
  let sql = `
    SELECT ne.id, ne.raw_event_id, ne.endpoint_id, ne.hostname, ne.username, ne.timestamp, ne.event_source, ne.event_type,
           ne.process_name, ne.process_path, ne.process_id, ne.parent_process_name, ne.parent_process_id,
           ne.command_line, ne.file_hash_sha256, e.hostname as endpoint_hostname
    FROM normalized_events ne
    JOIN endpoints e ON e.id = ne.endpoint_id
    WHERE ne.event_type = 'process_create'
  `;
  const params = [];

  if (filters.endpointId) {
    sql += ' AND ne.endpoint_id = ?';
    params.push(filters.endpointId);
  }
  if (filters.hostname) {
    sql += ' AND e.hostname LIKE ?';
    params.push(`%${String(filters.hostname)}%`);
  }
  if (filters.processName) {
    sql += ' AND ne.process_name LIKE ?';
    params.push(`%${String(filters.processName)}%`);
  }
  if (filters.username) {
    sql += ' AND ne.username LIKE ?';
    params.push(`%${String(filters.username)}%`);
  }
  if (filters.suspectOnly) {
    sql += ` AND (
      ne.process_path LIKE '%\\Temp%' OR ne.process_path LIKE '%\\Downloads%' OR ne.process_path LIKE '%\\AppData%'
      OR ne.process_name IN ('powershell.exe','cmd.exe','wscript.exe','cscript.exe','mshta.exe','regsvr32.exe','rundll32.exe')
    )`;
  }
  if (filters.dateFrom) {
    sql += ' AND ne.timestamp >= ?';
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    sql += ' AND ne.timestamp <= ?';
    params.push(filters.dateTo);
  }

  sql += ' ORDER BY ne.timestamp DESC';
  const limit = Math.min(parseInt(filters.limit) || 100, 500);
  const offset = parseInt(filters.offset) || 0;
  sql += ' LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = await db.query(sql, params);

  const alertMap = {};
  const alerts = await db.query(
    `SELECT id, title, severity, source_event_ids FROM alerts WHERE source_event_ids IS NOT NULL`
  );
  for (const a of alerts) {
    let ids = [];
    try {
      ids = typeof a.source_event_ids === 'string' ? JSON.parse(a.source_event_ids) : a.source_event_ids || [];
    } catch {
      ids = [];
    }
    for (const eid of ids) {
      const key = String(eid);
      if (!alertMap[key]) alertMap[key] = [];
      alertMap[key].push({ id: a.id, title: a.title, severity: a.severity });
    }
  }

  return rows.map((r) => {
    const path = r.process_path || r.command_line || '';
    const suspectPath = isSuspiciousPath(path);
    const suspectProc = isSuspiciousProcess(r.process_name);
    const linkedAlerts = alertMap[String(r.raw_event_id)] || [];
    const isSuspect = linkedAlerts.length > 0 || suspectPath || suspectProc;

    return {
      ...r,
      is_suspect: isSuspect,
      suspect_reason: linkedAlerts.length ? 'alert' : suspectPath ? 'suspicious_path' : suspectProc ? 'suspicious_process' : null,
      linked_alerts: linkedAlerts,
    };
  });
}

async function getSuspectSummary() {
  const [row] = await db.query(`
    SELECT COUNT(*) as count FROM normalized_events ne
    WHERE ne.event_type = 'process_create'
    AND (
      ne.process_path LIKE '%\\Temp%' OR ne.process_path LIKE '%\\Downloads%' OR ne.process_path LIKE '%\\AppData%'
      OR ne.process_name IN ('powershell.exe','cmd.exe','wscript.exe','cscript.exe','mshta.exe','regsvr32.exe','rundll32.exe')
    )
    AND ne.timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
  `);
  return { suspect_count_24h: row?.count || 0 };
}

module.exports = { list, getSuspectSummary };
