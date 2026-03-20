const EXEC_NAMES = new Set([
  'powershell', 'pwsh', 'cmd', 'wscript', 'cscript', 'rundll32', 'regsvr32', 'mshta',
  'winword', 'excel', 'powerpnt', 'outlook', 'chrome', 'msedge', 'firefox',
]);

/**
 * Normalizes process name for detection - ensures .exe suffix for known executables
 * so rules like /powershell\.exe/i match "powershell" or "powershell.exe"
 */
function normalizeProcessName(name) {
  if (!name || typeof name !== 'string') return name;
  const s = name.trim();
  if (!s) return s;
  const base = s.replace(/\.(exe|com|bat|cmd)$/i, '');
  const lower = base.toLowerCase();
  if (EXEC_NAMES.has(lower) && !/\.(exe|com|bat|cmd|ps1|vbs|js|msi)$/i.test(s)) {
    return base + '.exe';
  }
  return s;
}

/**
 * Parse Windows Security 4688/4689 message for process details
 * Format: "New Process Name:\tC:\path\proc.exe" etc.
 */
function parse4688Message(msg) {
  if (!msg || typeof msg !== 'string') return {};
  const out = {};
  const m1 = msg.match(/New Process Name:\s*([^\r\n]+)/i);
  if (m1) out.process_path = m1[1].trim();
  const m2 = msg.match(/Creator Process Name:\s*([^\r\n]+)/i) || msg.match(/Parent Process Name:\s*([^\r\n]+)/i);
  if (m2) out.parent_process_name = m2[1].trim();
  const m3 = msg.match(/Command Line:\s*([^\r\n]+)/i);
  if (m3) out.command_line = m3[1].trim();
  const m4 = msg.match(/Process Id:\s*(\d+)/i);
  if (m4) out.process_id = parseInt(m4[1], 10);
  const m5 = msg.match(/Creator Process Id:\s*(\d+)/i) || msg.match(/Parent Process Id:\s*(\d+)/i);
  if (m5) out.parent_process_id = parseInt(m5[1], 10);
  if (out.process_path) {
    const parts = out.process_path.replace(/\\/g, '/').split('/');
    out.process_name = parts[parts.length - 1] || out.process_path;
  }
  if (out.parent_process_name && !/\.(exe|com)$/i.test(out.parent_process_name)) {
    out.parent_process_name = out.parent_process_name + (out.parent_process_name.endsWith('.') ? 'exe' : '.exe');
  }
  return out;
}

/**
 * Normalizes raw events into structured format for detection engine
 */
function normalize(rawEvent) {
  const raw = typeof rawEvent.raw_event_json === 'object'
    ? rawEvent.raw_event_json
    : (typeof rawEvent.raw_event_json === 'string' ? JSON.parse(rawEvent.raw_event_json || '{}') : {});

  let processName = raw?.process_name || raw?.ProcessName;
  let parentProcessName = raw?.parent_process_name || raw?.ParentProcessName;
  let processPath = raw?.process_path || raw?.ProcessPath;
  let commandLine = raw?.command_line || raw?.CommandLine;
  let processId = raw?.process_id ?? raw?.ProcessId;
  let parentProcessId = raw?.parent_process_id ?? raw?.ParentProcessId;

  // Phase B: Parse 4688/4689 message when process details missing
  const msg = raw?.message || raw?.Message;
  const et = (raw?.event_type || rawEvent?.event_type || '').toLowerCase();
  const es = (raw?.event_source || rawEvent?.event_source || '').toLowerCase();
  if (msg && (!processName || !commandLine) && (et.includes('4688') || et.includes('process_create') || es === 'security')) {
    const parsed = parse4688Message(msg);
    if (parsed.process_name) processName = processName || parsed.process_name;
    if (parsed.process_path) processPath = processPath || parsed.process_path;
    if (parsed.parent_process_name) parentProcessName = parentProcessName || parsed.parent_process_name;
    if (parsed.command_line) commandLine = commandLine || parsed.command_line;
    if (parsed.process_id != null) processId = processId ?? parsed.process_id;
    if (parsed.parent_process_id != null) parentProcessId = parentProcessId ?? parsed.parent_process_id;
  }

  return {
    raw_event_id: rawEvent.id,
    endpoint_id: rawEvent.endpoint_id,
    hostname: rawEvent.hostname || raw?.hostname,
    username: raw?.username || raw?.Username || raw?.logged_in_user,
    timestamp: rawEvent.timestamp || raw?.timestamp,
    event_source: rawEvent.event_source || raw?.event_source,
    event_type: rawEvent.event_type || raw?.event_type,
    process_name: processName ? normalizeProcessName(processName) : processName,
    process_path: processPath,
    process_id: processId,
    parent_process_name: parentProcessName ? normalizeProcessName(parentProcessName) : parentProcessName,
    parent_process_id: parentProcessId,
    command_line: commandLine,
    file_hash_sha256: raw?.file_hash_sha256,
    source_ip: raw?.source_ip,
    destination_ip: raw?.destination_ip,
    destination_port: raw?.destination_port,
    protocol: raw?.protocol,
    service_name: raw?.service_name,
    logon_type: raw?.logon_type,
    powershell_command: raw?.powershell_command,
    raw_event_json: raw,
  };
}

module.exports = { normalize, normalizeProcessName };
