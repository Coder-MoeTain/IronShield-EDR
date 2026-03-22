-- IronShield parity phases (A/B/C): run against your DB after backup.
-- USE edr_platform;  -- uncomment if needed

-- Normalized events: DNS / registry / image load (Sysmon-style enrichment)
ALTER TABLE normalized_events
  ADD COLUMN dns_query VARCHAR(512) NULL AFTER protocol,
  ADD COLUMN dns_query_type VARCHAR(32) NULL AFTER dns_query,
  ADD COLUMN registry_key VARCHAR(1024) NULL AFTER dns_query_type,
  ADD COLUMN registry_value_name VARCHAR(256) NULL AFTER registry_key,
  ADD COLUMN image_loaded_path VARCHAR(1024) NULL AFTER registry_value_name;

-- Alerts: assignment, SLA, suppression metadata
ALTER TABLE alerts
  ADD COLUMN assigned_team VARCHAR(128) NULL AFTER assigned_to,
  ADD COLUMN due_at DATETIME NULL AFTER assigned_team,
  ADD COLUMN sla_minutes INT UNSIGNED NULL DEFAULT 240 AFTER due_at,
  ADD COLUMN sla_breached_at DATETIME NULL AFTER sla_minutes,
  ADD COLUMN suppressed_by VARCHAR(128) NULL AFTER sla_breached_at,
  ADD COLUMN suppression_reason TEXT NULL AFTER suppressed_by,
  ADD COLUMN suppressed_at DATETIME NULL AFTER suppression_reason;

-- Response actions: EDR quarantine, network block, IOC hash, scripted response
ALTER TABLE response_actions
  MODIFY COLUMN action_type ENUM(
    'kill_process',
    'request_heartbeat',
    'isolate_host',
    'lift_isolation',
    'mark_investigating',
    'collect_triage',
    'quarantine_file',
    'block_ip',
    'block_hash',
    'run_script'
  ) NOT NULL;

-- Saved views (detections / hosts filters)
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

-- Optional: per-tenant API throttle (used when enforced in middleware)
CREATE TABLE IF NOT EXISTS tenant_api_limits (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT UNSIGNED NOT NULL,
  requests_per_minute INT UNSIGNED NOT NULL DEFAULT 300,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tenant_limit (tenant_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB;
