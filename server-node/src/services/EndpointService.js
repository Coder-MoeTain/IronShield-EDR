/**
 * Endpoint management service
 */
const db = require('../utils/db');

/** Phase 9 — Falcon-style policy compliance: console assignment vs sensor-reported policy id. */
function enrichEndpointPolicyView(row) {
  if (!row) return row;
  let policy_compliance_status = 'matched';
  if (row.edr_policy_id == null) policy_compliance_status = 'unknown';
  else if (
    row.assigned_policy_id != null &&
    row.edr_policy_id != null &&
    Number(row.assigned_policy_id) !== Number(row.edr_policy_id)
  ) {
    policy_compliance_status = 'mismatch';
  }
  return { ...row, policy_compliance_status };
}

async function list(filters = {}) {
  let sql = `
    SELECT e.*, hg.name AS host_group_name, t.name AS tenant_name, t.slug AS tenant_slug,
      avs.bundle_version AS av_ngav_bundle_version,
      avs.status AS av_ngav_sync_status,
      avs.realtime_enabled AS av_ngav_realtime_enabled,
      avs.prevention_status AS av_ngav_prevention_status,
      avs.signature_count AS av_ngav_signature_count,
      avs.last_checked_at AS av_ngav_last_checked_at,
      ep_assigned.name AS assigned_policy_name,
      ep_running.name AS edr_policy_name
    FROM endpoints e
    LEFT JOIN host_groups hg ON hg.id = e.host_group_id
    LEFT JOIN tenants t ON t.id = e.tenant_id
    LEFT JOIN av_update_status avs ON avs.endpoint_id = e.id
    LEFT JOIN endpoint_policies ep_assigned ON ep_assigned.id = e.assigned_policy_id
    LEFT JOIN endpoint_policies ep_running ON ep_running.id = e.edr_policy_id
    WHERE 1=1
  `;
  const params = [];

  if (filters.tenantId != null) {
    sql += ' AND e.tenant_id = ?';
    params.push(filters.tenantId);
  }
  if (filters.hostname) {
    sql += ' AND e.hostname LIKE ?';
    params.push(`%${String(filters.hostname)}%`);
  }
  if (filters.status) {
    sql += ' AND e.status = ?';
    params.push(filters.status);
  }
  if (filters.hostGroupId != null && filters.hostGroupId !== '') {
    sql += ' AND e.host_group_id = ?';
    params.push(parseInt(filters.hostGroupId, 10));
  }

  sql += ' ORDER BY e.last_heartbeat_at DESC';
  if (filters.limit) {
    sql += ' LIMIT ?';
    params.push(Math.min(parseInt(filters.limit) || 100, 500));
  }
  if (filters.offset) {
    sql += ' OFFSET ?';
    params.push(parseInt(filters.offset) || 0);
  }

  try {
    const rows = await db.query(sql, params);
    return rows.map(enrichEndpointPolicyView);
  } catch (err) {
    /* av_update_status missing or old schema; host_groups / tenant_id */
    if (err.code === 'ER_NO_SUCH_TABLE' || err.code === 'ER_BAD_FIELD_ERROR') {
      try {
        sql = `
          SELECT e.*, hg.name AS host_group_name, t.name AS tenant_name, t.slug AS tenant_slug,
            ep_assigned.name AS assigned_policy_name,
            ep_running.name AS edr_policy_name
          FROM endpoints e
          LEFT JOIN host_groups hg ON hg.id = e.host_group_id
          LEFT JOIN tenants t ON t.id = e.tenant_id
          LEFT JOIN endpoint_policies ep_assigned ON ep_assigned.id = e.assigned_policy_id
          LEFT JOIN endpoint_policies ep_running ON ep_running.id = e.edr_policy_id
          WHERE 1=1
        `;
        const params2 = [];
        if (filters.tenantId != null) {
          sql += ' AND e.tenant_id = ?';
          params2.push(filters.tenantId);
        }
        if (filters.hostname) {
          sql += ' AND e.hostname LIKE ?';
          params2.push(`%${String(filters.hostname)}%`);
        }
        if (filters.status) {
          sql += ' AND e.status = ?';
          params2.push(filters.status);
        }
        if (filters.hostGroupId != null && filters.hostGroupId !== '') {
          sql += ' AND e.host_group_id = ?';
          params2.push(parseInt(filters.hostGroupId, 10));
        }
        sql += ' ORDER BY e.last_heartbeat_at DESC';
        if (filters.limit) {
          sql += ' LIMIT ?';
          params2.push(Math.min(parseInt(filters.limit) || 100, 500));
        }
        if (filters.offset) {
          sql += ' OFFSET ?';
          params2.push(parseInt(filters.offset) || 0);
        }
        const rows2 = await db.query(sql, params2);
        return rows2.map(enrichEndpointPolicyView);
      } catch (err2) {
        if (err2.code !== 'ER_NO_SUCH_TABLE' && err2.code !== 'ER_BAD_FIELD_ERROR') throw err2;
      }
      let fallback = `SELECT * FROM endpoints WHERE 1=1`;
      const fp = [];
      if (filters.tenantId != null) {
        fallback += ' AND tenant_id = ?';
        fp.push(filters.tenantId);
      }
      if (filters.hostname) {
        fallback += ' AND hostname LIKE ?';
        fp.push(`%${String(filters.hostname)}%`);
      }
      if (filters.status) {
        fallback += ' AND status = ?';
        fp.push(filters.status);
      }
      fallback += ' ORDER BY last_heartbeat_at DESC';
      if (filters.limit) {
        fallback += ' LIMIT ?';
        fp.push(Math.min(parseInt(filters.limit) || 100, 500));
      }
      if (filters.offset) {
        fallback += ' OFFSET ?';
        fp.push(parseInt(filters.offset) || 0);
      }
      const rowsF = await db.query(fallback, fp);
      return rowsF.map(enrichEndpointPolicyView);
    }
    throw err;
  }
}

async function getById(id, tenantId = null) {
  let sql = `
    SELECT e.*, hg.name AS host_group_name, t.name AS tenant_name, t.slug AS tenant_slug,
      avs.bundle_version AS av_ngav_bundle_version,
      avs.status AS av_ngav_sync_status,
      avs.realtime_enabled AS av_ngav_realtime_enabled,
      avs.prevention_status AS av_ngav_prevention_status,
      avs.signature_count AS av_ngav_signature_count,
      avs.last_checked_at AS av_ngav_last_checked_at,
      ep_assigned.name AS assigned_policy_name,
      ep_running.name AS edr_policy_name
    FROM endpoints e
    LEFT JOIN host_groups hg ON hg.id = e.host_group_id
    LEFT JOIN tenants t ON t.id = e.tenant_id
    LEFT JOIN av_update_status avs ON avs.endpoint_id = e.id
    LEFT JOIN endpoint_policies ep_assigned ON ep_assigned.id = e.assigned_policy_id
    LEFT JOIN endpoint_policies ep_running ON ep_running.id = e.edr_policy_id
    WHERE e.id = ?
  `;
  const params = [id];
  if (tenantId != null) {
    sql += ' AND e.tenant_id = ?';
    params.push(tenantId);
  }
  let endpoint;
  try {
    endpoint = enrichEndpointPolicyView(await db.queryOne(sql, params));
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE' || err.code === 'ER_BAD_FIELD_ERROR') {
      try {
        let sql2 = `
          SELECT e.*, hg.name AS host_group_name, t.name AS tenant_name, t.slug AS tenant_slug,
            ep_assigned.name AS assigned_policy_name,
            ep_running.name AS edr_policy_name
          FROM endpoints e
          LEFT JOIN host_groups hg ON hg.id = e.host_group_id
          LEFT JOIN tenants t ON t.id = e.tenant_id
          LEFT JOIN endpoint_policies ep_assigned ON ep_assigned.id = e.assigned_policy_id
          LEFT JOIN endpoint_policies ep_running ON ep_running.id = e.edr_policy_id
          WHERE e.id = ?
        `;
        const p2 = [id];
        if (tenantId != null) {
          sql2 += ' AND e.tenant_id = ?';
          p2.push(tenantId);
        }
        endpoint = enrichEndpointPolicyView(await db.queryOne(sql2, p2));
      } catch (err2) {
        if (err2.code !== 'ER_NO_SUCH_TABLE' && err2.code !== 'ER_BAD_FIELD_ERROR') throw err2;
        let fb = `SELECT * FROM endpoints WHERE id = ?`;
        const p = [id];
        if (tenantId != null) {
          fb += ' AND tenant_id = ?';
          p.push(tenantId);
        }
        endpoint = enrichEndpointPolicyView(await db.queryOne(fb, p));
      }
    } else {
      throw err;
    }
  }
  if (!endpoint) return null;

  const hasMetrics = endpoint.cpu_percent != null || endpoint.ram_percent != null || endpoint.disk_percent != null;
  if (!hasMetrics) {
    try {
      const [latest] = await db.query(
        `SELECT cpu_percent, ram_percent, disk_percent FROM endpoint_metrics
         WHERE endpoint_id = ? ORDER BY collected_at DESC LIMIT 1`,
        [id]
      );
      if (latest?.[0]) {
        endpoint.cpu_percent = latest[0].cpu_percent;
        endpoint.ram_percent = latest[0].ram_percent;
        endpoint.disk_percent = latest[0].disk_percent;
      }
    } catch (_) {
      /* endpoint_metrics may not exist */
    }
  }

  return endpoint;
}

async function patch(id, data, tenantId = null) {
  const ep = await getById(id, tenantId);
  if (!ep) return null;
  if (data.host_group_id !== undefined) {
    let gid = data.host_group_id;
    if (gid === '' || gid === null) {
      try {
        await db.execute('UPDATE endpoints SET host_group_id = NULL WHERE id = ?', [id]);
      } catch (err) {
        if (err.code !== 'ER_BAD_FIELD_ERROR') throw err;
      }
    } else {
      gid = parseInt(gid, 10);
      if (Number.isNaN(gid)) throw new Error('Invalid host_group_id');
      const g = await db.queryOne('SELECT id, tenant_id FROM host_groups WHERE id = ?', [gid]);
      if (!g) throw new Error('Invalid host group');
      if (tenantId != null && g.tenant_id != null && g.tenant_id !== tenantId) {
        throw new Error('Host group not in tenant scope');
      }
      await db.execute('UPDATE endpoints SET host_group_id = ? WHERE id = ?', [gid, id]);
    }
  }
  return getById(id, tenantId);
}

async function getByAgentKey(agentKey) {
  return db.queryOne('SELECT * FROM endpoints WHERE agent_key = ?', [agentKey]);
}

async function getMetrics(endpointId, limit = 100) {
  return db.query(
    `SELECT cpu_percent, ram_percent, ram_total_mb, ram_used_mb, disk_percent, disk_total_gb, disk_used_gb,
            network_rx_mbps, network_tx_mbps, collected_at
     FROM endpoint_metrics
     WHERE endpoint_id = ?
     ORDER BY collected_at DESC
     LIMIT ?`,
    [endpointId, limit]
  );
}

async function deleteById(id, tenantId = null) {
  let sql = 'DELETE FROM endpoints WHERE id = ?';
  const params = [id];
  if (tenantId != null) {
    sql += ' AND tenant_id = ?';
    params.push(tenantId);
  }
  const result = await db.execute(sql, params);
  return result.affectedRows > 0;
}

module.exports = { list, getById, getByAgentKey, getMetrics, deleteById, patch };
