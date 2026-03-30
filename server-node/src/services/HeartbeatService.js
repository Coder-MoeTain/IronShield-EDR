/**
 * Endpoint heartbeat service
 */
const db = require('../utils/db');
const logger = require('../utils/logger');
const NetworkService = require('./NetworkService');
const AlertService = require('./AlertService');
const RiskService = require('../modules/risk/riskService');
const AvPolicyService = require('../modules/antivirus/avPolicyService');

const RESOURCE_THRESHOLDS = { cpu: 90, ram: 90, disk: 95 };

/**
 * Process heartbeat and return endpoint ID
 */
async function processHeartbeat(agentKey, payload) {
  const endpoint = await db.queryOne(
    'SELECT id FROM endpoints WHERE agent_key = ?',
    [agentKey]
  );

  if (!endpoint) {
    throw new Error('Unknown agent key');
  }

  const {
    hostname,
    os_version,
    logged_in_user,
    ip_address,
    mac_address,
    agent_version,
    connections,
    cpu_percent,
    ram_percent,
    ram_total_mb,
    ram_used_mb,
    disk_percent,
    disk_total_gb,
    disk_used_gb,
    network_rx_mbps,
    network_tx_mbps,
    queue_depth,
    process_uptime_seconds,
    host_isolation_active,
    sensor_operational_status,
    agent_update_status,
    available_agent_version,
    last_agent_update_check_utc,
    edr_policy_id,
    last_edr_policy_sync_utc,
  } = payload;

  const qDepth = queue_depth != null ? Number(queue_depth) : null;
  const uptimeSec = process_uptime_seconds != null ? Number(process_uptime_seconds) : null;
  const isoActive =
    host_isolation_active === true ? 1 : host_isolation_active === false ? 0 : null;
  const sensorStatus =
    sensor_operational_status != null
      ? String(sensor_operational_status).substring(0, 16)
      : null;

  const updateStatus =
    agent_update_status != null ? String(agent_update_status).substring(0, 24) : null;
  const availAgentVer =
    available_agent_version != null ? String(available_agent_version).substring(0, 32) : null;
  let lastUpdateCheckAt = null;
  if (last_agent_update_check_utc != null && String(last_agent_update_check_utc).trim() !== '') {
    const d = new Date(last_agent_update_check_utc);
    if (!Number.isNaN(d.getTime())) lastUpdateCheckAt = d;
  }

  let edrPolicyId = null;
  if (edr_policy_id != null && edr_policy_id !== '') {
    const n = Number(edr_policy_id);
    if (!Number.isNaN(n) && n >= 0) edrPolicyId = n;
  }
  let lastEdrPolicySyncAt = null;
  if (last_edr_policy_sync_utc != null && String(last_edr_policy_sync_utc).trim() !== '') {
    const d = new Date(last_edr_policy_sync_utc);
    if (!Number.isNaN(d.getTime())) lastEdrPolicySyncAt = d;
  }

  // Upsert network connections from heartbeat
  if (Array.isArray(connections) && connections.length > 0) {
    for (const c of connections.slice(0, 150)) {
      try {
        const local = c.local_address != null ? c.local_address : (c.local?.address ?? null);
        const localPort = c.local_port ?? c.local?.port ?? null;
        const remote = c.remote_address != null ? c.remote_address : (c.remote?.address ?? null);
        const remotePort = c.remote_port ?? c.remote?.port ?? null;
        if (remote && remote !== '0.0.0.0') {
          await NetworkService.upsertConnection(endpoint.id, {
            local_address: local,
            local_port: localPort,
            remote_address: remote,
            remote_port: remotePort ?? 0,
            protocol: c.protocol || 'TCP',
            state: c.state ?? null,
            process_name: c.process_name ?? null,
            process_path: c.process_path ?? null,
          });
        }
      } catch (e) {
        logger.warn({ err: e.message }, 'Network connection upsert in heartbeat');
      }
    }
  }

  const hbParams = [
    hostname ? String(hostname).substring(0, 255) : null,
    os_version ? String(os_version).substring(0, 128) : null,
    logged_in_user ? String(logged_in_user).substring(0, 255) : null,
    ip_address ? String(ip_address).substring(0, 45) : null,
    mac_address ? String(mac_address).substring(0, 64) : null,
    agent_version ? String(agent_version).substring(0, 32) : null,
    cpu_percent != null ? Number(cpu_percent) : null,
    ram_percent != null ? Number(ram_percent) : null,
    disk_percent != null ? Number(disk_percent) : null,
    qDepth,
    uptimeSec,
    isoActive,
    sensorStatus,
    updateStatus,
    availAgentVer,
    lastUpdateCheckAt,
    edrPolicyId,
    lastEdrPolicySyncAt,
    endpoint.id,
  ];

  try {
    await db.query(
      `UPDATE endpoints SET
        hostname = COALESCE(?, hostname),
        os_version = COALESCE(?, os_version),
        logged_in_user = COALESCE(?, logged_in_user),
        ip_address = COALESCE(?, ip_address),
        mac_address = COALESCE(?, mac_address),
        agent_version = COALESCE(?, agent_version),
        cpu_percent = COALESCE(?, cpu_percent),
        ram_percent = COALESCE(?, ram_percent),
        disk_percent = COALESCE(?, disk_percent),
        sensor_queue_depth = COALESCE(?, sensor_queue_depth),
        sensor_uptime_seconds = COALESCE(?, sensor_uptime_seconds),
        host_isolation_active = COALESCE(?, host_isolation_active),
        sensor_operational_status = COALESCE(?, sensor_operational_status),
        agent_update_status = COALESCE(?, agent_update_status),
        available_agent_version = COALESCE(?, available_agent_version),
        last_agent_update_check_at = COALESCE(?, last_agent_update_check_at),
        edr_policy_id = COALESCE(?, edr_policy_id),
        last_edr_policy_sync_at = COALESCE(?, last_edr_policy_sync_at),
        last_heartbeat_at = NOW(),
        status = 'online'
      WHERE id = ?`,
      hbParams
    );
  } catch (e) {
    if (e.code === 'ER_BAD_FIELD_ERROR') {
      const idParam = hbParams[18];
      try {
        await db.query(
          `UPDATE endpoints SET
            hostname = COALESCE(?, hostname),
            os_version = COALESCE(?, os_version),
            logged_in_user = COALESCE(?, logged_in_user),
            ip_address = COALESCE(?, ip_address),
            mac_address = COALESCE(?, mac_address),
            agent_version = COALESCE(?, agent_version),
            cpu_percent = COALESCE(?, cpu_percent),
            ram_percent = COALESCE(?, ram_percent),
            disk_percent = COALESCE(?, disk_percent),
            sensor_queue_depth = COALESCE(?, sensor_queue_depth),
            sensor_uptime_seconds = COALESCE(?, sensor_uptime_seconds),
            host_isolation_active = COALESCE(?, host_isolation_active),
            sensor_operational_status = COALESCE(?, sensor_operational_status),
            agent_update_status = COALESCE(?, agent_update_status),
            available_agent_version = COALESCE(?, available_agent_version),
            last_agent_update_check_at = COALESCE(?, last_agent_update_check_at),
            last_heartbeat_at = NOW(),
            status = 'online'
          WHERE id = ?`,
          [...hbParams.slice(0, 16), idParam]
        );
      } catch (e2) {
        if (e2.code === 'ER_BAD_FIELD_ERROR') {
          try {
            await db.query(
              `UPDATE endpoints SET
                hostname = COALESCE(?, hostname),
                os_version = COALESCE(?, os_version),
                logged_in_user = COALESCE(?, logged_in_user),
                ip_address = COALESCE(?, ip_address),
                mac_address = COALESCE(?, mac_address),
                agent_version = COALESCE(?, agent_version),
                cpu_percent = COALESCE(?, cpu_percent),
                ram_percent = COALESCE(?, ram_percent),
                disk_percent = COALESCE(?, disk_percent),
                sensor_queue_depth = COALESCE(?, sensor_queue_depth),
                sensor_uptime_seconds = COALESCE(?, sensor_uptime_seconds),
                host_isolation_active = COALESCE(?, host_isolation_active),
                sensor_operational_status = COALESCE(?, sensor_operational_status),
                last_heartbeat_at = NOW(),
                status = 'online'
              WHERE id = ?`,
              [...hbParams.slice(0, 13), idParam]
            );
          } catch (e3) {
            if (e3.code === 'ER_BAD_FIELD_ERROR') {
              await db.query(
                `UPDATE endpoints SET
                  hostname = COALESCE(?, hostname),
                  os_version = COALESCE(?, os_version),
                  logged_in_user = COALESCE(?, logged_in_user),
                  ip_address = COALESCE(?, ip_address),
                  mac_address = COALESCE(?, mac_address),
                  agent_version = COALESCE(?, agent_version),
                  cpu_percent = COALESCE(?, cpu_percent),
                  ram_percent = COALESCE(?, ram_percent),
                  disk_percent = COALESCE(?, disk_percent),
                  last_heartbeat_at = NOW(),
                  status = 'online'
                WHERE id = ?`,
                [...hbParams.slice(0, 9), idParam]
              );
            } else {
              throw e3;
            }
          }
        } else {
          throw e2;
        }
      }
      logger.warn({ err: e.message }, 'Heartbeat: run migrations (sensor, phase6, phase8)');
    } else {
      throw e;
    }
  }

  await db.query(
    `INSERT INTO endpoint_heartbeats (endpoint_id, hostname, os_version, logged_in_user, ip_address, mac_address, agent_version)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      endpoint.id,
      hostname ? String(hostname).substring(0, 255) : null,
      os_version ? String(os_version).substring(0, 128) : null,
      logged_in_user ? String(logged_in_user).substring(0, 255) : null,
      ip_address ? String(ip_address).substring(0, 45) : null,
      mac_address ? String(mac_address).substring(0, 64) : null,
      agent_version ? String(agent_version).substring(0, 32) : null,
    ]
  );

  // Insert endpoint_metrics if table exists and any metric provided
  if (cpu_percent != null || ram_percent != null || disk_percent != null || network_rx_mbps != null || network_tx_mbps != null ||
      ram_total_mb != null || ram_used_mb != null || disk_total_gb != null || disk_used_gb != null) {
    try {
      await db.execute(
        `INSERT INTO endpoint_metrics (endpoint_id, cpu_percent, ram_percent, ram_total_mb, ram_used_mb, disk_percent, disk_total_gb, disk_used_gb, network_rx_mbps, network_tx_mbps)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          endpoint.id,
          cpu_percent ?? null,
          ram_percent ?? null,
          ram_total_mb ?? null,
          ram_used_mb ?? null,
          disk_percent ?? null,
          disk_total_gb ?? null,
          disk_used_gb ?? null,
          network_rx_mbps ?? null,
          network_tx_mbps ?? null,
        ]
      );
    } catch (e) {
      logger.warn({ err: e.message }, 'Endpoint metrics insert failed');
    }
  }

  // Host inventory: listening ports + SMB shares + hidden C:\ paths (Windows agent; JSON columns)
  try {
    const lp = payload.listening_ports;
    const sf = payload.shared_folders;
    const hc = payload.hidden_c_items;
    if (lp !== undefined || sf !== undefined || hc !== undefined) {
      const setParts = [];
      const vals = [];
      if (lp !== undefined) {
        setParts.push('host_listening_ports_json = ?');
        vals.push(
          lp == null
            ? null
            : Array.isArray(lp)
              ? JSON.stringify(lp.slice(0, 300))
              : null
        );
      }
      if (sf !== undefined) {
        setParts.push('host_shared_folders_json = ?');
        vals.push(
          sf == null
            ? null
            : Array.isArray(sf)
              ? JSON.stringify(sf.slice(0, 150))
              : null
        );
      }
      if (hc !== undefined) {
        setParts.push('host_hidden_c_json = ?');
        vals.push(
          hc == null
            ? null
            : Array.isArray(hc)
              ? JSON.stringify(hc.slice(0, 500))
              : null
        );
      }
      if (setParts.length) {
        setParts.push('host_inventory_at = NOW()');
        await db.query(
          `UPDATE endpoints SET ${setParts.join(', ')} WHERE id = ?`,
          [...vals, endpoint.id]
        );
      }
    }
  } catch (e) {
    if (e.code === 'ER_BAD_FIELD_ERROR') {
      // migrate-endpoint-host-inventory / migrate-endpoint-hidden-c not applied
    } else {
      logger.warn({ err: e.message }, 'Heartbeat: host inventory columns');
    }
  }

  // User-mode tamper / service integrity snapshot (agent TamperDefenseService)
  try {
    const ts = payload.tamper_signals;
    if (ts != null && typeof ts === 'object') {
      await db.query(`UPDATE endpoints SET tamper_signals_json = ? WHERE id = ?`, [
        JSON.stringify(ts).substring(0, 16000),
        endpoint.id,
      ]);
    }
  } catch (e) {
    if (e.code === 'ER_BAD_FIELD_ERROR') {
      // migrate-tamper-signals not applied
    } else {
      logger.warn({ err: e.message }, 'Heartbeat: tamper_signals_json');
    }
  }

  // Resource alerts when thresholds exceeded
  await checkResourceAlerts(endpoint.id, { cpu_percent, ram_percent, disk_percent });

  try {
    await checkTamperRiskAlert(endpoint.id, payload.tamper_signals);
  } catch (e) {
    logger.warn({ err: e.message }, 'Tamper risk alert');
  }

  if (payload.tamper_signals != null && typeof payload.tamper_signals === 'object') {
    try {
      await RiskService.calculateEndpointRisk(endpoint.id);
    } catch (_) {
      /* endpoint_risk_scores optional */
    }
  }

  await upsertAvNgavFromHeartbeat(endpoint.id, payload);

  try {
    await checkAvRealtimeDisabledAlert(endpoint.id, payload);
  } catch (e) {
    logger.warn({ err: e.message }, 'AV realtime disabled alert');
  }

  return { endpointId: endpoint.id };
}

const AV_REALTIME_DISABLED_TITLE = 'NGAV realtime protection disabled (heartbeat)';

/**
 * Alert when the agent reports realtime malware prevention off while assigned AV policy requires it.
 */
async function checkAvRealtimeDisabledAlert(endpointId, payload) {
  if (payload?.av_realtime_enabled !== false) return;

  let policy;
  try {
    policy = await AvPolicyService.getForEndpoint(endpointId);
  } catch (e) {
    logger.warn({ err: e.message }, 'checkAvRealtimeDisabledAlert: policy load');
    return;
  }
  if (!policy?.realtime_enabled) return;

  const open = await db.query(
    `SELECT id FROM alerts WHERE endpoint_id = ? AND title = ? AND status IN ('new', 'investigating') LIMIT 1`,
    [endpointId, AV_REALTIME_DISABLED_TITLE]
  );
  if (open?.length) return;

  const recent = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentAny = await db.query(
    `SELECT id FROM alerts WHERE endpoint_id = ? AND title = ? AND created_at > ? LIMIT 1`,
    [endpointId, AV_REALTIME_DISABLED_TITLE, recent]
  );
  if (recentAny?.length) return;

  const ep = await db.queryOne('SELECT hostname FROM endpoints WHERE id = ?', [endpointId]);
  const hostname = ep?.hostname || `Endpoint ${endpointId}`;
  const ps = payload.av_prevention_status != null ? String(payload.av_prevention_status) : 'unknown';
  const sig = payload.av_signature_count != null ? String(payload.av_signature_count) : '—';
  const bundle = payload.av_signature_bundle != null ? String(payload.av_signature_bundle) : '—';
  const desc = [
    `Agent reported NGAV realtime scanning is disabled on ${hostname} while policy "${policy.name || policy.id}" requires realtime protection.`,
    `Prevention status: ${ps}. Signature bundle: ${bundle}. Signature count: ${sig}.`,
    'Investigate policy sync, AV module health, disk space, and whether protection was disabled locally.',
  ].join(' ');

  await AlertService.createFromDetection([
    {
      endpoint_id: endpointId,
      rule_id: null,
      title: AV_REALTIME_DISABLED_TITLE,
      description: desc,
      severity: 'high',
      confidence: 0.9,
      mitre_tactic: 'Defense Evasion',
      mitre_technique: 'T1562',
      source_event_ids: null,
      first_seen: new Date(),
      last_seen: new Date(),
    },
  ]);
}

/** Phase 7 — NGAV / malware prevention row (Falcon-style) from heartbeat. */
async function upsertAvNgavFromHeartbeat(endpointId, payload) {
  const { av_signature_bundle, av_realtime_enabled, av_prevention_status, av_signature_count } =
    payload || {};
  if (
    av_signature_bundle == null &&
    av_realtime_enabled == null &&
    av_prevention_status == null &&
    av_signature_count == null
  ) {
    return;
  }
  const bv =
    av_signature_bundle != null ? String(av_signature_bundle).substring(0, 64) : null;
  const rt =
    av_realtime_enabled === true ? 1 : av_realtime_enabled === false ? 0 : null;
  const ps =
    av_prevention_status != null ? String(av_prevention_status).substring(0, 24) : null;
  const sc =
    av_signature_count != null && Number.isFinite(Number(av_signature_count))
      ? Math.max(0, Math.min(2147483647, parseInt(String(av_signature_count), 10)))
      : null;
  try {
    await db.execute(
      `INSERT INTO av_update_status (endpoint_id, bundle_version, status, realtime_enabled, prevention_status, signature_count, last_checked_at)
       VALUES (?, ?, 'up_to_date', ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         bundle_version = COALESCE(VALUES(bundle_version), bundle_version),
         realtime_enabled = COALESCE(VALUES(realtime_enabled), realtime_enabled),
         prevention_status = COALESCE(VALUES(prevention_status), prevention_status),
         signature_count = COALESCE(VALUES(signature_count), signature_count),
         last_checked_at = NOW(),
         status = IF(VALUES(prevention_status) = 'degraded', 'outdated', 'up_to_date')`,
      [endpointId, bv, rt, ps, sc]
    );
  } catch (e) {
    logger.warn({ err: e.message }, 'av_update_status NGAV upsert failed (schema-antivirus + migrate-phase7-ngav-telemetry?)');
  }
}

/** Deduped alerts for high (4h) / medium (12h) tamper risk. Risk score refresh runs after heartbeat when tamper_signals present. */
async function checkTamperRiskAlert(endpointId, tamperSignals) {
  if (tamperSignals == null || typeof tamperSignals !== 'object') return;
  const risk = String(tamperSignals.tamper_risk || '').toLowerCase();
  if (risk !== 'high' && risk !== 'medium') return;

  const isHigh = risk === 'high';
  const dedupeHours = isHigh ? 4 : 12;
  const titleExact = isHigh
    ? 'Sensor tamper risk: high (heartbeat)'
    : 'Sensor tamper risk: medium (heartbeat)';
  const recent = new Date(Date.now() - dedupeHours * 60 * 60 * 1000);
  const existing = await db.query(
    'SELECT 1 FROM alerts WHERE endpoint_id = ? AND title = ? AND created_at > ? LIMIT 1',
    [endpointId, titleExact, recent]
  );
  if (existing?.length) return;

  const ep = await db.queryOne('SELECT hostname FROM endpoints WHERE id = ?', [endpointId]);
  const hostname = ep?.hostname || `Endpoint ${endpointId}`;
  const stops = tamperSignals.service_stop_events_24h;
  const desc = [
    `Agent reported tamper_risk=${risk} for ${hostname}.`,
    `Service stop events (24h, SCM 7036): ${stops != null ? stops : 'unknown'}.`,
    `Windows service status: ${tamperSignals.windows_service_status || '—'}.`,
    'User-mode telemetry only—investigate service account, GPO, and host timeline.',
  ].join(' ');

  await AlertService.createFromDetection([
    {
      endpoint_id: endpointId,
      rule_id: null,
      title: titleExact,
      description: desc,
      severity: isHigh ? 'high' : 'medium',
      confidence: isHigh ? 85 : 72,
      mitre_tactic: 'Defense Evasion',
      mitre_technique: 'T1562',
      source_event_ids: null,
      first_seen: new Date(),
      last_seen: new Date(),
    },
  ]);
}

async function checkResourceAlerts(endpointId, metrics) {
  const ep = await db.queryOne('SELECT hostname FROM endpoints WHERE id = ?', [endpointId]);
  const hostname = ep?.hostname || `Endpoint ${endpointId}`;
  const now = new Date();
  const recent = new Date(now.getTime() - 15 * 60 * 1000);

  const toCreate = [];
  if (metrics.cpu_percent != null && metrics.cpu_percent >= RESOURCE_THRESHOLDS.cpu) {
    const existing = await db.query(
      "SELECT 1 FROM alerts WHERE endpoint_id = ? AND title LIKE 'Resource: CPU%' AND created_at > ? LIMIT 1",
      [endpointId, recent]
    );
    if (!existing?.length)
      toCreate.push({ type: 'cpu', value: metrics.cpu_percent, threshold: RESOURCE_THRESHOLDS.cpu });
  }
  if (metrics.ram_percent != null && metrics.ram_percent >= RESOURCE_THRESHOLDS.ram) {
    const existing = await db.query(
      "SELECT 1 FROM alerts WHERE endpoint_id = ? AND title LIKE 'Resource: RAM%' AND created_at > ? LIMIT 1",
      [endpointId, recent]
    );
    if (!existing?.length)
      toCreate.push({ type: 'ram', value: metrics.ram_percent, threshold: RESOURCE_THRESHOLDS.ram });
  }
  if (metrics.disk_percent != null && metrics.disk_percent >= RESOURCE_THRESHOLDS.disk) {
    const existing = await db.query(
      "SELECT 1 FROM alerts WHERE endpoint_id = ? AND title LIKE 'Resource: Disk%' AND created_at > ? LIMIT 1",
      [endpointId, recent]
    );
    if (!existing?.length)
      toCreate.push({ type: 'disk', value: metrics.disk_percent, threshold: RESOURCE_THRESHOLDS.disk });
  }

  for (const a of toCreate) {
    try {
      await AlertService.createFromDetection([{
        endpoint_id: endpointId,
        rule_id: null,
        title: `Resource: ${a.type.toUpperCase()} usage critical (${a.value}% >= ${a.threshold}%)`,
        description: `${hostname} - ${a.type.toUpperCase()} usage at ${a.value}% exceeds threshold ${a.threshold}%`,
        severity: a.value >= 98 ? 'critical' : 'high',
        confidence: 100,
        mitre_tactic: null,
        mitre_technique: null,
        source_event_ids: null,
        first_seen: now,
        last_seen: now,
      }]);
    } catch (e) {
      logger.warn({ err: e.message }, 'Resource alert creation failed');
    }
  }
}

module.exports = { processHeartbeat };
