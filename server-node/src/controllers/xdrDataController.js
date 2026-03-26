const db = require('../utils/db');

async function listXdrEvents(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit || '100', 10) || 100, 500);
    const offset = Math.max(parseInt(req.query.offset || '0', 10) || 0, 0);
    const tenantId = req.tenantId ?? null;
    const source = req.query.source ? String(req.query.source) : null;
    const eventType = req.query.event_type ? String(req.query.event_type) : null;
    const endpointId = req.query.endpoint_id ? parseInt(req.query.endpoint_id, 10) : null;

    let sql = 'SELECT * FROM xdr_events WHERE 1=1';
    const params = [];
    if (tenantId != null) {
      sql += ' AND (tenant_id = ? OR tenant_id IS NULL)';
      params.push(tenantId);
    }
    if (source) {
      sql += ' AND source = ?';
      params.push(source);
    }
    if (eventType) {
      sql += ' AND event_type = ?';
      params.push(eventType);
    }
    if (endpointId) {
      sql += ' AND endpoint_id = ?';
      params.push(endpointId);
    }
    sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const rows = await db.query(sql, params);
    res.json(rows);
  } catch (e) {
    next(e);
  }
}

async function listXdrDetections(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit || '100', 10) || 100, 500);
    const offset = Math.max(parseInt(req.query.offset || '0', 10) || 0, 0);
    const tenantId = req.tenantId ?? null;
    const endpointId = req.query.endpoint_id ? parseInt(req.query.endpoint_id, 10) : null;

    let sql = `
      SELECT d.*, xe.timestamp AS event_timestamp, xe.source AS event_source, xe.event_type AS event_type
      FROM xdr_detections d
      LEFT JOIN xdr_events xe ON xe.id = d.xdr_event_id
      WHERE 1=1
    `;
    const params = [];
    if (tenantId != null) {
      sql += ' AND (d.tenant_id = ? OR d.tenant_id IS NULL)';
      params.push(tenantId);
    }
    if (endpointId) {
      sql += ' AND d.endpoint_id = ?';
      params.push(endpointId);
    }
    sql += ' ORDER BY d.id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const rows = await db.query(sql, params);
    res.json(rows);
  } catch (e) {
    next(e);
  }
}

async function getXdrSummary(req, res, next) {
  try {
    const tenantId = req.tenantId ?? null;
    const whereEvents = tenantId != null ? 'WHERE (tenant_id = ? OR tenant_id IS NULL)' : '';
    const whereDetections = tenantId != null ? 'WHERE (tenant_id = ? OR tenant_id IS NULL)' : '';
    const ev = await db.queryOne(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 ELSE 0 END) AS last_24h
       FROM xdr_events ${whereEvents}`,
      tenantId != null ? [tenantId] : []
    );
    const det = await db.queryOne(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN severity='critical' THEN 1 ELSE 0 END) AS critical,
              SUM(CASE WHEN severity='high' THEN 1 ELSE 0 END) AS high
       FROM xdr_detections ${whereDetections}`,
      tenantId != null ? [tenantId] : []
    );
    res.json({
      events_total: Number(ev?.total || 0),
      events_last_24h: Number(ev?.last_24h || 0),
      detections_total: Number(det?.total || 0),
      detections_critical: Number(det?.critical || 0),
      detections_high: Number(det?.high || 0),
    });
  } catch (e) {
    next(e);
  }
}

module.exports = { listXdrEvents, listXdrDetections, getXdrSummary };

