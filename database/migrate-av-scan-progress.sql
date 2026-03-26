-- Live AV scan progress (current directory). Run once; ignore error if column already exists.
USE edr_platform;

ALTER TABLE av_scan_tasks
  ADD COLUMN progress_current_path VARCHAR(1024) NULL AFTER files_scanned;
