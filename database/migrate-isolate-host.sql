-- Rename simulate_isolation -> isolate_host (host isolation policy; not a simulation).
-- Run after backups. Database name may differ (e.g. open_edr); set USE accordingly.

-- Step 1: allow both enum labels during migration
ALTER TABLE response_actions
  MODIFY COLUMN action_type ENUM(
    'kill_process',
    'request_heartbeat',
    'simulate_isolation',
    'isolate_host',
    'mark_investigating',
    'collect_triage'
  ) NOT NULL;

-- Step 2: migrate historical rows
UPDATE response_actions SET action_type = 'isolate_host' WHERE action_type = 'simulate_isolation';

-- Step 3: drop legacy label
ALTER TABLE response_actions
  MODIFY COLUMN action_type ENUM(
    'kill_process',
    'request_heartbeat',
    'isolate_host',
    'mark_investigating',
    'collect_triage'
  ) NOT NULL;
