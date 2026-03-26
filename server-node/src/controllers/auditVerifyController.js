/**
 * Audit log verification (hash chain).
 * This is a best-effort integrity check, not WORM storage.
 */
const db = require('../utils/db');
const crypto = require('crypto');

function sha256Hex(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

async function verify(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit || '5000', 10) || 5000, 20000);
    const rows = await db.query(
      `SELECT id, user_id, username, action, resource_type, resource_id, details, ip_address, user_agent, prev_hash, entry_hash
       FROM audit_logs
       WHERE entry_hash IS NOT NULL
       ORDER BY id ASC
       LIMIT ?`,
      [limit]
    );
    let prev = null;
    for (const r of rows) {
      const material = JSON.stringify({
        prevHash: prev,
        user_id: r.user_id,
        username: r.username,
        action: r.action,
        resource_type: r.resource_type,
        resource_id: r.resource_id,
        details: r.details,
        ip_address: r.ip_address,
        user_agent: r.user_agent,
      });
      const expect = sha256Hex(material);
      if ((r.prev_hash || null) !== (prev || null) || String(r.entry_hash) !== expect) {
        return res.status(409).json({ ok: false, first_bad_id: r.id });
      }
      prev = r.entry_hash;
    }
    res.json({ ok: true, checked: rows.length });
  } catch (e) {
    next(e);
  }
}

module.exports = { verify };

