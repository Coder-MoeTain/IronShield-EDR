/**
 * Endpoint protection capability catalog — maps product areas to IronShield implementation status.
 * Status is honest: full | partial | planned. No third-party vendor claims.
 */

/** @typedef {'full' | 'partial' | 'planned'} CapabilityStatus */

/**
 * @returns {{
 *   product: string,
 *   version: string,
 *   capabilities: Array<{
 *     id: string,
 *     title: string,
 *     summary: string,
 *     bullets: string[],
 *     status: CapabilityStatus,
 *     status_label: string,
 *     links: Array<{ label: string, path: string }>,
 *   }>,
 * }}
 */
function getCapabilitiesCatalog() {
  return {
    product: 'IronShield EDR',
    version: '1.0',
    disclaimer:
      'Capabilities reflect the open-source agent and server as shipped. "Partial" means a subset or console-side workflow exists; "Planned" is on the public roadmap unless you extend the agent.',
    capabilities: [
      {
        id: 'malware-av',
        title: 'Malware & threat protection',
        summary: 'Real-time and on-demand scanning with signatures, path patterns, and bounded binary matching.',
        bullets: [
          'Realtime FileSystemWatcher scans on high-risk paths; scheduled and on-demand scans.',
          'Signature types: hash, path/filename regex, binary byte patterns (bounded reads).',
          'Heuristic scoring for suspicious locations, double extensions, entropy, and PE metadata.',
          'Automatic quarantine when score meets policy threshold.',
        ],
        status: 'full',
        status_label: 'Core NGAV',
        links: [
          { label: 'NGAV overview', path: '/av' },
          { label: 'AV policies', path: '/av/policies' },
          { label: 'Signatures', path: '/av/signatures' },
        ],
      },
      {
        id: 'ransomware',
        title: 'Ransomware protection (basic)',
        summary: 'Defense-in-depth using file behavior heuristics and containment, not a dedicated anti-ransomware driver.',
        bullets: [
          'High-entropy and path-based heuristics flag likely packed or staged payloads.',
          'Quarantine and process response workflows reduce blast radius when policy allows.',
          'Kernel-level folder shielding and shadow-copy hooks are not in the open agent.',
        ],
        status: 'partial',
        status_label: 'Heuristic + quarantine',
        links: [
          { label: 'Malware alerts', path: '/av/malware-alerts' },
          { label: 'Quarantine', path: '/av/quarantine' },
        ],
      },
      {
        id: 'ml-ai',
        title: 'Machine learning (basic)',
        summary: 'Statistical and rule-based analysis; not a separate on-endpoint ML model runtime.',
        bullets: [
          'Heuristic engine scores files using entropy, path context, and PE signals.',
          'Reputation uses historical scan results and admin-defined signatures.',
          'A trainable cloud ML classifier is not bundled with the agent.',
        ],
        status: 'partial',
        status_label: 'Heuristics + reputation',
        links: [
          { label: 'File reputation', path: '/av/reputation' },
          { label: 'Detection analytics', path: '/analytics-detections' },
        ],
      },
      {
        id: 'web-url',
        title: 'Web & URL protection',
        summary:
          'Windows agent syncs domain and URL IOCs from the server and sinkholes them in the hosts file (127.0.0.1) when running elevated; not a browser extension or HTTPS MITM.',
        bullets: [
          'IOC watchlist domain and URL indicators are pushed to the agent as a versioned blocklist.',
          'Malicious and phishing sites are blocked before the browser loads the page for standard DNS resolution paths.',
          'DNS-over-HTTPS and raw-IP C2 are not covered; use network response actions for known bad IPs.',
        ],
        status: 'partial',
        status_label: 'IOC hosts sinkhole + telemetry',
        links: [
          { label: 'Web & URL console', path: '/web-url-protection' },
          { label: 'IOC watchlist', path: '/iocs' },
          { label: 'Network activity', path: '/network' },
          { label: 'XDR overview', path: '/xdr' },
          { label: 'XDR events', path: '/xdr/events' },
        ],
      },
      {
        id: 'email-content',
        title: 'Email & content threat protection (basic)',
        summary: 'No mailbox agent; use IOCs and correlation for mail-adjacent indicators.',
        bullets: [
          'Hash and URL IOCs can represent malicious attachments or links.',
          'Alerts and investigations correlate endpoint and auth events.',
          'Exchange / M365 API integration is not included out of the box.',
        ],
        status: 'planned',
        status_label: 'IOC-based only',
        links: [{ label: 'IOC watchlist', path: '/iocs' }],
      },
      {
        id: 'hips',
        title: 'Host-based intrusion prevention (HIPS)',
        summary: 'Detection rules and EDR telemetry; not a classic kernel HIPS with default-deny syscall filtering.',
        bullets: [
          'Custom IOA rules and normalized events drive prevention and alerting.',
          'Sysmon and Windows event collectors feed the detection pipeline when configured.',
          'Default-deny kernel HIPS policies are not the current agent model.',
        ],
        status: 'partial',
        status_label: 'Rules + EDR',
        links: [
          { label: 'Detection rules', path: '/detection-rules' },
          { label: 'Alerts', path: '/alerts' },
        ],
      },
      {
        id: 'app-control',
        title: 'Application control',
        summary: 'Policy and triage workflows; not a full application whitelisting driver.',
        bullets: [
          'Endpoint policies and host groups scope agent behavior.',
          'AV exclusions and signatures can allow or block known-good or known-bad binaries by hash.',
          'Strict Windows Software Restriction-style enforcement is an integration/extension task.',
        ],
        status: 'partial',
        status_label: 'Policy + hash control',
        links: [
          { label: 'EDR policies', path: '/policies' },
          { label: 'Host groups', path: '/host-groups' },
          { label: 'AV policies', path: '/av/policies' },
        ],
      },
      {
        id: 'device-control',
        title: 'Device control',
        summary:
          'Windows agent: WMI volume arrival for removable drives; audit telemetry or user-mode eject when policy is block. Not a kernel filter driver.',
        bullets: [
          'Policy: device_control_enabled + removable_storage_action (audit | block | allow) on AV policy JSON.',
          'Block uses Win32_Volume.Eject (best-effort). Some USB devices report as Fixed — may not be treated as removable.',
          'Kernel-level deny-before-mount requires a separate driver stack.',
        ],
        status: 'partial',
        status_label: 'USB removable (agent)',
        links: [
          { label: 'AV policies', path: '/av/policies' },
          { label: 'Deep prevention notes', path: '/falcon/prevention-deep' },
        ],
      },
      {
        id: 'dlp',
        title: 'Data loss prevention (basic)',
        summary: 'Audit, RBAC, and retention — not content-aware DLP classification.',
        bullets: [
          'Audit logs and activity trails support compliance workflows.',
          'Sensitive data discovery and exfiltration ML are not built-in.',
        ],
        status: 'partial',
        status_label: 'Audit & governance',
        links: [
          { label: 'Audit & activity', path: '/audit-logs' },
          { label: 'Enterprise settings', path: '/enterprise' },
        ],
      },
      {
        id: 'endpoint-coverage',
        title: 'Endpoint coverage',
        summary: 'Windows agent today; architecture supports multiple workloads where you deploy the sensor.',
        bullets: [
          'Primary reference implementation: Windows .NET agent with EDR + NGAV modules.',
          'Servers and VDI are supported when the agent is installed; coverage follows deployment.',
        ],
        status: 'full',
        status_label: 'Windows agent',
        links: [
          { label: 'All hosts', path: '/endpoints' },
          { label: 'Sensor health', path: '/sensor-health' },
        ],
      },
      {
        id: 'central-management',
        title: 'Centralized management',
        summary: 'Single console for policies, monitoring, AV, and response.',
        bullets: [
          'Multi-tenant aware admin APIs and dashboard.',
          'RBAC, MFA policy hooks, and audit for administrative actions.',
        ],
        status: 'full',
        status_label: 'Console',
        links: [
          { label: 'Activity', path: '/' },
          { label: 'Enterprise settings', path: '/enterprise' },
        ],
      },
      {
        id: 'threat-intel',
        title: 'Threat intelligence integration',
        summary: 'First-party signature bundles and curated open feeds — not a proprietary vendor cloud named here.',
        bullets: [
          'Signature bundles versioned and distributed to agents.',
          'IP blocklist-style feeds can be ingested server-side (see threat intel feed jobs).',
          'You may attach commercial TI feeds via integration work.',
        ],
        status: 'partial',
        status_label: 'Signatures + feeds',
        links: [
          { label: 'Signatures', path: '/av/signatures' },
          { label: 'IOC watchlist', path: '/iocs' },
        ],
      },
      {
        id: 'logging-visibility',
        title: 'Logging & visibility',
        summary: 'Security events, alerts, audit trail, and investigations — forensic deep-dives vary by data retention.',
        bullets: [
          'Alerts, incidents, investigations, and malware alerts.',
          'Audit logging for admin actions.',
          'Full disk forensics and long-term cold storage are deployment choices.',
        ],
        status: 'full',
        status_label: 'SOC visibility',
        links: [
          { label: 'Alerts', path: '/alerts' },
          { label: 'Investigations', path: '/investigations' },
          { label: 'Audit logs', path: '/audit-logs' },
        ],
      },
      {
        id: 'multi-layer',
        title: 'Multi-layer protection',
        summary: 'Combines signatures, heuristics, reputation, detection rules, and XDR-style correlation.',
        bullets: [
          'NGAV layer on the endpoint; EDR detection engine on the platform.',
          'Cross-source correlation via incidents and XDR event pipeline.',
        ],
        status: 'partial',
        status_label: 'Layered (extensible)',
        links: [
          { label: 'Threat graph', path: '/threat-graph' },
          { label: 'Incidents', path: '/incidents' },
        ],
      },
    ],
  };
}

module.exports = {
  getCapabilitiesCatalog,
};
