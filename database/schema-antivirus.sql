-- =====================================================
-- Open EDR Platform - Antivirus Module Schema
-- Run after schema-phase6.sql
-- =====================================================

USE edr_platform;

-- =====================================================
-- AV SIGNATURES
-- =====================================================
CREATE TABLE IF NOT EXISTS av_signatures (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT UNSIGNED DEFAULT NULL,
  signature_uuid VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  signature_type ENUM('hash', 'pattern', 'path', 'filename') NOT NULL,
  pattern TEXT,
  hash_value VARCHAR(64),
  hash_type ENUM('sha256', 'sha1', 'md5') DEFAULT 'sha256',
  family VARCHAR(128),
  severity ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'medium',
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_signature_uuid (signature_uuid),
  INDEX idx_av_sig_hash (hash_value),
  INDEX idx_av_sig_type (signature_type),
  INDEX idx_av_sig_enabled (enabled),
  INDEX idx_av_sig_tenant (tenant_id)
) ENGINE=InnoDB;

-- =====================================================
-- AV SIGNATURE BUNDLES (versioned releases)
-- =====================================================
CREATE TABLE IF NOT EXISTS av_signature_bundles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  bundle_version VARCHAR(32) NOT NULL UNIQUE,
  checksum_sha256 VARCHAR(64),
  release_notes TEXT,
  signature_count INT UNSIGNED DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  INDEX idx_av_bundle_active (is_active)
) ENGINE=InnoDB;

-- =====================================================
-- AV SCAN POLICIES
-- =====================================================
CREATE TABLE IF NOT EXISTS av_scan_policies (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT UNSIGNED DEFAULT NULL,
  name VARCHAR(128) NOT NULL,
  description TEXT,
  realtime_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  scheduled_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  execute_scan_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  quarantine_threshold INT UNSIGNED NOT NULL DEFAULT 70,
  alert_threshold INT UNSIGNED NOT NULL DEFAULT 50,
  max_file_size_mb INT UNSIGNED NOT NULL DEFAULT 100,
  process_kill_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  rescan_on_detection BOOLEAN NOT NULL DEFAULT TRUE,
  include_paths_json JSON,
  exclude_paths_json JSON,
  exclude_extensions_json JSON,
  exclude_hashes_json JSON,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_av_policy_tenant (tenant_id)
) ENGINE=InnoDB;

-- =====================================================
-- AV SCAN TASKS
-- =====================================================
CREATE TABLE IF NOT EXISTS av_scan_tasks (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  endpoint_id INT UNSIGNED NOT NULL,
  task_type ENUM('on_demand', 'scheduled', 'realtime', 'targeted') NOT NULL,
  requested_by VARCHAR(128),
  status ENUM('pending', 'in_progress', 'completed', 'failed', 'cancelled') NOT NULL DEFAULT 'pending',
  target_path VARCHAR(1024),
  policy_id INT UNSIGNED,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  completed_at DATETIME,
  error_message TEXT,
  files_scanned INT UNSIGNED DEFAULT 0,
  detections_found INT UNSIGNED DEFAULT 0,
  INDEX idx_av_task_endpoint (endpoint_id),
  INDEX idx_av_task_status (status),
  INDEX idx_av_task_created (created_at),
  FOREIGN KEY (endpoint_id) REFERENCES endpoints(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =====================================================
-- AV SCAN RESULTS
-- =====================================================
CREATE TABLE IF NOT EXISTS av_scan_results (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  endpoint_id INT UNSIGNED NOT NULL,
  task_id INT UNSIGNED,
  file_path VARCHAR(1024) NOT NULL,
  file_name VARCHAR(512),
  sha256 VARCHAR(64),
  file_size BIGINT UNSIGNED,
  detection_name VARCHAR(255),
  detection_type ENUM('signature', 'hash', 'heuristic', 'reputation') NOT NULL,
  family VARCHAR(128),
  severity ENUM('low', 'medium', 'high', 'critical') NOT NULL,
  score INT UNSIGNED NOT NULL DEFAULT 0,
  disposition ENUM('clean', 'suspicious', 'malicious', 'quarantined', 'restored', 'false_positive') NOT NULL DEFAULT 'suspicious',
  signer_status VARCHAR(64),
  scan_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  raw_details_json JSON,
  INDEX idx_av_result_endpoint (endpoint_id),
  INDEX idx_av_result_sha256 (sha256),
  INDEX idx_av_result_severity (severity),
  INDEX idx_av_result_scan_time (scan_time),
  INDEX idx_av_result_task (task_id),
  FOREIGN KEY (endpoint_id) REFERENCES endpoints(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES av_scan_tasks(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- =====================================================
-- AV QUARANTINE ITEMS
-- =====================================================
CREATE TABLE IF NOT EXISTS av_quarantine_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  endpoint_id INT UNSIGNED NOT NULL,
  original_path VARCHAR(1024) NOT NULL,
  quarantine_path VARCHAR(1024) NOT NULL,
  quarantine_key_id VARCHAR(64),
  sha256 VARCHAR(64),
  detection_name VARCHAR(255),
  quarantined_by VARCHAR(128) NOT NULL,
  status ENUM('quarantined', 'restored', 'deleted') NOT NULL DEFAULT 'quarantined',
  restore_requested_by VARCHAR(128),
  restored_by VARCHAR(128),
  deleted_by VARCHAR(128),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  restored_at DATETIME,
  deleted_at DATETIME,
  INDEX idx_av_quarantine_endpoint (endpoint_id),
  INDEX idx_av_quarantine_status (status),
  INDEX idx_av_quarantine_sha256 (sha256),
  INDEX idx_av_quarantine_created (created_at),
  FOREIGN KEY (endpoint_id) REFERENCES endpoints(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =====================================================
-- AV EXCLUSIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS av_exclusions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT UNSIGNED DEFAULT NULL,
  exclusion_type ENUM('path', 'hash', 'process_name', 'signer', 'extension', 'policy_group') NOT NULL,
  value VARCHAR(512) NOT NULL,
  reason TEXT,
  policy_id INT UNSIGNED,
  created_by VARCHAR(128) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  INDEX idx_av_exclusion_type (exclusion_type),
  INDEX idx_av_exclusion_policy (policy_id),
  INDEX idx_av_exclusion_tenant (tenant_id)
) ENGINE=InnoDB;

-- =====================================================
-- MALWARE ALERTS (correlates with EDR alerts)
-- =====================================================
CREATE TABLE IF NOT EXISTS malware_alerts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT UNSIGNED DEFAULT NULL,
  endpoint_id INT UNSIGNED NOT NULL,
  scan_result_id BIGINT UNSIGNED,
  alert_title VARCHAR(255) NOT NULL,
  alert_description TEXT,
  severity ENUM('low', 'medium', 'high', 'critical') NOT NULL,
  confidence INT UNSIGNED NOT NULL DEFAULT 50,
  status ENUM('new', 'investigating', 'resolved', 'false_positive') NOT NULL DEFAULT 'new',
  assigned_to VARCHAR(128),
  edr_alert_id INT UNSIGNED,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_malware_alert_endpoint (endpoint_id),
  INDEX idx_malware_alert_severity (severity),
  INDEX idx_malware_alert_status (status),
  INDEX idx_malware_alert_created (created_at),
  INDEX idx_malware_alert_tenant (tenant_id),
  FOREIGN KEY (endpoint_id) REFERENCES endpoints(id) ON DELETE CASCADE,
  FOREIGN KEY (scan_result_id) REFERENCES av_scan_results(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- =====================================================
-- AV UPDATE STATUS (per endpoint)
-- =====================================================
CREATE TABLE IF NOT EXISTS av_update_status (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  endpoint_id INT UNSIGNED NOT NULL,
  bundle_version VARCHAR(32),
  status ENUM('unknown', 'up_to_date', 'outdated', 'failed') NOT NULL DEFAULT 'unknown',
  last_checked_at DATETIME,
  last_applied_at DATETIME,
  error_message TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_av_update_endpoint (endpoint_id),
  INDEX idx_av_update_status (status),
  FOREIGN KEY (endpoint_id) REFERENCES endpoints(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =====================================================
-- AV BUNDLE SIGNATURES (many-to-many: bundle <-> signatures)
-- =====================================================
CREATE TABLE IF NOT EXISTS av_bundle_signatures (
  bundle_id INT UNSIGNED NOT NULL,
  signature_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (bundle_id, signature_id),
  FOREIGN KEY (bundle_id) REFERENCES av_signature_bundles(id) ON DELETE CASCADE,
  FOREIGN KEY (signature_id) REFERENCES av_signatures(id) ON DELETE CASCADE
) ENGINE=InnoDB;
