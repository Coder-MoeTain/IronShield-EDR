/**
 * 100 SOC-style IOA rules for DetectionEngineService (conditions ANDed).
 * Keys must match ALLOWED_CONDITION_KEYS in DetectionRuleService / DetectionEngineService.
 *
 * enabled: 1 = on by default (tighter multi-field rules); 0 = template (enable after tuning).
 */
function buildDetectionRulesPack100() {
  const rules = [];

  const add = (name, title, description, enabled, severity, conditions, tactic, tech) => {
    rules.push({
      name,
      title,
      description,
      enabled: enabled ? 1 : 0,
      severity,
      conditions,
      mitre_tactic: tactic || null,
      mitre_technique: tech || null,
    });
  };

  // --- 1–15: Encoded / scripted execution (higher signal when enabled) ---
  add(
    'ioa_ps_encoded_command',
    'PowerShell with encoded command',
    'powershell.exe with -enc / Base64-style patterns in command line.',
    1,
    'critical',
    { event_type: 'process_create', process_name: 'powershell.exe', encoded_command: true },
    'Execution',
    'T1059.001'
  );
  add(
    'ioa_pwsh_encoded_command',
    'PowerShell 7 (pwsh) encoded payload',
    'pwsh with encoded command indicators.',
    1,
    'high',
    { event_type: 'process_create', process_name: 'pwsh.exe', encoded_command: true },
    'Execution',
    'T1059.001'
  );
  add(
    'ioa_cmd_powershell_encoded',
    'cmd spawning PowerShell-style encoding',
    'cmd.exe with long encoded-looking command (suspicious_params heuristic may apply to other tools).',
    0,
    'medium',
    { event_type: 'process_create', process_name: 'cmd.exe', path_contains: ['\\Temp\\'] },
    'Execution',
    'T1059.003'
  );
  add(
    'ioa_wscript_encoded_long',
    'wscript with suspicious long command',
    'wscript.exe with suspicious_params length heuristic.',
    0,
    'high',
    { event_type: 'process_create', process_name: 'wscript.exe', suspicious_params: true },
    'Execution',
    'T1059.005'
  );
  add(
    'ioa_cscript_encoded_long',
    'cscript with suspicious long command',
    'cscript.exe suspicious_params.',
    0,
    'high',
    { event_type: 'process_create', process_name: 'cscript.exe', suspicious_params: true },
    'Execution',
    'T1059.005'
  );
  add(
    'ioa_mshta_suspicious',
    'mshta with suspicious invocation',
    'mshta.exe suspicious_params.',
    1,
    'high',
    { event_type: 'process_create', process_name: 'mshta.exe', suspicious_params: true },
    'Execution',
    'T1218.005'
  );
  add(
    'ioa_rundll32_suspicious',
    'rundll32 with suspicious long command line',
    'rundll32 suspicious_params.',
    1,
    'high',
    { event_type: 'process_create', process_name: 'rundll32.exe', suspicious_params: true },
    'Execution',
    'T1218.011'
  );
  add(
    'ioa_regsvr32_suspicious',
    'regsvr32 suspicious invocation',
    'regsvr32 suspicious_params.',
    1,
    'high',
    { event_type: 'process_create', process_name: 'regsvr32.exe', suspicious_params: true },
    'Execution',
    'T1218.010'
  );

  // --- 16–35: LOLBins from suspicious paths (pairs) ---
  const lolbins = [
    ['powershell.exe', 'T1059.001'],
    ['pwsh.exe', 'T1059.001'],
    ['cmd.exe', 'T1059.003'],
    ['wscript.exe', 'T1059.005'],
    ['cscript.exe', 'T1059.005'],
    ['mshta.exe', 'T1218.005'],
    ['rundll32.exe', 'T1218.011'],
    ['regsvr32.exe', 'T1218.010'],
    ['bitsadmin.exe', 'T1197'],
    ['certutil.exe', 'T1105'],
  ];
  const susPaths = ['\\Temp\\', '\\Windows\\Temp', '\\AppData\\Local\\Temp', '\\Users\\Public\\', '\\ProgramData\\'];
  let n = 0;
  outerLolbin: for (const [proc, tech] of lolbins) {
    for (const p of susPaths) {
      if (rules.length >= 35) break outerLolbin;
      n += 1;
      add(
        `ioa_lolbin_path_${String(n).padStart(2, '0')}`,
        `${proc} from non-standard path`,
        `Process ${proc} with path containing ${p}`,
        proc.includes('powershell') || proc.includes('rundll32') ? 1 : 0,
        proc.includes('certutil') || proc.includes('bitsadmin') ? 'high' : 'medium',
        { event_type: 'process_create', process_name: proc, path_contains: [p] },
        'Execution',
        tech
      );
    }
  }

  // Pad to 35 if short (lolbin block must end at exactly 35 entries: 8 starter + 27 pairs)
  while (rules.length < 35) {
    const i = rules.length + 1;
    add(
      `ioa_proc_path_pad_${String(i).padStart(2, '0')}`,
      'Process from temp path (generic)',
      'cmd.exe from Temp.',
      0,
      'low',
      { event_type: 'process_create', process_name: 'cmd.exe', path_contains: ['\\Temp\\'] },
      'Execution',
      'T1059.003'
    );
  }

  // --- 36–50: Parent / child chains ---
  const chains = [
    [['EXPLORER.EXE'], ['powershell.exe'], 'User desktop spawning PowerShell'],
    [['EXPLORER.EXE'], ['cmd.exe'], 'Explorer spawning cmd'],
    [['WINWORD.EXE'], ['powershell.exe'], 'Office spawning PowerShell'],
    [['EXCEL.EXE'], ['cmd.exe'], 'Excel spawning cmd'],
    [['OUTLOOK.EXE'], ['powershell.exe'], 'Outlook spawning PowerShell'],
    [['SVCHOST.EXE'], ['powershell.exe'], 'Uncommon svchost child PowerShell'],
    [['SERVICES.EXE'], ['cmd.exe'], 'Service control spawning cmd'],
    [['W3WP.EXE'], ['cmd.exe'], 'IIS worker spawning cmd'],
    [['MICROSOFTEDGE.EXE'], ['powershell.exe'], 'Browser spawning PowerShell'],
    [['CHROME.EXE'], ['powershell.exe'], 'Chrome spawning PowerShell'],
  ];
  for (let j = 0; j < chains.length; j++) {
    const [parents, children, desc] = chains[j];
    add(
      `ioa_parent_child_${String(j + 1).padStart(2, '0')}`,
      desc,
      'Parent/child process chain (defender-style).',
      j < 4 ? 1 : 0,
      j < 4 ? 'high' : 'medium',
      { parent_process: parents, child_process: children },
      'Execution',
      'T1059'
    );
  }

  // --- 51–65: DNS ---
  const dnsPatterns = [
    '.onion',
    'pastebin.com',
    'discord.com',
    'telegram',
    'ngrok',
    'serveo',
    'dyn-dns',
    'no-ip',
    'duckdns',
    'bit.ly',
    'tinyurl',
    'raw.githubusercontent.com',
    'dl.dropbox',
    'mega.nz',
    'drive.google.com',
  ];
  for (let d = 0; d < dnsPatterns.length; d++) {
    add(
      `ioa_dns_sus_${String(d + 1).padStart(2, '0')}`,
      `DNS query contains ${dnsPatterns[d]}`,
      'Potential C2 or staging domain indicator.',
      0,
      'medium',
      { dns_query_contains: dnsPatterns[d] },
      'Command and Control',
      'T1071.001'
    );
  }

  // --- 66–80: Registry persistence ---
  const regKeys = [
    'Run\\',
    'RunOnce\\',
    'Winlogon',
    'UserInit',
    'Image File Execution Options',
    'CurrentVersion\\Run',
    'Policies\\Explorer\\Run',
    'Windows\\CurrentVersion\\Explorer\\StartupApproved',
    'Services\\',
    'Winlogon\\Shell',
    'Winlogon\\Userinit',
    'AppInit_DLLs',
    'Security Center',
    'Windows Defender',
    'SafeBoot',
  ];
  for (let g = 0; g < regKeys.length; g++) {
    add(
      `ioa_reg_${String(g + 1).padStart(2, '0')}`,
      `Registry activity: ${regKeys[g]}`,
      'Registry key contains persistence-related path.',
      0,
      'medium',
      { registry_key_contains: regKeys[g] },
      'Persistence',
      'T1547.001'
    );
  }

  // --- 81–92: Image load ---
  const images = [
    '\\Temp\\',
    '\\Users\\',
    '\\AppData\\',
    '.dll',
    'comsvcs.dll',
    'dbghelp.dll',
    'mstsc.exe',
    'cryptbase.dll',
    'samlib.dll',
    'vaultcli.dll',
    'netapi32.dll',
    'urlmon.dll',
    'scrobj.dll',
  ];
  for (let im = 0; im < images.length; im++) {
    add(
      `ioa_img_${String(im + 1).padStart(2, '0')}`,
      `Image load contains ${images[im]}`,
      'Suspicious image load path.',
      0,
      'low',
      { image_loaded_contains: [images[im]] },
      'Defense Evasion',
      'T1574.002'
    );
  }

  // --- 93–96: DNS length / entropy / agent scoring ---
  add(
    'ioa_dns_query_very_long',
    'Unusually long DNS query',
    'Possible DNS tunneling (length heuristic).',
    0,
    'medium',
    { dns_query_length_gt: 40 },
    'Command and Control',
    'T1071.004'
  );
  add(
    'ioa_cmdline_high_entropy',
    'High command-line entropy',
    'Agent-reported entropy above threshold (obfuscation).',
    0,
    'medium',
    { event_type: 'process_create', process_name: 'powershell.exe', command_line_entropy_gt: 4.2 },
    'Defense Evasion',
    'T1027'
  );
  add(
    'ioa_suspicious_score_high',
    'Elevated suspicious indicator count',
    'Process collector scored multiple suspicious indicators.',
    0,
    'high',
    { event_type: 'process_create', suspicious_indicator_count_gte: 2 },
    'Execution',
    'T1059'
  );
  add(
    'ioa_low_collector_confidence',
    'Low collector confidence score',
    'Telemetry confidence below threshold — review context.',
    0,
    'low',
    { event_type: 'process_create', collector_confidence_lt: 0.5 },
    'Collection',
    'T1005'
  );

  // --- 97–100: Service / unsigned / unusual parent ---
  add(
    'ioa_unusual_service_parent',
    'Unusual parent for service-related event',
    'Service event with unexpected parent (engine heuristic).',
    0,
    'medium',
    { event_type: 'service_create', unusual_parent: true },
    'Persistence',
    'T1543.003'
  );
  add(
    'ioa_unsigned_from_user_profile',
    'Unsigned binary from user profile path',
    'No file hash and path under Users (signed=false heuristic).',
    0,
    'medium',
    { event_type: 'process_create', signed: false, path_contains: ['\\Users\\'] },
    'Defense Evasion',
    'T1036'
  );
  add(
    'ioa_schtasks_temp',
    'schtasks.exe from temp-related path',
    'Scheduled task binary from suspicious location.',
    0,
    'high',
    { event_type: 'process_create', process_name: 'schtasks.exe', path_contains: ['\\Temp\\'] },
    'Execution',
    'T1053.005'
  );
  add(
    'ioa_wmic_process_create',
    'WMIC process create pattern',
    'wmic.exe with process creation semantics (path heuristic).',
    0,
    'medium',
    { event_type: 'process_create', process_name: 'wmic.exe', path_contains: ['\\Temp\\'] },
    'Execution',
    'T1047'
  );

  // --- 101–105 (pack completes to 100): additional LOLBins from Temp ---
  add(
    'ioa_msiexec_from_temp',
    'msiexec from temp directory',
    'Installer launched from a temp path (possible sideload or abuse).',
    0,
    'medium',
    { event_type: 'process_create', process_name: 'msiexec.exe', path_contains: ['\\Temp\\'] },
    'Execution',
    'T1218.011'
  );
  add(
    'ioa_forfiles_from_temp',
    'forfiles.exe from temp path',
    'forfiles from suspicious location.',
    0,
    'medium',
    { event_type: 'process_create', process_name: 'forfiles.exe', path_contains: ['\\Temp\\'] },
    'Execution',
    'T1059.003'
  );
  add(
    'ioa_net_from_temp',
    'net.exe from temp path',
    'net.exe executed from temp (unusual).',
    0,
    'high',
    { event_type: 'process_create', process_name: 'net.exe', path_contains: ['\\Temp\\'] },
    'Execution',
    'T1078'
  );
  add(
    'ioa_wevtutil_from_temp',
    'wevtutil from suspicious path',
    'Log utility run from temp (possible evasion).',
    0,
    'high',
    { event_type: 'process_create', process_name: 'wevtutil.exe', path_contains: ['\\Temp\\'] },
    'Defense Evasion',
    'T1070.001'
  );
  if (rules.length !== 100) {
    throw new Error(`Expected 100 rules, got ${rules.length} — fix detection-rules-pack-100-data.js`);
  }

  return rules;
}

module.exports = { buildDetectionRulesPack100 };
