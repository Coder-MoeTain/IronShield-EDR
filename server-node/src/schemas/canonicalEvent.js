/**
 * Canonical telemetry event schema (Phase 4).
 */
const { z } = require('zod');

const hostSchema = z
  .object({
    hostname: z.string().optional(),
    os: z.string().optional(),
    ip: z.string().optional(),
    agent_version: z.string().optional(),
  })
  .partial();

const userSchema = z
  .object({
    name: z.string().optional(),
    domain: z.string().optional(),
    sid: z.string().optional(),
  })
  .partial();

const processSchema = z
  .object({
    pid: z.number().int().optional(),
    ppid: z.number().int().optional(),
    name: z.string().optional(),
    path: z.string().optional(),
    command_line: z.string().optional(),
    sha256: z.string().optional(),
    signed: z.boolean().optional(),
    publisher: z.string().optional(),
  })
  .partial();

const networkSchema = z
  .object({
    local_ip: z.string().optional(),
    local_port: z.number().int().optional(),
    remote_ip: z.string().optional(),
    remote_port: z.number().int().optional(),
    protocol: z.string().optional(),
    direction: z.string().optional(),
  })
  .partial();

const fileSchema = z
  .object({
    path: z.string().optional(),
    sha256: z.string().optional(),
    operation: z.string().optional(),
  })
  .partial();

const registrySchema = z
  .object({
    key: z.string().optional(),
    value: z.string().optional(),
    operation: z.string().optional(),
  })
  .partial();

const detectionSchema = z
  .object({
    rule_id: z.string().optional(),
    rule_name: z.string().optional(),
    mitre_tactics: z.array(z.string()).optional(),
    mitre_techniques: z.array(z.string()).optional(),
    risk_score: z.number().optional(),
  })
  .partial();

const canonicalEventSchema = z.object({
  event_id: z.string().uuid().optional(),
  tenant_id: z.union([z.number().int(), z.string()]).optional().nullable(),
  endpoint_id: z.union([z.number().int(), z.string()]),
  event_type: z.string().min(1),
  event_time: z.string().min(1),
  ingested_at: z.string().optional(),
  severity: z.enum(['info', 'low', 'medium', 'high', 'critical']).default('info'),
  host: hostSchema.optional(),
  user: userSchema.optional(),
  process: processSchema.optional(),
  network: networkSchema.optional(),
  file: fileSchema.optional(),
  registry: registrySchema.optional(),
  detection: detectionSchema.optional(),
  raw: z.record(z.unknown()).optional(),
});

module.exports = {
  canonicalEventSchema,
  hostSchema,
  processSchema,
};
