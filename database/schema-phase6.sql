-- =====================================================
-- Open EDR Platform - Phase 6 Schema (Phase C)
-- Multi-Tenancy, RBAC, Notifications, Retention, Agent Update
-- Run schema-phase5.sql first if not already applied.
-- =====================================================

USE edr_platform;

-- =====================================================
-- ADD TENANT_ID: Run scripts/migrate-phase6.js to add columns
-- =====================================================

-- =====================================================
-- NOTIFICATION CHANNELS (email, webhook per tenant)
-- =====================================================
CREATE TABLE IF NOT EXISTS notification_channels (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT UNSIGNED,
  type ENUM('email', 'webhook', 'slack') NOT NULL,
  name VARCHAR(128),
  config JSON NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_channel_tenant (tenant_id)
) ENGINE=InnoDB;

-- =====================================================
-- RETENTION POLICIES
-- =====================================================
CREATE TABLE IF NOT EXISTS retention_policies (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT UNSIGNED,
  name VARCHAR(128) NOT NULL,
  table_name VARCHAR(64) NOT NULL,
  retain_days INT UNSIGNED NOT NULL DEFAULT 90,
  archive_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  last_run_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_retention_tenant (tenant_id)
) ENGINE=InnoDB;

-- =====================================================
-- AGENT RELEASES (for auto-update)
-- =====================================================
CREATE TABLE IF NOT EXISTS agent_releases (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  version VARCHAR(32) NOT NULL UNIQUE,
  download_url VARCHAR(512),
  checksum_sha256 VARCHAR(64),
  release_notes TEXT,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_release_version (version)
) ENGINE=InnoDB;
