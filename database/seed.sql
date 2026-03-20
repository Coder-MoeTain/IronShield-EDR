-- =====================================================
-- Open EDR Platform - Seed Data
-- =====================================================

USE edr_platform;

-- Default admin user is created by server-node/scripts/seed-admin.js
-- Run: cd server-node && npm run seed-admin
-- Default: admin / ChangeMe123! (CHANGE IMMEDIATELY)

-- Sample detection rules (Phase 2)
INSERT INTO detection_rules (name, title, description, enabled, severity, conditions, mitre_tactic, mitre_technique) VALUES
('powershell_encoded_command', 'PowerShell Encoded Command Detected', 'Detects PowerShell execution with Base64 encoded command indicators', TRUE, 'high', '{"event_type": "process_create", "process_name": "powershell.exe", "encoded_command": true}', 'T1059.001', 'Command and Scripting Interpreter: PowerShell'),
('office_spawned_shell', 'Office Application Spawned Shell', 'Microsoft Office application spawned command shell or PowerShell', TRUE, 'high', '{"event_type": "process_create", "parent_process": ["WINWORD.EXE", "EXCEL.EXE", "POWERPNT.EXE"], "child_process": ["cmd.exe", "powershell.exe"]}', 'T1566.001', 'Phishing: Spearphishing Attachment'),
('suspicious_rundll32', 'Suspicious Rundll32 Execution', 'Rundll32.exe executing with unusual parameters', TRUE, 'medium', '{"event_type": "process_create", "process_name": "rundll32.exe", "suspicious_params": true}', 'T1218.011', 'System Binary Proxy Execution: Rundll32'),
('execution_from_temp', 'Execution from Temp Directory', 'Executable launched from user temp or download directory', TRUE, 'medium', '{"event_type": "process_create", "path_contains": ["\\Temp\\", "\\Downloads\\", "\\AppData\\Local\\Temp\\"]}', 'T1204', 'User Execution: Malicious Link'),
('suspicious_service_creation', 'Suspicious Service Creation', 'Service created from unusual parent process', TRUE, 'high', '{"event_type": "service_create", "unusual_parent": true}', 'T1543.003', 'Create or Modify System Process: Windows Service'),
('repeated_failed_logons', 'Repeated Failed Logons', 'Multiple failed logon attempts followed by success', TRUE, 'medium', '{"event_type": "logon", "failed_count": ">=5", "success_after_failures": true}', 'T1110', 'Brute Force'),
('unsigned_binary_user_profile', 'Unsigned Executable from User Profile', 'Unsigned executable launched from user profile path', TRUE, 'medium', '{"event_type": "process_create", "path_contains": ["\\Users\\"], "signed": false}', 'T1204', 'User Execution: Malicious Link'),
('suspicious_script_host', 'Suspicious Script Host Activity', 'Wscript or Cscript executing with suspicious parameters', TRUE, 'medium', '{"event_type": "process_create", "process_name": ["wscript.exe", "cscript.exe"], "suspicious_params": true}', 'T1059.007', 'Command and Scripting Interpreter: JavaScript/JScript');
