-- Phase 5 — tenants + endpoints.tenant_id (Falcon-style enrollment)
-- Prefer: cd server-node && npm run migrate-phase5-endpoints-tenant

-- See schema-phase5.sql for full tenants DDL. Minimal:

CREATE TABLE IF NOT EXISTS tenants (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  slug VARCHAR(64) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_slug (slug)
) ENGINE=InnoDB;

INSERT INTO tenants (name, slug, is_active)
SELECT 'Default', 'default', TRUE
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM tenants LIMIT 1);

-- Add column only if missing (run manually once):
-- ALTER TABLE endpoints ADD COLUMN tenant_id INT UNSIGNED NULL AFTER agent_key;
