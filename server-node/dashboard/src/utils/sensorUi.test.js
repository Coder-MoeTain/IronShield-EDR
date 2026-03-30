import { describe, it, expect } from 'vitest';
import { endpointSensorListDisplay } from './sensorUi';

describe('endpointSensorListDisplay', () => {
  it('prioritizes update_available', () => {
    const d = endpointSensorListDisplay({
      agent_update_status: 'update_available',
      host_isolation_active: 1,
      sensor_operational_status: 'degraded',
    });
    expect(d.text).toBe('Update');
    expect(d.className).toBe('sensorUpdatePending');
  });

  it('shows Contained when isolation active', () => {
    const d = endpointSensorListDisplay({
      host_isolation_active: true,
      sensor_queue_depth: 999,
    });
    expect(d.text).toBe('Contained');
  });

  it('shows Degraded', () => {
    const d = endpointSensorListDisplay({ sensor_operational_status: 'degraded' });
    expect(d.text).toBe('Degraded');
  });

  it('shows queue when depth > 0', () => {
    const d = endpointSensorListDisplay({ sensor_queue_depth: 42 });
    expect(d.text).toBe('Q:42');
    expect(d.className).toBe('sensorQueue');
  });

  it('does not show Q:0 as backlog', () => {
    const d = endpointSensorListDisplay({
      sensor_queue_depth: 0,
      sensor_operational_status: 'ok',
    });
    expect(d.text).toBe('OK');
  });

  it('shows OK for explicit ok status', () => {
    const d = endpointSensorListDisplay({ sensor_operational_status: 'ok' });
    expect(d.text).toBe('OK');
    expect(d.className).toBe('sensorOk');
  });

  it('shows OK for online host with heartbeat when no other signal', () => {
    const d = endpointSensorListDisplay({
      status: 'online',
      last_heartbeat_at: new Date().toISOString(),
    });
    expect(d.text).toBe('OK');
  });
});
