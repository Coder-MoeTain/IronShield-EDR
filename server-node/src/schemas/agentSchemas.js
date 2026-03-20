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
    }),
  }),
  heartbeatSchema: z.object({
    body: z.object({
      hostname: z.string().max(255).optional(),
      os_version: z.string().max(128).optional(),
      logged_in_user: z.string().max(255).optional(),
      ip_address: z.string().max(45).optional(),
      mac_address: z.string().max(64).optional(),
      agent_version: z.string().max(32).optional(),
      connections: z.array(z.object({
        local_address: z.string().optional(),
        local_port: z.number().optional(),
        remote_address: z.string().optional(),
        remote_port: z.number().optional(),
        protocol: z.string().optional(),
        state: z.string().optional(),
      })).optional(),
      cpu_percent: z.number().optional(),
      ram_percent: z.number().optional(),
      ram_total_mb: z.number().optional(),
      ram_used_mb: z.number().optional(),
      disk_percent: z.number().optional(),
      disk_total_gb: z.number().optional(),
      disk_used_gb: z.number().optional(),
      network_rx_mbps: z.number().optional(),
      network_tx_mbps: z.number().optional(),
    }).optional().default({}),
  }),
  eventsBatchSchema: z.object({
    body: z.object({
      events: z.array(z.record(z.any())).max(500),
    }),
  }),
};
