/**
 * Falcon-style “Sensor” column for the All hosts table (Phase 4).
 * Priority: agent update > network containment > degraded health > queue backlog > OK.
 */

/**
 * @param {Record<string, unknown>} ep Endpoint row from /api/admin/endpoints
 * @returns {{ text: string, title: string, className: string | null }}
 */
export function endpointSensorListDisplay(ep) {
  if (!ep || typeof ep !== 'object') {
    return { text: '—', title: '', className: null };
  }

  const updateSt = String(ep.agent_update_status || '').toLowerCase();
  if (updateSt === 'update_available') {
    return {
      text: 'Update',
      title: 'Newer agent release available on server',
      className: 'sensorUpdatePending',
    };
  }

  if (ep.host_isolation_active === true || ep.host_isolation_active === 1) {
    return {
      text: 'Contained',
      title: 'Network containment active on host',
      className: 'sensorContain',
    };
  }

  const op = String(ep.sensor_operational_status || '').toLowerCase();
  if (op === 'degraded') {
    return {
      text: 'Degraded',
      title: 'Sensor backlog or health degraded',
      className: 'sensorDegraded',
    };
  }

  const rawQ = ep.sensor_queue_depth;
  const q = rawQ != null && rawQ !== '' ? Number(rawQ) : null;
  if (q != null && Number.isFinite(q) && q > 0) {
    return {
      text: `Q:${q}`,
      title: 'Local event queue depth (offline backlog)',
      className: 'sensorQueue',
    };
  }

  if (op === 'ok' || op === 'healthy' || op === 'operational') {
    return {
      text: 'OK',
      title: 'Sensor operational status reported healthy',
      className: 'sensorOk',
    };
  }

  if (String(ep.status || '').toLowerCase() === 'online' && ep.last_heartbeat_at) {
    return {
      text: 'OK',
      title: 'Sensor check-in from agent (no backlog or containment)',
      className: 'sensorOk',
    };
  }

  return {
    text: '—',
    title: 'No sensor telemetry yet',
    className: null,
  };
}
