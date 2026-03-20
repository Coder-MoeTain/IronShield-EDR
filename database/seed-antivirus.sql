-- =====================================================
-- Open EDR - Antivirus Sample Data
-- Run after schema-antivirus.sql
-- =====================================================

USE edr_platform;

-- Sample signatures (EICAR test file + example patterns)
INSERT IGNORE INTO av_signatures (signature_uuid, name, signature_type, hash_value, hash_type, family, severity, description, enabled, version)
VALUES
  ('eicar-test-001', 'EICAR-Test-File', 'hash', '275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f', 'sha256', 'Test', 'low', 'EICAR standard antivirus test file', 1, 1),
  ('eicar-test-002', 'EICAR-Test-File-Alt', 'hash', '44d88612fea8a8f36de82e1278abb02f', 'md5', 'Test', 'low', 'EICAR test file MD5', 1, 1),
  ('pattern-mz-header', 'Suspicious.MZ.Header', 'pattern', NULL, 'sha256', 'Generic', 'medium', 'PE file with suspicious header pattern', 1, 1);

-- Update pattern for the binary signature (MZ header - 4D 5A)
UPDATE av_signatures SET pattern = '4D5A' WHERE signature_uuid = 'pattern-mz-header';

-- Default scan policy
INSERT IGNORE INTO av_scan_policies (name, description, realtime_enabled, scheduled_enabled, execute_scan_enabled, quarantine_threshold, alert_threshold, max_file_size_mb, process_kill_allowed, rescan_on_detection, include_paths_json, exclude_paths_json, exclude_extensions_json, exclude_hashes_json)
VALUES
  ('Default', 'Default antivirus scan policy', 0, 1, 1, 70, 50, 100, 0, 1,
   '["C:\\\\Users\\\\*\\\\AppData\\\\Local\\\\Temp","C:\\\\Users\\\\*\\\\Downloads","C:\\\\Users\\\\*\\\\AppData\\\\Roaming\\\\Microsoft\\\\Windows\\\\Start Menu\\\\Programs\\\\Startup","C:\\\\ProgramData\\\\Microsoft\\\\Windows\\\\Start Menu\\\\Programs\\\\Startup","C:\\\\Windows\\\\Temp"]',
   '["C:\\\\Windows\\\\WinSxS","C:\\\\Windows\\\\Temp\\\\*"]',
   '[".log",".tmp",".cache",".db"]',
   '[]');

-- Create initial signature bundle
INSERT IGNORE INTO av_signature_bundles (bundle_version, checksum_sha256, release_notes, signature_count, is_active)
VALUES ('v1', NULL, 'Initial bundle', 3, 1);

-- Deactivate other bundles, activate v1
UPDATE av_signature_bundles SET is_active = 0 WHERE bundle_version != 'v1';
UPDATE av_signature_bundles SET is_active = 1 WHERE bundle_version = 'v1';

-- Link signatures to bundle
INSERT IGNORE INTO av_bundle_signatures (bundle_id, signature_id)
SELECT b.id, s.id FROM av_signature_bundles b, av_signatures s
WHERE b.bundle_version = 'v1' AND s.enabled = 1;
