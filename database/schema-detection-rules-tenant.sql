-- Add tenant_id to detection_rules for enterprise multi-tenant support
-- Rules with tenant_id NULL apply globally (all tenants)
-- Run after schema-phase5.sql (tenants table exists)

ALTER TABLE detection_rules
  ADD COLUMN tenant_id INT UNSIGNED NULL AFTER id,
  ADD INDEX idx_detection_rules_tenant (tenant_id),
  ADD CONSTRAINT fk_detection_rules_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
