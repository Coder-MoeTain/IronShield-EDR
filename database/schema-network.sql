-- =====================================================
-- Network connections - for network activity tracking
-- Run against your DB: mysql -u ... your_db < database/schema-network.sql
-- =====================================================

CREATE TABLE IF NOT EXISTS network_connections (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  endpoint_id INT UNSIGNED NOT NULL,
  local_address VARCHAR(45),
  local_port INT UNSIGNED,
  remote_address VARCHAR(45) NOT NULL,
  remote_port INT UNSIGNED NOT NULL,
  protocol VARCHAR(16) DEFAULT 'TCP',
  state VARCHAR(32),
  process_id INT UNSIGNED,
  process_name VARCHAR(512),
  process_path VARCHAR(1024),
  first_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (endpoint_id) REFERENCES endpoints(id) ON DELETE CASCADE,
  INDEX idx_net_endpoint (endpoint_id),
  INDEX idx_net_remote (remote_address),
  INDEX idx_net_last_seen (last_seen)
) ENGINE=InnoDB;
