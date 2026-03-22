-- =====================================================
-- Open EDR Platform - MySQL Schema
-- Database: edr_platform
-- Phase 1 + Phase 2
-- =====================================================

CREATE DATABASE IF NOT EXISTS edr_platform
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE edr_platform;

-- =====================================================
-- ADMIN USERS
-- =====================================================
CREATE TABLE admin_users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  role ENUM('super_admin', 'analyst', 'viewer') NOT NULL DEFAULT 'analyst',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_admin_username (username),
  INDEX idx_admin_role (role)
) ENGINE=InnoDB;

-- =====================================================
-- ENDPOINTS
-- =====================================================
CREATE TABLE endpoints (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  agent_key VARCHAR(64) NOT NULL UNIQUE,
  hostname VARCHAR(255) NOT NULL,
  os_version VARCHAR(128),
  logged_in_user VARCHAR(255),
  ip_address VARCHAR(45),
  mac_address VARCHAR(64),
  agent_version VARCHAR(32),
  sensor_queue_depth INT UNSIGNED NULL,
  sensor_uptime_seconds INT UNSIGNED NULL,
  host_isolation_active TINYINT(1) NULL,
  sensor_operational_status VARCHAR(16) NULL,
  agent_update_status VARCHAR(24) NULL,
  available_agent_version VARCHAR(32) NULL,
  last_agent_update_check_at DATETIME NULL,
  edr_policy_id INT UNSIGNED NULL,
  last_edr_policy_sync_at DATETIME NULL,
  last_heartbeat_at DATETIME,
  status ENUM('online', 'offline', 'isolated', 'investigating', 'unknown') NOT NULL DEFAULT 'unknown',
  policy_status ENUM('normal', 'isolated', 'investigating') NOT NULL DEFAULT 'normal',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_endpoint_agent_key (agent_key),
  INDEX idx_endpoint_tenant (tenant_id),
  INDEX idx_endpoint_hostname (hostname),
  INDEX idx_endpoint_status (status),
  INDEX idx_endpoint_last_heartbeat (last_heartbeat_at)
) ENGINE=InnoDB;

-- =====================================================
-- ENDPOINT HEARTBEATS
-- =====================================================
CREATE TABLE endpoint_heartbeats (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  endpoint_id INT UNSIGNED NOT NULL,
  hostname VARCHAR(255),
  os_version VARCHAR(128),
  logged_in_user VARCHAR(255),
  ip_address VARCHAR(45),
  mac_address VARCHAR(64),
  agent_version VARCHAR(32),
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (endpoint_id) REFERENCES endpoints(id) ON DELETE CASCADE,
  INDEX idx_heartbeat_endpoint (endpoint_id),
  INDEX idx_heartbeat_received (received_at)
) ENGINE=InnoDB;

-- =====================================================
-- RAW EVENTS
-- =====================================================
CREATE TABLE raw_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  endpoint_id INT UNSIGNED NOT NULL,
  event_id VARCHAR(128),
  hostname VARCHAR(255),
  event_source VARCHAR(64),
  event_type VARCHAR(64),
  timestamp DATETIME NOT NULL,
  raw_event_json JSON NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (endpoint_id) REFERENCES endpoints(id) ON DELETE CASCADE,
  INDEX idx_raw_endpoint (endpoint_id),
  INDEX idx_raw_event_type (event_type),
  INDEX idx_raw_timestamp (timestamp),
  INDEX idx_raw_processed (processed),
  INDEX idx_raw_created (created_at)
) ENGINE=InnoDB;

-- =====================================================
-- NORMALIZED EVENTS (Phase 2)
-- =====================================================
CREATE TABLE normalized_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  raw_event_id BIGINT UNSIGNED,
  endpoint_id INT UNSIGNED NOT NULL,
  hostname VARCHAR(255),
  username VARCHAR(255),
  timestamp DATETIME NOT NULL,
  event_source VARCHAR(64),
  event_type VARCHAR(64),
  process_name VARCHAR(512),
  process_path VARCHAR(1024),
  process_id INT UNSIGNED,
  parent_process_name VARCHAR(512),
  parent_process_id INT UNSIGNED,
  command_line TEXT,
  file_hash_sha256 VARCHAR(64),
  source_ip VARCHAR(45),
  destination_ip VARCHAR(45),
  destination_port INT UNSIGNED,
  protocol VARCHAR(16),
  service_name VARCHAR(255),
  logon_type VARCHAR(32),
  powershell_command TEXT,
  dns_query VARCHAR(512),
  dns_query_type VARCHAR(32),
  registry_key VARCHAR(1024),
  registry_value_name VARCHAR(256),
  image_loaded_path VARCHAR(1024),
  raw_event_json JSON,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (endpoint_id) REFERENCES endpoints(id) ON DELETE CASCADE,
  FOREIGN KEY (raw_event_id) REFERENCES raw_events(id) ON DELETE SET NULL,
  INDEX idx_norm_endpoint (endpoint_id),
  INDEX idx_norm_event_type (event_type),
  INDEX idx_norm_timestamp (timestamp),
  INDEX idx_norm_process (process_name(128)),
  INDEX idx_norm_username (username(64)),
  INDEX idx_norm_dns (dns_query(128))
) ENGINE=InnoDB;

-- =====================================================
-- DETECTION RULES (Phase 2)
-- =====================================================
CREATE TABLE detection_rules (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  severity ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'medium',
  conditions JSON NOT NULL,
  mitre_tactic VARCHAR(128),
  mitre_technique VARCHAR(128),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_rule_name (name),
  INDEX idx_rule_enabled (enabled)
) ENGINE=InnoDB;

-- =====================================================
-- ALERTS (Phase 2)
-- =====================================================
CREATE TABLE alerts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  endpoint_id INT UNSIGNED NOT NULL,
  rule_id INT UNSIGNED,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  severity ENUM('low', 'medium', 'high', 'critical') NOT NULL,
  confidence DECIMAL(3,2) NOT NULL DEFAULT 1.00,
  mitre_tactic VARCHAR(128),
  mitre_technique VARCHAR(128),
  status ENUM('new', 'investigating', 'closed', 'false_positive') NOT NULL DEFAULT 'new',
  assigned_to VARCHAR(128),
  assigned_team VARCHAR(128),
  due_at DATETIME,
  sla_minutes INT UNSIGNED DEFAULT 240,
  sla_breached_at DATETIME,
  suppressed_by VARCHAR(128),
  suppression_reason TEXT,
  suppressed_at DATETIME,
  source_event_ids JSON,
  first_seen DATETIME NOT NULL,
  last_seen DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (endpoint_id) REFERENCES endpoints(id) ON DELETE CASCADE,
  FOREIGN KEY (rule_id) REFERENCES detection_rules(id) ON DELETE SET NULL,
  INDEX idx_alert_endpoint (endpoint_id),
  INDEX idx_alert_severity (severity),
  INDEX idx_alert_status (status),
  INDEX idx_alert_first_seen (first_seen),
  INDEX idx_alert_created (created_at),
  INDEX idx_alert_due (due_at),
  INDEX idx_alert_team (assigned_team(64))
) ENGINE=InnoDB;

-- =====================================================
-- ALERT NOTES (Phase 2)
-- =====================================================
CREATE TABLE alert_notes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  alert_id BIGINT UNSIGNED NOT NULL,
  author VARCHAR(128) NOT NULL,
  note TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE,
  INDEX idx_note_alert (alert_id)
) ENGINE=InnoDB;

-- =====================================================
-- RESPONSE ACTIONS (Phase 2)
-- =====================================================
CREATE TABLE response_actions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  endpoint_id INT UNSIGNED NOT NULL,
  action_type ENUM('kill_process', 'request_heartbeat', 'isolate_host', 'lift_isolation', 'mark_investigating', 'collect_triage', 'quarantine_file', 'block_ip', 'block_hash', 'run_script') NOT NULL,
  parameters JSON,
  requested_by VARCHAR(128) NOT NULL,
  status ENUM('pending', 'sent', 'acknowledged', 'completed', 'failed') NOT NULL DEFAULT 'pending',
  result_message TEXT,
  result_json JSON,
  sent_at DATETIME,
  completed_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (endpoint_id) REFERENCES endpoints(id) ON DELETE CASCADE,
  INDEX idx_response_endpoint (endpoint_id),
  INDEX idx_response_status (status),
  INDEX idx_response_created (created_at)
) ENGINE=InnoDB;

-- =====================================================
-- ENDPOINT POLICIES (Phase 2)
-- =====================================================
CREATE TABLE endpoint_policies (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  endpoint_id INT UNSIGNED NOT NULL UNIQUE,
  policy_status ENUM('normal', 'isolated', 'investigating') NOT NULL DEFAULT 'normal',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (endpoint_id) REFERENCES endpoints(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =====================================================
-- AUDIT LOGS
-- =====================================================
CREATE TABLE audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED,
  username VARCHAR(128),
  action VARCHAR(128) NOT NULL,
  resource_type VARCHAR(64),
  resource_id VARCHAR(64),
  details JSON,
  ip_address VARCHAR(45),
  user_agent VARCHAR(512),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE SET NULL,
  INDEX idx_audit_user (user_id),
  INDEX idx_audit_action (action),
  INDEX idx_audit_created (created_at)
) ENGINE=InnoDB;

-- =====================================================
-- SAVED VIEWS (Phase parity — run schema-phase5+ for tenants)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_saved_views (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  name VARCHAR(128) NOT NULL,
  page VARCHAR(64) NOT NULL,
  filters_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE,
  INDEX idx_saved_views_user_page (user_id, page)
) ENGINE=InnoDB;
