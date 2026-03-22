-- Add lift_isolation response action (remove firewall containment; clears host isolation in UI after agent success).
-- Run on existing DBs after backup. Adjust database name if needed.

ALTER TABLE response_actions
  MODIFY COLUMN action_type ENUM(
    'kill_process',
    'request_heartbeat',
    'isolate_host',
    'lift_isolation',
    'mark_investigating',
    'collect_triage'
  ) NOT NULL;
