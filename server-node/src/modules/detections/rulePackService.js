/**
 * Detection rule pack management.
 */
const db = require('../../utils/db');
const { loadAllPacks, loadRulesFromDisk } = require('./ruleLoader');

let tablesReady = false;

async function ensureTables() {
  if (tablesReady) return;
  await db.execute(`
    CREATE TABLE IF NOT EXISTS detection_rule_packs (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      name VARCHAR(256) NOT NULL,
      description TEXT NULL,
      version VARCHAR(32) NOT NULL,
      platform VARCHAR(32) NOT NULL,
      enabled_by_default TINYINT(1) NOT NULL DEFAULT 1,
      minimum_agent_version VARCHAR(32) NULL,
      data_sources_required JSON NULL,
      pack_json JSON NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS detection_rule_pack_members (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      pack_id VARCHAR(64) NOT NULL,
      rule_id VARCHAR(64) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      UNIQUE KEY uk_pack_rule (pack_id, rule_id),
      KEY idx_pack_members_pack (pack_id)
    ) ENGINE=InnoDB
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS detection_rule_pack_tenant (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      tenant_id BIGINT UNSIGNED NOT NULL,
      pack_id VARCHAR(64) NOT NULL,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_tenant_pack (tenant_id, pack_id)
    ) ENGINE=InnoDB
  `);
  tablesReady = true;
}

async function syncPacksFromDisk() {
  await ensureTables();
  const packs = loadAllPacks();
  for (const pack of packs) {
    await db.execute(
      `INSERT INTO detection_rule_packs (id, name, description, version, platform, enabled_by_default, minimum_agent_version, data_sources_required, pack_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name), description = VALUES(description), version = VALUES(version),
         pack_json = VALUES(pack_json), updated_at = NOW()`,
      [
        pack.id,
        pack.name,
        pack.description,
        pack.version,
        pack.platform,
        pack.enabled_by_default !== false ? 1 : 0,
        pack.minimum_agent_version || null,
        JSON.stringify(pack.data_sources_required || []),
        JSON.stringify(pack),
      ]
    );
    for (let i = 0; i < (pack.rules || []).length; i++) {
      await db.execute(
        `INSERT IGNORE INTO detection_rule_pack_members (pack_id, rule_id, sort_order) VALUES (?, ?, ?)`,
        [pack.id, pack.rules[i], i]
      );
    }
  }
}

async function listPacks(tenantId = null) {
  await syncPacksFromDisk();
  const packs = await db.query('SELECT * FROM detection_rule_packs ORDER BY name');
  const rules = loadRulesFromDisk();
  const ruleMap = new Map(rules.map((r) => [r.id, r]));

  let tenantEnabled = {};
  if (tenantId != null) {
    const rows = await db.query(
      'SELECT pack_id, enabled FROM detection_rule_pack_tenant WHERE tenant_id = ?',
      [tenantId]
    );
    tenantEnabled = Object.fromEntries(rows.map((r) => [r.pack_id, r.enabled === 1]));
  }

  return packs.map((p) => {
    let packJson = p.pack_json;
    if (typeof packJson === 'string') {
      try {
        packJson = JSON.parse(packJson);
      } catch {
        packJson = {};
      }
    }
    const packRules = (packJson.rules || []).map((id) => ruleMap.get(id)).filter(Boolean);
    return {
      ...p,
      pack_json: packJson,
      rules_detail: packRules,
      tenant_enabled: tenantId != null ? tenantEnabled[p.id] : undefined,
    };
  });
}

async function setPackEnabled(packId, tenantId, enabled) {
  await ensureTables();
  await db.execute(
    `INSERT INTO detection_rule_pack_tenant (tenant_id, pack_id, enabled)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), updated_at = NOW()`,
    [tenantId, packId, enabled ? 1 : 0]
  );
}

module.exports = { listPacks, setPackEnabled, syncPacksFromDisk, ensureTables };
