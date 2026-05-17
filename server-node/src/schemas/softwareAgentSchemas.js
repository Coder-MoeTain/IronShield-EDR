/**
 * Zod schemas for software agent API
 */
const { z } = require('zod');

const softwareItemSchema = z.object({
  fingerprint: z.string().max(64).optional(),
  name: z.string().min(1).max(512),
  vendor: z.string().max(255).nullish(),
  version: z.string().max(128).nullish(),
  install_location: z.string().max(2048).nullish(),
  executable_paths: z.array(z.string().max(1024)).optional(),
  uninstall_string: z.string().max(2048).nullish(),
  quiet_uninstall_string: z.string().max(2048).nullish(),
  install_date: z.string().max(32).nullish(),
  architecture: z.string().max(16).nullish(),
  source: z.string().max(32).optional(),
  status: z.enum(['installed', 'removed', 'unknown']).optional(),
});

module.exports = {
  softwareInventorySchema: z.object({
    body: z.object({
      endpoint_id: z.union([z.string(), z.number()]).optional(),
      inventory_scan_id: z.string().max(64).optional(),
      scan_type: z.enum(['full', 'delta']).optional(),
      started_at: z.string().optional(),
      completed_at: z.string().optional(),
      agent_version: z.string().max(32).optional(),
      software: z.array(softwareItemSchema).max(5000),
      removed_fingerprints: z.array(z.string().max(64)).optional(),
    }),
  }),
};
