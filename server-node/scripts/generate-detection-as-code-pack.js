#!/usr/bin/env node
/**
 * Generates IRN-WIN detection-as-code JSON files (defensive patterns only).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../detections/windows');

const RULES = [
  ['persistence', 'IRN-WIN-0020', 'Run Key Persistence', 'high', 65, 'Persistence', 'T1547.001', 'process_create', 'reg.exe', 'add'],
  ['persistence', 'IRN-WIN-0021', 'Scheduled Task Creation', 'medium', 55, 'Persistence', 'T1053.005', 'process_create', 'schtasks.exe', 'create'],
  ['privilege_escalation', 'IRN-WIN-0030', 'UAC Bypass via Fodhelper', 'high', 70, 'Privilege Escalation', 'T1548.002', 'process_create', 'fodhelper.exe', null],
  ['privilege_escalation', 'IRN-WIN-0031', 'Runas Elevated Execution', 'medium', 50, 'Privilege Escalation', 'T1134', 'process_create', 'runas.exe', null],
  ['defense_evasion', 'IRN-WIN-0040', 'Disable Windows Defender', 'critical', 85, 'Defense Evasion', 'T1562.001', 'process_create', 'powershell.exe', 'DisableRealtimeMonitoring'],
  ['defense_evasion', 'IRN-WIN-0041', 'Clear Security Event Log', 'high', 75, 'Defense Evasion', 'T1070.001', 'process_create', 'wevtutil.exe', 'cl'],
  ['defense_evasion', 'IRN-WIN-0042', 'Suspicious WMIC Process', 'medium', 55, 'Defense Evasion', 'T1047', 'process_create', 'wmic.exe', 'process'],
  ['credential_access', 'IRN-WIN-0050', 'LSASS Memory Access Tool', 'critical', 90, 'Credential Access', 'T1003.001', 'process_create', 'procdump.exe', 'lsass'],
  ['credential_access', 'IRN-WIN-0051', 'Mimikatz Name Indicator', 'critical', 95, 'Credential Access', 'T1003', 'process_create', 'mimikatz', null],
  ['discovery', 'IRN-WIN-0060', 'Network Discovery via nltest', 'medium', 45, 'Discovery', 'T1018', 'process_create', 'nltest.exe', null],
  ['discovery', 'IRN-WIN-0061', 'AD Recon with dsquery', 'medium', 50, 'Discovery', 'T1087.002', 'process_create', 'dsquery.exe', null],
  ['discovery', 'IRN-WIN-0062', 'Port Scan with Test-NetConnection', 'low', 40, 'Discovery', 'T1046', 'process_create', 'powershell.exe', 'Test-NetConnection'],
  ['lateral_movement', 'IRN-WIN-0070', 'Remote Service via PsExec', 'high', 75, 'Lateral Movement', 'T1021.002', 'process_create', 'psexec.exe', null],
  ['lateral_movement', 'IRN-WIN-0071', 'WMI Remote Process', 'high', 70, 'Lateral Movement', 'T1021.003', 'process_create', 'wmic.exe', '/node:'],
  ['collection', 'IRN-WIN-0080', 'Archive Sensitive Data', 'medium', 55, 'Collection', 'T1560.001', 'process_create', 'rar.exe', 'a '],
  ['collection', 'IRN-WIN-0081', '7zip Archive Creation', 'low', 40, 'Collection', 'T1560', 'process_create', '7z.exe', null],
  ['command_and_control', 'IRN-WIN-0090', 'Suspicious Bitsadmin Download', 'high', 70, 'Command and Control', 'T1197', 'process_create', 'bitsadmin.exe', 'transfer'],
  ['command_and_control', 'IRN-WIN-0091', 'Curl Download to Temp', 'medium', 55, 'Command and Control', 'T1105', 'process_create', 'curl.exe', 'http'],
  ['execution', 'IRN-WIN-0011', 'Mshta Script Execution', 'high', 72, 'Execution', 'T1218.005', 'process_create', 'mshta.exe', 'http'],
  ['execution', 'IRN-WIN-0012', 'Regsvr32 Squiblydoo', 'high', 78, 'Execution', 'T1218.010', 'process_create', 'regsvr32.exe', 'scrobj'],
  ['execution', 'IRN-WIN-0013', 'Rundll32 No DLL', 'medium', 58, 'Execution', 'T1218.011', 'process_create', 'rundll32.exe', null],
  ['execution', 'IRN-WIN-0014', 'Wscript Script Host', 'medium', 52, 'Execution', 'T1059.005', 'process_create', 'wscript.exe', null],
  ['execution', 'IRN-WIN-0015', 'Cscript Script Host', 'medium', 52, 'Execution', 'T1059.005', 'process_create', 'cscript.exe', null],
  ['initial_access', 'IRN-WIN-0100', 'Office Spawning PowerShell', 'high', 80, 'Initial Access', 'T1566.001', 'process_create', 'powershell.exe', null, 'winword.exe'],
  ['impact', 'IRN-WIN-0110', 'Vssadmin Delete Shadows', 'critical', 90, 'Impact', 'T1490', 'process_create', 'vssadmin.exe', 'delete shadows'],
  ['impact', 'IRN-WIN-0111', 'Bcdedit Recovery Disabled', 'critical', 88, 'Impact', 'T1490', 'process_create', 'bcdedit.exe', 'recoveryenabled'],
  ['defense_evasion', 'IRN-WIN-0043', 'Certutil Decode File', 'high', 68, 'Defense Evasion', 'T1140', 'process_create', 'certutil.exe', '-decode'],
  ['execution', 'IRN-WIN-0016', 'Cmd from Script Interpreter', 'medium', 50, 'Execution', 'T1059.003', 'process_create', 'cmd.exe', '/c'],
  // Execution — LOLBin / script from temp
  ['execution', 'IRN-WIN-0017', 'PowerShell from User Temp Path', 'high', 72, 'Execution', 'T1059.001', 'process_create', 'powershell.exe', '\\temp\\'],
  ['execution', 'IRN-WIN-0018', 'Cmd from Temp Directory', 'medium', 58, 'Execution', 'T1059.003', 'process_create', 'cmd.exe', '\\temp\\'],
  ['execution', 'IRN-WIN-0019', 'Forfiles LOLBin Execution', 'medium', 55, 'Execution', 'T1202', 'process_create', 'forfiles.exe', null],
  ['execution', 'IRN-WIN-0022', 'Regsvcs LOLBin', 'medium', 54, 'Execution', 'T1218', 'process_create', 'regsvcs.exe', null],
  // Persistence
  ['persistence', 'IRN-WIN-0023', 'New Service via SC', 'high', 68, 'Persistence', 'T1543.003', 'process_create', 'sc.exe', 'create'],
  ['persistence', 'IRN-WIN-0024', 'PowerShell New-Service', 'high', 70, 'Persistence', 'T1543.003', 'process_create', 'powershell.exe', 'New-Service'],
  // Defense evasion
  ['defense_evasion', 'IRN-WIN-0044', 'Tamper with Defender via Set-MpPreference', 'critical', 88, 'Defense Evasion', 'T1562.001', 'process_create', 'powershell.exe', 'Set-MpPreference'],
  ['defense_evasion', 'IRN-WIN-0045', 'Attrib Hide File', 'low', 35, 'Defense Evasion', 'T1564.001', 'process_create', 'attrib.exe', '+h'],
  // Discovery (spec section 8)
  ['discovery', 'IRN-WIN-0063', 'Whoami Full Output', 'low', 35, 'Discovery', 'T1033', 'process_create', 'whoami.exe', '/all'],
  ['discovery', 'IRN-WIN-0064', 'Net User Enumeration', 'medium', 48, 'Discovery', 'T1087.001', 'process_create', 'net.exe', ' user'],
  ['discovery', 'IRN-WIN-0065', 'Net Group Enumeration', 'medium', 48, 'Discovery', 'T1069.001', 'process_create', 'net.exe', ' group'],
  ['discovery', 'IRN-WIN-0066', 'Ipconfig All Adapters', 'low', 32, 'Discovery', 'T1016', 'process_create', 'ipconfig.exe', '/all'],
  ['discovery', 'IRN-WIN-0067', 'Systeminfo Recon', 'low', 38, 'Discovery', 'T1082', 'process_create', 'systeminfo.exe', null],
  ['discovery', 'IRN-WIN-0068', 'Tasklist Process Survey', 'low', 30, 'Discovery', 'T1057', 'process_create', 'tasklist.exe', null],
  ['discovery', 'IRN-WIN-0069', 'Quser Session Discovery', 'low', 40, 'Discovery', 'T1033', 'process_create', 'quser.exe', null],
  ['discovery', 'IRN-WIN-0072', 'Net View Share Discovery', 'medium', 45, 'Discovery', 'T1135', 'process_create', 'net.exe', ' view'],
  // Command and control
  ['command_and_control', 'IRN-WIN-0092', 'Wget External Download', 'medium', 52, 'Command and Control', 'T1105', 'process_create', 'wget.exe', 'http'],
  ['command_and_control', 'IRN-WIN-0093', 'PowerShell Download Cradle', 'high', 74, 'Command and Control', 'T1105', 'process_create', 'powershell.exe', 'DownloadString'],
  ['command_and_control', 'IRN-WIN-0094', 'Invoke-WebRequest Download', 'high', 72, 'Command and Control', 'T1105', 'process_create', 'powershell.exe', 'Invoke-WebRequest'],
  // Impact
  ['impact', 'IRN-WIN-0112', 'Wmic Shadow Copy Delete', 'critical', 92, 'Impact', 'T1490', 'process_create', 'wmic.exe', 'shadowcopy delete'],
  ['impact', 'IRN-WIN-0113', 'Cipher Secure Delete', 'medium', 55, 'Impact', 'T1485', 'process_create', 'cipher.exe', '/w:'],
];

function buildRule([folder, id, name, severity, risk, tactic, tech, eventType, proc, cmdExtra, parent]) {
  const logicAll = [
    { field: 'process_name', op: 'contains', value: proc },
  ];
  if (cmdExtra) {
    logicAll.push({ field: 'command_line', op: 'contains', value: cmdExtra });
  }
  if (parent) {
    logicAll.push({ field: 'parent_process_name', op: 'contains', value: parent });
  }
  return {
    id,
    name,
    description: `${name} (defensive detection).`,
    status: 'stable',
    severity,
    risk_score: risk,
    platform: 'windows',
    event_types: [eventType],
    mitre: { tactics: [tactic], techniques: [tech] },
    logic: { all: logicAll },
    author: 'IronShield',
    version: '1.0.0',
  };
}

let written = 0;
for (const def of RULES) {
  const rule = buildRule(def);
  const dir = path.join(ROOT, def[0]);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${rule.id}-${rule.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.json`);
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, `${JSON.stringify(rule, null, 2)}\n`, 'utf8');
    written += 1;
  }
}
console.log(`Detection pack: ${written} new rule file(s) under ${ROOT}`);
