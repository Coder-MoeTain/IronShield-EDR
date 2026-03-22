-- Falcon UI pack: RTR session history (self-hosted; not CrowdStrike cloud)
-- Apply: cd server-node && npm run migrate-falcon-ui-pack

CREATE TABLE IF NOT EXISTS rtr_sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  endpoint_id INT UNSIGNED NOT NULL,
  created_by VARCHAR(128),
  status ENUM('active','closed') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at DATETIME NULL,
  INDEX idx_rtr_sessions_ep (endpoint_id),
  INDEX idx_rtr_sessions_status (status),
  FOREIGN KEY (endpoint_id) REFERENCES endpoints(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rtr_session_commands (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id BIGINT UNSIGNED NOT NULL,
  command_text VARCHAR(512) NOT NULL,
  status ENUM('pending','completed','failed','rejected') NOT NULL DEFAULT 'pending',
  stdout TEXT,
  stderr TEXT,
  exit_code INT NULL,
  response_action_id BIGINT UNSIGNED NULL,
  error_message VARCHAR(512) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  INDEX idx_rtr_cmd_session (session_id),
  FOREIGN KEY (session_id) REFERENCES rtr_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB;
