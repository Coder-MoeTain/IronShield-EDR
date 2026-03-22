/**
 * Seed detection rules
 * Run: npm run seed-rules
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'edr_user',
  password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : 'edr_password',
  database: process.env.DB_NAME || 'edr_platform',
};

const rules = [
  { name: 'powershell_encoded_command', title: 'PowerShell Encoded Command Detected', description: 'Detects PowerShell execution with Base64 encoded command indicators', severity: 'high', conditions: { event_type: 'process_create', process_name: 'powershell.exe', encoded_command: true }, mitre_tactic: 'T1059.001', mitre_technique: 'Command and Scripting Interpreter: PowerShell' },
  { name: 'office_spawned_shell', title: 'Office Application Spawned Shell', description: 'Microsoft Office application spawned command shell or PowerShell', severity: 'high', conditions: { event_type: 'process_create', parent_process: ['WINWORD.EXE', 'EXCEL.EXE', 'POWERPNT.EXE'], child_process: ['cmd.exe', 'powershell.exe'] }, mitre_tactic: 'T1566.001', mitre_technique: 'Phishing: Spearphishing Attachment' },
  { name: 'suspicious_rundll32', title: 'Suspicious Rundll32 Execution', description: 'Rundll32.exe executing with unusual parameters', severity: 'medium', conditions: { event_type: 'process_create', process_name: 'rundll32.exe', suspicious_params: true }, mitre_tactic: 'T1218.011', mitre_technique: 'System Binary Proxy Execution: Rundll32' },
  { name: 'execution_from_temp', title: 'Execution from Temp Directory', description: 'Executable launched from user temp or download directory', severity: 'medium', conditions: { event_type: 'process_create', path_contains: ['Temp', 'Downloads', 'AppData'] }, mitre_tactic: 'T1204', mitre_technique: 'User Execution: Malicious Link' },
  { name: 'suspicious_service_creation', title: 'Suspicious Service Creation', description: 'Service created from unusual parent process', severity: 'high', conditions: { event_type: 'service_create', unusual_parent: true }, mitre_tactic: 'T1543.003', mitre_technique: 'Create or Modify System Process: Windows Service' },
  { name: 'repeated_failed_logons', title: 'Repeated Failed Logons', description: 'Multiple failed logon attempts followed by success', severity: 'medium', conditions: { event_type: 'logon', failed_count: '>=5' }, mitre_tactic: 'T1110', mitre_technique: 'Brute Force' },
  { name: 'unsigned_binary_user_profile', title: 'Unsigned Executable from User Profile', description: 'Unsigned executable launched from user profile path', severity: 'medium', conditions: { event_type: 'process_create', path_contains: ['Users'], signed: false }, mitre_tactic: 'T1204', mitre_technique: 'User Execution: Malicious Link' },
  { name: 'suspicious_script_host', title: 'Suspicious Script Host Activity', description: 'Wscript or Cscript executing with suspicious parameters', severity: 'medium', conditions: { event_type: 'process_create', process_name: ['wscript.exe', 'cscript.exe'], suspicious_params: true }, mitre_tactic: 'T1059.007', mitre_technique: 'Command and Scripting Interpreter: JavaScript/JScript' },
  { name: 'suspicious_regsvr32', title: 'Suspicious Regsvr32 Execution', description: 'Regsvr32.exe with unusual parameters', severity: 'medium', conditions: { event_type: 'process_create', process_name: 'regsvr32.exe', suspicious_params: true }, mitre_tactic: 'T1218.010', mitre_technique: 'System Binary Proxy Execution: Regsvr32' },
  { name: 'suspicious_mshta', title: 'Suspicious Mshta Execution', description: 'Mshta.exe executing script content', severity: 'medium', conditions: { event_type: 'process_create', process_name: 'mshta.exe' }, mitre_tactic: 'T1218.005', mitre_technique: 'System Binary Proxy Execution: Mshta' },
  { name: 'dns_long_query_tunneling', title: 'Long DNS query (possible tunneling)', description: 'DNS query string unusually long — may indicate DNS tunneling (requires Sysmon 22 / DNS telemetry)', severity: 'medium', conditions: { dns_query_length_gt: 50 }, mitre_tactic: 'T1071.004', mitre_technique: 'Application Layer Protocol: DNS' },
];

async function main() {
  const conn = await mysql.createConnection(config);
  for (const r of rules) {
    await conn.execute(
      `INSERT INTO detection_rules (name, title, description, enabled, severity, conditions, mitre_tactic, mitre_technique)
       VALUES (?, ?, ?, TRUE, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), severity = VALUES(severity), conditions = VALUES(conditions)`,
      [r.name, r.title, r.description, r.severity, JSON.stringify(r.conditions), r.mitre_tactic, r.mitre_technique]
    );
  }
  console.log(`Seeded ${rules.length} detection rules`);
  await conn.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
