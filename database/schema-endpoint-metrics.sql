-- Endpoint resource metrics (CPU, RAM, disk, network)
-- Run after schema.sql

USE edr_platform;

CREATE TABLE IF NOT EXISTS endpoint_metrics (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  endpoint_id INT UNSIGNED NOT NULL,
  cpu_percent DECIMAL(5,2),
  ram_percent DECIMAL(5,2),
  ram_total_mb INT UNSIGNED,
  ram_used_mb INT UNSIGNED,
  disk_percent DECIMAL(5,2),
  disk_total_gb DECIMAL(10,2),
  disk_used_gb DECIMAL(10,2),
  network_rx_mbps DECIMAL(10,2),
  network_tx_mbps DECIMAL(10,2),
  collected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (endpoint_id) REFERENCES endpoints(id) ON DELETE CASCADE,
  INDEX idx_metrics_endpoint (endpoint_id),
  INDEX idx_metrics_collected (collected_at)
) ENGINE=InnoDB;

ALTER TABLE endpoints ADD COLUMN IF NOT EXISTS cpu_percent DECIMAL(5,2) NULL;
ALTER TABLE endpoints ADD COLUMN IF NOT EXISTS ram_percent DECIMAL(5,2) NULL;
ALTER TABLE endpoints ADD COLUMN IF NOT EXISTS disk_percent DECIMAL(5,2) NULL;
