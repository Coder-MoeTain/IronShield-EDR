/**
 * Endpoint heartbeat service
 */
const db = require('../utils/db');
const logger = require('../utils/logger');
const NetworkService = require('./NetworkService');
const AlertService = require('./AlertService');

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

  // Resource alerts when thresholds exceeded
  await checkResourceAlerts(endpoint.id, { cpu_percent, ram_percent, disk_percent });

  await upsertAvNgavFromHeartbeat(endpoint.id, payload);

  return { endpointId: endpoint.id };
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
