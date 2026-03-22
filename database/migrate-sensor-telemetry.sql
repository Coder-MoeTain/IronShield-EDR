-- Phase 4 — Sensor telemetry columns (Falcon-style: backlog, uptime, containment, health)
-- Prefer: cd server-node && npm run migrate-sensor-telemetry
-- Or run these manually after USE your_database;

ALTER TABLE endpoints ADD COLUMN sensor_queue_depth INT UNSIGNED NULL;
ALTER TABLE endpoints ADD COLUMN sensor_uptime_seconds INT UNSIGNED NULL;
ALTER TABLE endpoints ADD COLUMN host_isolation_active TINYINT(1) NULL;
ALTER TABLE endpoints ADD COLUMN sensor_operational_status VARCHAR(16) NULL;

-- If a column already exists, skip that line or use migrate-sensor-telemetry.js (idempotent).
