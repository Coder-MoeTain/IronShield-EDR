/**
 * Endpoint software inventory ingestion and queries.
 */
const db = require('../../utils/db');
const { normalizeName, normalizeVendor, computeFingerprint } = require('./softwareNormalize');
const SoftwareRiskService = require('./softwareRiskService');
const AuditLogService = require('../../services/AuditLogService');

function isMissingTable(err) {
  return err?.code === 'ER_NO_SUCH_TABLE';
}

async function ingestInventory({
  tenantId,
  endpointId,
  scanType,
  inventoryScanId,
  startedAt,
  completedAt,
  software,
  removedFingerprints,
  agentVersion,
}) {
  const now = new Date();
  let added = 0;
  let updated = 0;
  let removed = 0;

  const existingRows = await db.query(
    `SELECT id, fingerprint, version, status FROM endpoint_software_inventory
     WHERE tenant_id = ? AND endpoint_id = ?`,
    [tenantId, endpointId]
  );
  const existingByFp = new Map((existingRows || []).map((r) => [r.fingerprint, r]));

  for (const item of software || []) {
    const fp =
      item.fingerprint ||
      computeFingerprint({
        name: item.name,
        vendor: item.vendor,
        version: item.version,
        installLocation: item.install_location,
        endpointId,
      });

    const row = {
      tenant_id: tenantId,
      endpoint_id: endpointId,
      fingerprint: fp,
      name: item.name,
      normalized_name: normalizeName(item.name),
      vendor: item.vendor || null,
      normalized_vendor: normalizeVendor(item.vendor),
      version: item.version || null,
      install_location: item.install_location || null,
      executable_paths: item.executable_paths ? JSON.stringify(item.executable_paths) : null,
      uninstall_string: item.uninstall_string || null,
      quiet_uninstall_string: item.quiet_uninstall_string || null,
      install_date: item.install_date || null,
      architecture: item.architecture || null,
      source: item.source || 'registry',
      last_seen_at: now,
      status: 'installed',
    };

    const prev = existingByFp.get(fp);
    if (!prev) {
      const insResult = await db.execute(
        `INSERT INTO endpoint_software_inventory (
          tenant_id, endpoint_id, fingerprint, name, normalized_name, vendor, normalized_vendor,
          version, install_location, executable_paths, uninstall_string, quiet_uninstall_string,
          install_date, architecture, source, first_seen_at, last_seen_at, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.tenant_id,
          row.endpoint_id,
          row.fingerprint,
          row.name,
          row.normalized_name,
          row.vendor,
          row.normalized_vendor,
          row.version,
          row.install_location,
          row.executable_paths,
          row.uninstall_string,
          row.quiet_uninstall_string,
          row.install_date,
          row.architecture,
          row.source,
          now,
          now,
          row.status,
        ]
      );
      await SoftwareRiskService.recalculateForInventory(insResult.insertId, tenantId);
      added++;
    } else {
      await db.query(
        `UPDATE endpoint_software_inventory SET
          name = ?, version = ?, install_location = ?, executable_paths = ?,
          uninstall_string = ?, quiet_uninstall_string = ?, install_date = ?,
          architecture = ?, source = ?, last_seen_at = ?, status = 'installed', removed_at = NULL
         WHERE id = ?`,
        [
          row.name,
          row.version,
          row.install_location,
          row.executable_paths,
          row.uninstall_string,
          row.quiet_uninstall_string,
          row.install_date,
          row.architecture,
          row.source,
          now,
          prev.id,
        ]
      );
      if (prev.version !== row.version || prev.status !== 'installed') updated++;
      await SoftwareRiskService.recalculateForInventory(prev.id, tenantId);
    }
    existingByFp.delete(fp);
  }

  for (const fp of removedFingerprints || []) {
    const prev = existingByFp.get(fp) || (await db.query(
      `SELECT id FROM endpoint_software_inventory WHERE tenant_id = ? AND endpoint_id = ? AND fingerprint = ?`,
      [tenantId, endpointId, fp]
    ))?.[0];
    if (prev?.id) {
      await db.query(
        `UPDATE endpoint_software_inventory SET status = 'removed', removed_at = ? WHERE id = ?`,
        [now, prev.id]
      );
      removed++;
    }
  }

  if (scanType === 'full') {
    for (const [, prev] of existingByFp) {
      if (prev.status === 'installed') {
        await db.query(
          `UPDATE endpoint_software_inventory SET status = 'removed', removed_at = ? WHERE id = ?`,
          [now, prev.id]
        );
        removed++;
      }
    }
  }

  return { added, updated, removed, scan_id: inventoryScanId, agent_version: agentVersion };
}

async function listInventory(filters = {}) {
  const {
    tenantId,
    endpointId,
    softwareName,
    vendor,
    version,
    riskLevel,
    riskScoreMin,
    blocked,
    outdated,
    cveId,
    status = 'installed',
    limit = 100,
    offset = 0,
  } = filters;

  const where = ['esi.tenant_id = ?'];
  const params = [tenantId];

  if (endpointId) {
    where.push('esi.endpoint_id = ?');
    params.push(endpointId);
  }
  if (softwareName) {
    where.push('(esi.name LIKE ? OR esi.normalized_name LIKE ?)');
    params.push(`%${softwareName}%`, `%${normalizeName(softwareName)}%`);
  }
  if (vendor) {
    where.push('(esi.vendor LIKE ? OR esi.normalized_vendor LIKE ?)');
    params.push(`%${vendor}%`, `%${normalizeVendor(vendor)}%`);
  }
  if (version) {
    where.push('esi.version LIKE ?');
    params.push(`%${version}%`);
  }
  if (status) {
    where.push('esi.status = ?');
    params.push(status);
  }
  if (riskLevel) {
    where.push('esr.risk_level = ?');
    params.push(riskLevel);
  }
  if (riskScoreMin != null) {
    where.push('esr.risk_score >= ?');
    params.push(Number(riskScoreMin));
  }
  if (blocked === true || blocked === 'true' || blocked === '1') {
    where.push('esr.blocked = 1');
  }
  if (outdated === true || outdated === 'true') {
    where.push('esr.outdated = 1');
  }
  if (cveId) {
    where.push(
      `EXISTS (SELECT 1 FROM software_vulnerabilities sv
       WHERE sv.normalized_name = esi.normalized_name AND sv.cve_id = ?)`
    );
    params.push(cveId);
  }

  const sql = `
    SELECT esi.*, e.hostname, esr.risk_score, esr.risk_level, esr.recommended_action,
           esr.blocked, esr.accepted_risk, esr.vulnerability_count, esr.critical_count,
           esr.outdated, esr.unsupported, esr.known_exploit_count, esr.high_count,
           esr.reason, esr.risk_factors_json, esr.accepted_risk_until
    FROM endpoint_software_inventory esi
    JOIN endpoints e ON e.id = esi.endpoint_id
    LEFT JOIN endpoint_software_risk esr ON esr.software_inventory_id = esi.id
    WHERE ${where.join(' AND ')}
    ORDER BY esr.risk_score DESC, esi.last_seen_at DESC
    LIMIT ? OFFSET ?`;
  params.push(Number(limit), Number(offset));

  try {
    const rows = await db.query(sql, params);
    const [countRow] = await db.query(
      `SELECT COUNT(*) AS total FROM endpoint_software_inventory esi
       LEFT JOIN endpoint_software_risk esr ON esr.software_inventory_id = esi.id
       WHERE ${where.join(' AND ')}`,
      params.slice(0, -2)
    );
    return { rows, total: countRow?.total || countRow?.[0]?.total || 0 };
  } catch (err) {
    if (isMissingTable(err)) return { rows: [], total: 0 };
    throw err;
  }
}

async function getById(id, tenantId) {
  const rows = await db.query(
    `SELECT esi.*, e.hostname, esr.*
     FROM endpoint_software_inventory esi
     JOIN endpoints e ON e.id = esi.endpoint_id
     LEFT JOIN endpoint_software_risk esr ON esr.software_inventory_id = esi.id
     WHERE esi.id = ? AND esi.tenant_id = ?`,
    [id, tenantId]
  );
  const row = rows?.[0];
  if (!row) return null;
  const vulns = await SoftwareRiskService.findMatchingVulnerabilities(row);
  let factors = null;
  try {
    factors = row.risk_factors_json ? JSON.parse(row.risk_factors_json) : null;
  } catch {
    factors = null;
  }
  return { ...row, vulnerabilities: vulns, risk_factors: factors };
}

async function getSummary(tenantId) {
  try {
    const [totals] = await db.query(
      `SELECT
        COUNT(*) AS total_installed,
        SUM(CASE WHEN esr.risk_level IN ('high','critical') THEN 1 ELSE 0 END) AS vulnerable_count,
        SUM(CASE WHEN esr.risk_level = 'critical' THEN 1 ELSE 0 END) AS critical_count,
        SUM(CASE WHEN esr.risk_level = 'high' THEN 1 ELSE 0 END) AS high_count,
        SUM(CASE WHEN esr.blocked = 1 THEN 1 ELSE 0 END) AS blocked_count,
        COUNT(DISTINCT esi.endpoint_id) AS endpoints_affected
       FROM endpoint_software_inventory esi
       LEFT JOIN endpoint_software_risk esr ON esr.software_inventory_id = esi.id
       WHERE esi.tenant_id = ? AND esi.status = 'installed'`,
      [tenantId]
    );

    const topRisky = await db.query(
      `SELECT esi.name, esi.vendor, esi.version, COUNT(*) AS endpoint_count,
              MAX(esr.risk_score) AS max_risk
       FROM endpoint_software_inventory esi
       JOIN endpoint_software_risk esr ON esr.software_inventory_id = esi.id
       WHERE esi.tenant_id = ? AND esi.status = 'installed' AND esr.risk_score >= 61
       GROUP BY esi.normalized_name, esi.vendor, esi.version
       ORDER BY max_risk DESC
       LIMIT 10`,
      [tenantId]
    );

    const topVendors = await db.query(
      `SELECT esi.vendor, COUNT(*) AS c
       FROM endpoint_software_inventory esi
       WHERE esi.tenant_id = ? AND esi.status = 'installed' AND esi.vendor IS NOT NULL
       GROUP BY esi.normalized_vendor ORDER BY c DESC LIMIT 10`,
      [tenantId]
    );

    const [remediation] = await db.query(
      `SELECT status, COUNT(*) AS c FROM software_remediation_actions
       WHERE tenant_id = ? GROUP BY status`,
      [tenantId]
    );

    return {
      ...(totals || {}),
      top_vulnerable_software: topRisky || [],
      top_vendors: topVendors || [],
      remediation_status: remediation || [],
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        total_installed: 0,
        vulnerable_count: 0,
        critical_count: 0,
        high_count: 0,
        blocked_count: 0,
        endpoints_affected: 0,
        top_vulnerable_software: [],
        top_vendors: [],
        remediation_status: [],
      };
    }
    throw err;
  }
}

async function logInventoryUpload({ tenantId, endpointId, summary, username }) {
  await AuditLogService.log({
    username,
    action: 'software.inventory_uploaded',
    resourceType: 'endpoint',
    resourceId: String(endpointId),
    details: {
      tenant_id: tenantId,
      added: summary.added,
      updated: summary.updated,
      removed: summary.removed,
      scan_id: summary.scan_id,
    },
  });
}

module.exports = {
  ingestInventory,
  listInventory,
  getById,
  getSummary,
  logInventoryUpload,
};
