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
  } = payload;

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
    [
      hostname ? String(hostname).substring(0, 255) : null,
      os_version ? String(os_version).substring(0, 128) : null,
      logged_in_user ? String(logged_in_user).substring(0, 255) : null,
      ip_address ? String(ip_address).substring(0, 45) : null,
      mac_address ? String(mac_address).substring(0, 64) : null,
      agent_version ? String(agent_version).substring(0, 32) : null,
      cpu_percent != null ? Number(cpu_percent) : null,
      ram_percent != null ? Number(ram_percent) : null,
      disk_percent != null ? Number(disk_percent) : null,
      endpoint.id,
    ]
  );

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

  return { endpointId: endpoint.id };
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
