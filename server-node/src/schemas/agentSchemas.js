/**
 * Zod validation schemas for agent API
 */
const { z } = require('zod');

module.exports = {
  registerSchema: z.object({
    body: z.object({
      hostname: z.string().min(1).max(255),
      os_version: z.string().max(128).optional(),
      logged_in_user: z.string().max(255).optional(),
      ip_address: z.string().max(45).optional(),
      mac_address: z.string().max(64).optional(),
      agent_version: z.string().max(32).optional(),
      registration_token: z.string().optional(),
      tenant_slug: z.string().max(64).optional(),
    }),
  }),
  heartbeatSchema: z.object({
    // JSON clients often send explicit null for omitted telemetry; .optional() rejects null.
    body: z
      .object({
        hostname: z.string().max(255).nullish(),
        os_version: z.string().max(128).nullish(),
        logged_in_user: z.string().max(255).nullish(),
        ip_address: z.string().max(45).nullish(),
        mac_address: z.string().max(64).nullish(),
        agent_version: z.string().max(32).nullish(),
        connections: z
          .array(
            z.object({
              local_address: z.string().nullish(),
              local_port: z.number().nullish(),
              remote_address: z.string().nullish(),
              remote_port: z.number().nullish(),
              protocol: z.string().nullish(),
              state: z.string().nullish(),
            })
          )
          .nullish(),
        cpu_percent: z.number().nullish(),
        ram_percent: z.number().nullish(),
        ram_total_mb: z.number().nullish(),
        ram_used_mb: z.number().nullish(),
        disk_percent: z.number().nullish(),
        disk_total_gb: z.number().nullish(),
        disk_used_gb: z.number().nullish(),
        network_rx_mbps: z.number().nullish(),
        network_tx_mbps: z.number().nullish(),
        queue_depth: z.number().int().nullish(),
        process_uptime_seconds: z.number().int().nullish(),
        host_isolation_active: z.boolean().nullish(),
        sensor_operational_status: z.string().max(32).nullish(),
        agent_update_status: z.string().max(32).nullish(),
        available_agent_version: z.string().max(32).nullish(),
        last_agent_update_check_utc: z.string().max(48).nullish(),
        av_signature_bundle: z.string().max(64).nullish(),
        av_realtime_enabled: z.boolean().nullish(),
        av_prevention_status: z.string().max(32).nullish(),
        av_signature_count: z.number().int().min(0).max(2147483647).nullish(),
        edr_policy_id: z.number().int().nullish(),
        last_edr_policy_sync_utc: z.string().max(48).nullish(),
      })
      .optional()
      .default({}),
  }),
  eventsBatchSchema: z.object({
    body: z.object({
      events: z.array(z.record(z.any())).max(500),
    }),
  }),
};
