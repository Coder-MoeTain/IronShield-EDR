-- =====================================================
-- Open EDR Platform - Phase 3 Schema Additions
-- Advanced Telemetry, Policy, Investigation, Triage
-- =====================================================

USE edr_platform;

-- =====================================================
-- ENDPOINT POLICIES (Phase 3 - replaces simple endpoint_policies)
-- =====================================================
DROP TABLE IF EXISTS endpoint_policy_assignments;
DROP TABLE IF EXISTS endpoint_policy_history;
DROP TABLE IF EXISTS endpoint_policies;

CREATE TABLE endpoint_policies (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL UNIQUE,
  mode ENUM('monitor_only', 'monitor_and_alert', 'restricted_response', 'full_response', 'high_sensitivity', 'server_policy', 'workstation_policy') NOT NULL DEFAULT 'monitor_and_alert',
  description TEXT,
  telemetry_interval_seconds INT UNSIGNED NOT NULL DEFAULT 30,
  batch_upload_size INT UNSIGNED NOT NULL DEFAULT 100,
  heartbeat_interval_minutes INT UNSIGNED NOT NULL DEFAULT 5,
  poll_interval_seconds INT UNSIGNED NOT NULL DEFAULT 60,
  allowed_response_actions JSON,
  allowed_triage_modules JSON,
  detection_sensitivity ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
  isolation_behavior ENUM('log_only', 'soft_block', 'full_isolation') NOT NULL DEFAULT 'log_only',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_policy_mode (mode),
  INDEX idx_policy_default (is_default)
) ENGINE=InnoDB;

CREATE TABLE endpoint_policy_assignments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  endpoint_id INT UNSIGNED NOT NULL,
  policy_id INT UNSIGNED NOT NULL,
  assigned_by VARCHAR(128),
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (endpoint_id) REFERENCES endpoints(id) ON DELETE CASCADE,
  FOREIGN KEY (policy_id) REFERENCES endpoint_policies(id) ON DELETE CASCADE,
  UNIQUE KEY uk_endpoint_policy (endpoint_id),
  INDEX idx_assignment_endpoint (endpoint_id),
  INDEX idx_assignment_policy (policy_id)
) ENGINE=InnoDB;

CREATE TABLE endpoint_policy_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  endpoint_id INT UNSIGNED NOT NULL,
  policy_id INT UNSIGNED,
  previous_policy_id INT UNSIGNED,
  changed_by VARCHAR(128),
  reason TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (endpoint_id) REFERENCES endpoints(id) ON DELETE CASCADE,
  FOREIGN KEY (policy_id) REFERENCES endpoint_policies(id) ON DELETE SET NULL,
  INDEX idx_history_endpoint (endpoint_id),
  INDEX idx_history_created (created_at)
) ENGINE=InnoDB;

-- =====================================================
-- INVESTIGATION CASES
-- =====================================================
CREATE TABLE investigation_cases (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  case_id VARCHAR(32) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  endpoint_id INT UNSIGNED,
  created_by VARCHAR(128) NOT NULL,
  assigned_to VARCHAR(128),
  severity ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'medium',
  status ENUM('open', 'investigating', 'resolved', 'closed') NOT NULL DEFAULT 'open',
  related_alert_ids JSON,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (endpoint_id) REFERENCES endpoints(id) ON DELETE SET NULL,
  INDEX idx_case_endpoint (endpoint_id),
  INDEX idx_case_status (status),
  INDEX idx_case_assigned (assigned_to),
  INDEX idx_case_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE investigation_case_notes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  case_id INT UNSIGNED NOT NULL,
  author VARCHAR(128) NOT NULL,
  note TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES investigation_cases(id) ON DELETE CASCADE,
  INDEX idx_note_case (case_id)
) ENGINE=InnoDB;

CREATE TABLE investigation_artifacts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  case_id INT UNSIGNED NOT NULL,
  artifact_type ENUM('event', 'alert', 'process', 'hash', 'ip', 'user', 'file') NOT NULL,
  artifact_id VARCHAR(128),
  artifact_data JSON,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES investigation_cases(id) ON DELETE CASCADE,
  INDEX idx_artifact_case (case_id),
  INDEX idx_artifact_type (artifact_type)
) ENGINE=InnoDB;

-- =====================================================
-- PROCESS TREES (cached for visualization)
-- =====================================================
CREATE TABLE process_trees (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  endpoint_id INT UNSIGNED NOT NULL,
  tree_json JSON NOT NULL,
  snapshot_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (endpoint_id) REFERENCES endpoints(id) ON DELETE CASCADE,
  INDEX idx_tree_endpoint (endpoint_id),
  INDEX idx_tree_snapshot (snapshot_at)
) ENGINE=InnoDB;

-- =====================================================
-- TRIAGE REQUESTS AND RESULTS
-- =====================================================
CREATE TABLE triage_requests (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  endpoint_id INT UNSIGNED NOT NULL,
  request_type ENUM('full', 'processes', 'services', 'startup', 'network', 'software', 'users', 'scheduled_tasks') NOT NULL DEFAULT 'full',
  requested_by VARCHAR(128) NOT NULL,
  alert_id BIGINT UNSIGNED,
  case_id INT UNSIGNED,
  status ENUM('pending', 'in_progress', 'completed', 'failed') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (endpoint_id) REFERENCES endpoints(id) ON DELETE CASCADE,
  FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE SET NULL,
  FOREIGN KEY (case_id) REFERENCES investigation_cases(id) ON DELETE SET NULL,
  INDEX idx_triage_endpoint (endpoint_id),
  INDEX idx_triage_status (status),
  INDEX idx_triage_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE triage_results (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  triage_request_id BIGINT UNSIGNED NOT NULL,
  result_json JSON NOT NULL,
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (triage_request_id) REFERENCES triage_requests(id) ON DELETE CASCADE,
  INDEX idx_result_request (triage_request_id)
) ENGINE=InnoDB;

-- =====================================================
-- ENDPOINT RISK SCORES (Phase 3 placeholder)
-- =====================================================
CREATE TABLE endpoint_risk_scores (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  endpoint_id INT UNSIGNED NOT NULL,
  risk_score INT UNSIGNED NOT NULL DEFAULT 0,
  score_factors JSON,
  calculated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (endpoint_id) REFERENCES endpoints(id) ON DELETE CASCADE,
  INDEX idx_risk_endpoint (endpoint_id),
  INDEX idx_risk_calculated (calculated_at)
) ENGINE=InnoDB;

-- =====================================================
-- EVENT TAGS
-- =====================================================
CREATE TABLE event_tags (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id BIGINT UNSIGNED NOT NULL,
  event_type ENUM('raw', 'normalized') NOT NULL DEFAULT 'raw',
  tag VARCHAR(64) NOT NULL,
  tagged_by VARCHAR(128),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tag_event (event_id, event_type),
  INDEX idx_tag_name (tag)
) ENGINE=InnoDB;

-- =====================================================
-- SAVED SEARCHES
-- =====================================================
CREATE TABLE saved_searches (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  query_params JSON NOT NULL,
  created_by VARCHAR(128),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_search_created (created_at)
) ENGINE=InnoDB;

-- =====================================================
-- ADD COLUMNS TO ENDPOINTS
-- =====================================================
ALTER TABLE endpoints ADD COLUMN assigned_policy_id INT UNSIGNED NULL AFTER policy_status;
ALTER TABLE endpoints ADD COLUMN risk_score INT UNSIGNED DEFAULT 0 AFTER assigned_policy_id;
ALTER TABLE endpoints ADD INDEX idx_endpoint_policy (assigned_policy_id);

-- =====================================================
-- ADD COLUMNS TO RESPONSE_ACTIONS (triage link)
-- =====================================================
ALTER TABLE response_actions ADD COLUMN triage_request_id BIGINT UNSIGNED NULL AFTER parameters;
ALTER TABLE response_actions ADD COLUMN alert_id BIGINT UNSIGNED NULL AFTER triage_request_id;
ALTER TABLE response_actions ADD COLUMN case_id INT UNSIGNED NULL AFTER alert_id;

-- =====================================================
-- SAMPLE POLICIES
-- =====================================================
INSERT INTO endpoint_policies (name, mode, description, telemetry_interval_seconds, batch_upload_size, allowed_response_actions, allowed_triage_modules, is_default) VALUES
('Default Workstation', 'workstation_policy', 'Standard workstation monitoring', 30, 100, '["request_heartbeat"]', '["processes", "services", "startup"]', TRUE),
('Server Policy', 'server_policy', 'Server endpoints - reduced telemetry', 60, 200, '["request_heartbeat", "collect_triage"]', '["processes", "services", "network"]', FALSE),
('High Sensitivity', 'high_sensitivity', 'Enhanced detection sensitivity', 15, 50, '["request_heartbeat", "collect_triage", "kill_process"]', '["processes", "services", "startup", "network", "software", "users"]', FALSE),
('Monitor Only', 'monitor_only', 'No response actions allowed', 30, 100, '[]', '["processes"]', FALSE);
