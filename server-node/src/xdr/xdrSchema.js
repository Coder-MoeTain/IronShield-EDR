const { z } = require('zod');

/**
 * Canonical XDR event envelope (Phase 2).
 * This is intentionally flexible: we keep strict top-level types and allow raw_json/metadata_json passthrough.
 */
const XdrEventSchema = z.object({
  tenant_id: z.number().int().nullable().optional(),
  endpoint_id: z.number().int().nullable().optional(),
  event_id: z.string().max(128).nullable().optional(),

  timestamp: z.union([z.string(), z.date()]),
  source: z.enum(['endpoint', 'zeek', 'web', 'auth']),
  event_type: z.string().max(64).nullable().optional(),

  user_name: z.string().max(255).nullable().optional(),
  host_name: z.string().max(255).nullable().optional(),

  process_name: z.string().max(255).nullable().optional(),
  process_path: z.string().max(1024).nullable().optional(),
  process_id: z.number().int().nullable().optional(),
  parent_process_id: z.number().int().nullable().optional(),
  parent_process_name: z.string().max(255).nullable().optional(),
  command_line: z.string().max(16384).nullable().optional(),

  file_path: z.string().max(1024).nullable().optional(),
  file_hash_sha256: z.string().max(64).nullable().optional(),
  registry_key: z.string().max(1024).nullable().optional(),
  registry_value_name: z.string().max(512).nullable().optional(),

  source_ip: z.string().max(64).nullable().optional(),
  destination_ip: z.string().max(64).nullable().optional(),
  destination_port: z.number().int().nullable().optional(),
  protocol: z.string().max(16).nullable().optional(),
  dns_query: z.string().max(1024).nullable().optional(),

  action: z.string().max(64).nullable().optional(),
  severity: z.string().max(16).nullable().optional(),
  risk_score: z.number().int().nullable().optional(),

  ingest_id: z.string().max(64).nullable().optional(),
  metadata_json: z.any().nullable().optional(),
  raw_json: z.any().nullable().optional(),
});

module.exports = { XdrEventSchema };

