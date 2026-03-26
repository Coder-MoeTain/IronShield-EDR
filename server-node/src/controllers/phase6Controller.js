/**
 * Phase 6 API - Notification channels, retention policies, agent releases
 */
const db = require('../utils/db');
const RetentionService = require('../services/RetentionService');

async function listNotificationChannels(req, res, next) {
  try {
    let sql = 'SELECT id, tenant_id, type, name, is_active, created_at FROM notification_channels WHERE 1=1';
    const params = [];
    if (req.tenantId != null) {
      sql += ' AND (tenant_id = ? OR tenant_id IS NULL)';
      params.push(req.tenantId);
    }
    sql += ' ORDER BY type, name';
    const rows = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function createNotificationChannel(req, res, next) {
  try {
    const { type, name, config } = req.body || {};
    if (!type || !config) return res.status(400).json({ error: 'type and config required' });
    if (!['email', 'webhook', 'slack'].includes(type)) return res.status(400).json({ error: 'Invalid type' });
    const tenantId = req.tenantId ?? null;
    const result = await db.execute(
      'INSERT INTO notification_channels (tenant_id, type, name, config) VALUES (?, ?, ?, ?)',
      [tenantId, type, name || null, JSON.stringify(config)]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
}

async function updateNotificationChannel(req, res, next) {
  try {
    const { name, config, is_active } = req.body || {};
    const updates = [];
    const params = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (config !== undefined) { updates.push('config = ?'); params.push(JSON.stringify(config)); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(!!is_active); }
    if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });
    params.push(req.params.id);
    await db.execute(
      `UPDATE notification_channels SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function listRetentionPolicies(req, res, next) {
  try {
    const policies = await RetentionService.getPolicies(req.tenantId);
    res.json(policies);
  } catch (err) {
    next(err);
  }
}

async function createRetentionPolicy(req, res, next) {
  try {
    const id = await RetentionService.createPolicy(req.body || {}, req.tenantId);
    res.status(201).json({ id });
  } catch (err) {
    next(err);
  }
}

async function updateRetentionPolicy(req, res, next) {
  try {
    await RetentionService.updatePolicy(req.params.id, req.body || {}, req.tenantId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function deleteRetentionPolicy(req, res, next) {
  try {
    const deleted = await RetentionService.deletePolicy(req.params.id, req.tenantId);
    if (!deleted) return res.status(404).json({ error: 'Policy not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function runRetention(req, res, next) {
  try {
    const { totalDeleted } = await RetentionService.runAllPolicies(req.tenantId);
    res.json({ ok: true, deleted: totalDeleted });
  } catch (err) {
    next(err);
  }
}

async function listAgentReleases(req, res, next) {
  try {
    const rows = await db.query(
      'SELECT id, version, download_url, checksum_sha256, release_notes, is_current, created_at FROM agent_releases ORDER BY created_at DESC LIMIT 20'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function createAgentRelease(req, res, next) {
  try {
    const { version, download_url, checksum_sha256, release_notes, is_current } = req.body || {};
    if (!version) return res.status(400).json({ error: 'version required' });
    if (is_current) {
      await db.execute('UPDATE agent_releases SET is_current = FALSE');
    }
    const result = await db.execute(
      'INSERT INTO agent_releases (version, download_url, checksum_sha256, release_notes, is_current) VALUES (?, ?, ?, ?, ?)',
      [version, download_url || null, checksum_sha256 || null, release_notes || null, !!is_current]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
}

async function updateAgentRelease(req, res, next) {
  try {
    const { is_current } = req.body || {};
    if (is_current === undefined) return res.status(400).json({ error: 'No updates provided' });
    if (is_current) {
      await db.execute('UPDATE agent_releases SET is_current = FALSE');
    }
    await db.execute('UPDATE agent_releases SET is_current = ? WHERE id = ?', [!!is_current, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function deleteAgentRelease(req, res, next) {
  try {
    const r = await db.execute('DELETE FROM agent_releases WHERE id = ?', [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listNotificationChannels,
  createNotificationChannel,
  updateNotificationChannel,
  listRetentionPolicies,
  createRetentionPolicy,
  updateRetentionPolicy,
  deleteRetentionPolicy,
  runRetention,
  listAgentReleases,
  createAgentRelease,
  updateAgentRelease,
  deleteAgentRelease,
};
