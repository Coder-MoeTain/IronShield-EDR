-- Phase 6 — Agent update telemetry on endpoints (pending sensor update visibility)
-- Prefer: cd server-node && npm run migrate-phase6-agent-update-telemetry

ALTER TABLE endpoints ADD COLUMN agent_update_status VARCHAR(24) NULL;
ALTER TABLE endpoints ADD COLUMN available_agent_version VARCHAR(32) NULL;
ALTER TABLE endpoints ADD COLUMN last_agent_update_check_at DATETIME NULL;
