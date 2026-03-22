-- Phase 8 — EDR sensor policy sync on endpoints
-- Prefer: cd server-node && npm run migrate-phase8-edr-policy-sync

ALTER TABLE endpoints ADD COLUMN edr_policy_id INT UNSIGNED NULL;
ALTER TABLE endpoints ADD COLUMN last_edr_policy_sync_at DATETIME NULL;
