-- Phase 7 — NGAV telemetry on av_update_status (realtime + prevention health)
-- Requires: database/schema-antivirus.sql (av_update_status table)
-- Prefer: cd server-node && npm run migrate-phase7-ngav-telemetry

ALTER TABLE av_update_status ADD COLUMN realtime_enabled TINYINT(1) NULL;
ALTER TABLE av_update_status ADD COLUMN prevention_status VARCHAR(24) NULL;
ALTER TABLE av_update_status ADD COLUMN signature_count INT UNSIGNED NULL;
