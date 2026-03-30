/**
 * Route labels for document title and breadcrumbs (SOC console IA).
 */

const APP = 'IronShield';

const TOP = {
  endpoints: { label: 'Hosts', path: '/endpoints' },
  alerts: { label: 'Detections', path: '/alerts' },
  events: { label: 'Events', path: '/events' },
  'raw-events': { label: 'Raw events', path: '/raw-events' },
  'normalized-events': { label: 'Normalized events', path: '/normalized-events' },
  'detection-rules': { label: 'Detection rules', path: '/detection-rules' },
  'audit-logs': { label: 'Audit & activity', path: '/audit-logs' },
  investigations: { label: 'Investigations', path: '/investigations' },
  incidents: { label: 'Incidents', path: '/incidents' },
  risk: { label: 'Endpoint risk', path: '/risk' },
  iocs: { label: 'IOC watchlist', path: '/iocs' },
  'web-url-protection': { label: 'Web & URL protection', path: '/web-url-protection' },
  policies: { label: 'Policies', path: '/policies' },
  triage: { label: 'Triage', path: '/triage' },
  network: { label: 'Network activity', path: '/network' },
  'process-monitor': { label: 'Process monitor', path: '/process-monitor' },
  hunting: { label: 'Hunting', path: '/hunting' },
  rtr: { label: 'Real Time Response', path: '/rtr' },
  'threat-graph': { label: 'Threat graph', path: '/threat-graph' },
  'agent-network-map': { label: 'Agent network map', path: '/agent-network-map' },
  'analytics-detections': { label: 'Detection analytics', path: '/analytics-detections' },
  'sensor-health': { label: 'Sensor health', path: '/sensor-health' },
  'host-groups': { label: 'Host groups', path: '/host-groups' },
  enterprise: { label: 'Enterprise settings', path: '/enterprise' },
  tenants: { label: 'Tenants', path: '/tenants' },
  mssp: { label: 'MSSP', path: '/mssp' },
  rbac: { label: 'RBAC', path: '/rbac' },
};

const XDR_SUB = {
  events: { label: 'XDR events', path: '/xdr/events' },
  detections: { label: 'XDR detections', path: '/xdr/detections' },
  realtime: { label: 'XDR realtime', path: '/xdr/realtime' },
};

const AV_SUB = {
  detections: { label: 'Malware detections', path: '/av/detections' },
  quarantine: { label: 'Quarantine', path: '/av/quarantine' },
  'scan-tasks': { label: 'Scan tasks', path: '/av/scan-tasks' },
  policies: { label: 'AV policies', path: '/av/policies' },
  signatures: { label: 'Signatures', path: '/av/signatures' },
  reputation: { label: 'File reputation', path: '/av/reputation' },
  'malware-alerts': { label: 'Malware alerts', path: '/av/malware-alerts' },
};

const FALCON_SUB = {
  identity: 'Identity / Zero Trust',
  exposure: 'Exposure / attack surface',
  'managed-hunting': 'Managed hunting',
  'prevention-deep': 'Deep prevention',
  integrations: 'Integrations / XDR fabric',
};

function isNumericId(s) {
  return s && /^\d+$/.test(s);
}

/**
 * @returns {{ label: string, to?: string }[]}
 */
export function getBreadcrumbs(pathname) {
  const path = pathname || '/';
  if (path === '/' || path === '') {
    return [{ label: 'Activity', to: '/' }];
  }

  const segments = path.split('/').filter(Boolean);
  const crumbs = [{ label: 'Activity', to: '/' }];

  const [a0, a1, a2] = segments;

  if (a0 === 'xdr' && a1 && XDR_SUB[a1]) {
    crumbs.push({ label: 'XDR', to: '/xdr/events' });
    crumbs.push({ label: XDR_SUB[a1].label, to: XDR_SUB[a1].path });
    return crumbs;
  }

  if (a0 === 'falcon' && a1 && FALCON_SUB[a1]) {
    crumbs.push({ label: 'Roadmap', to: '/falcon/identity' });
    crumbs.push({ label: FALCON_SUB[a1], to: `/falcon/${a1}` });
    return crumbs;
  }

  if (a0 === 'respond' && a1 === 'approvals') {
    crumbs.push({ label: 'Response approvals', to: '/respond/approvals' });
    return crumbs;
  }

  if (a0 === 'av') {
    crumbs.push({ label: 'Antivirus', to: '/av' });
    if (!a1) return crumbs;
    if (AV_SUB[a1]) {
      crumbs.push({ label: AV_SUB[a1].label, to: AV_SUB[a1].path });
      if (a2 && isNumericId(a2)) {
        crumbs.push({ label: `Record #${a2}`, to: path });
      }
      return crumbs;
    }
    if (isNumericId(a1)) {
      crumbs.push({ label: `Record #${a1}`, to: path });
    }
    return crumbs;
  }

  const meta = TOP[a0];
  if (!meta) {
    crumbs.push({ label: 'Not found' });
    return crumbs;
  }

  if (segments.length === 1) {
    crumbs.push({ label: meta.label, to: meta.path });
    return crumbs;
  }

  crumbs.push({ label: meta.label, to: meta.path });

  if (segments.length === 2) {
    const last = a1;
    if (isNumericId(last)) {
      const detail =
        a0 === 'alerts'
          ? 'Alert'
          : a0 === 'endpoints'
            ? 'Host'
            : a0 === 'incidents'
              ? 'Incident'
              : a0 === 'investigations'
                ? 'Investigation'
                : a0 === 'raw-events'
                  ? 'Raw event'
                  : a0 === 'normalized-events'
                    ? 'Event'
                    : 'Detail';
      crumbs.push({ label: `${detail} #${last}`, to: path });
    } else if (last === 'new') {
      crumbs.push({ label: 'New', to: path });
    } else {
      crumbs.push({ label: last.replace(/-/g, ' '), to: path });
    }
    return crumbs;
  }

  // 3+ segments e.g. detection-rules/:id/edit
  if (a0 === 'detection-rules' && segments[2] === 'edit' && isNumericId(a1)) {
    crumbs.push({ label: `Rule #${a1}`, to: `/detection-rules/${a1}` });
    crumbs.push({ label: 'Edit', to: path });
    return crumbs;
  }

  crumbs.push({ label: segments[segments.length - 1].replace(/-/g, ' '), to: path });
  return crumbs;
}

export function getDocumentTitle(pathname) {
  const path = pathname || '/';
  if (path === '/login') return `Sign in — ${APP}`;

  const crumbs = getBreadcrumbs(path);
  const last = crumbs[crumbs.length - 1];
  const page = last?.label || 'Console';
  return `${page} — ${APP}`;
}
