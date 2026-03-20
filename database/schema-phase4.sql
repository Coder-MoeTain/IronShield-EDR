-- =====================================================
-- Open EDR Platform - Phase 4 Schema
-- Correlation, Risk, Anomaly, Threat Hunting
-- =====================================================

USE edr_platform;

-- =====================================================
-- INCIDENTS (correlated from alerts)
-- =====================================================
CREATE TABLE IF NOT EXISTS incidents (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  incident_id VARCHAR(32) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  severity ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'medium',
  status ENUM('open', 'investigating', 'resolved', 'closed') NOT NULL DEFAULT 'open',
  risk_score INT UNSIGNED DEFAULT 0,
  correlation_type VARCHAR(64),
  endpoint_id INT UNSIGNED,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (endpoint_id) REFERENCES endpoints(id) ON DELETE SET NULL,
  INDEX idx_incident_status (status),
  INDEX idx_incident_severity (severity),
  INDEX idx_incident_endpoint (endpoint_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS incident_alert_links (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  incident_id INT UNSIGNED NOT NULL,
  alert_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE,
  FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE,
  UNIQUE KEY uk_incident_alert (incident_id, alert_id)
) ENGINE=InnoDB;

-- =====================================================
-- RISK SCORES (Phase 4 - extends endpoint_risk_scores)
-- =====================================================
CREATE TABLE IF NOT EXISTS risk_score_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_type ENUM('endpoint', 'user', 'process', 'incident') NOT NULL,
  entity_id VARCHAR(128) NOT NULL,
  risk_score INT UNSIGNED NOT NULL DEFAULT 0,
  score_factors JSON,
  calculated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_risk_entity (entity_type, entity_id),
  INDEX idx_risk_calculated (calculated_at)
) ENGINE=InnoDB;

-- =====================================================
-- ANOMALY SCORES
-- =====================================================
CREATE TABLE IF NOT EXISTS anomaly_scores (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_type VARCHAR(64) NOT NULL,
  entity_id VARCHAR(128) NOT NULL,
  anomaly_type VARCHAR(64),
  score DECIMAL(5,2) NOT NULL DEFAULT 0,
  factors JSON,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_anomaly_entity (entity_type, entity_id),
  INDEX idx_anomaly_created (created_at)
) ENGINE=InnoDB;

-- =====================================================
-- HUNT QUERIES & IOC WATCHLIST
-- =====================================================
CREATE TABLE IF NOT EXISTS hunt_queries (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  query_params JSON NOT NULL,
  created_by VARCHAR(128),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_hunt_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS hunt_results (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hunt_id INT UNSIGNED NOT NULL,
  result_data JSON,
  result_count INT UNSIGNED DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hunt_id) REFERENCES hunt_queries(id) ON DELETE CASCADE,
  INDEX idx_hunt_result (hunt_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ioc_watchlist (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ioc_type ENUM('hash', 'ip', 'domain', 'path', 'url') NOT NULL,
  ioc_value VARCHAR(512) NOT NULL,
  description TEXT,
  severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ioc_type (ioc_type),
  INDEX idx_ioc_value (ioc_value(128))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ioc_matches (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ioc_id INT UNSIGNED NOT NULL,
  event_id BIGINT UNSIGNED,
  endpoint_id INT UNSIGNED,
  matched_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ioc_id) REFERENCES ioc_watchlist(id) ON DELETE CASCADE,
  INDEX idx_match_ioc (ioc_id),
  INDEX idx_match_event (event_id)
) ENGINE=InnoDB;
