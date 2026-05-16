/**
 * One-time migration: move page modules into feature tabs, leave thin wrappers in pages/.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, '../src');
const pagesDir = path.join(src, 'pages');
const keepInPages = new Set(['Login.jsx', 'NotFound.jsx', 'DEPRECATED.md']);

const mapping = {
  overview: ['Dashboard', 'SensorHealth', 'SystemHealth', 'MsspConsole', 'XdrOverview', 'AnalyticsDetections'],
  endpoints: ['Endpoints', 'HostGroups', 'HostTimeline', 'ProcessMonitor', 'ProcessTree', 'Network', 'AgentNetworkMap'],
  detections: ['SocTriageQueue', 'Alerts', 'DetectionRules', 'MitreCoverage', 'XdrDetections', 'AvMalwareAlerts', 'AnalyticsDetections', 'Suppressions'],
  investigation: ['Incidents', 'Investigations', 'ThreatGraph', 'Reports', 'IncidentDetail', 'InvestigationDetail'],
  response: ['ResponseApprovals', 'RtrConsole', 'Playbooks', 'Triage', 'AvQuarantine'],
  hunting: ['Hunting', 'Events', 'RawEvents', 'NormalizedEvents', 'XdrEvents', 'XdrRealtime', 'IOCs', 'WebUrlProtection'],
  protection: ['AvOverview', 'AvDetections', 'AvQuarantine', 'AvScanTasks', 'AvPolicies', 'AvSignatures', 'AvFileReputation', 'ProtectionCapabilities'],
  admin: ['EnterpriseSettings', 'TenantManagement', 'RbacManagement', 'AuditLogs', 'Integrations', 'SystemHealth', 'FalconRoadmapPage'],
};

function fixImports(content) {
  return content
    .replace(/from '\.\.\/components\//g, "from '../../../components/")
    .replace(/from '\.\.\/context\//g, "from '../../../context/")
    .replace(/from '\.\.\/utils\//g, "from '../../../utils/")
    .replace(/from '\.\.\/hooks\//g, "from '../../../hooks/")
    .replace(/from '\.\//g, "from './")
    .replace(/from '\.\/([A-Za-z]+)\.module\.css'/g, "from './$1Tab.module.css'")
    .replace(/styles from '\.\/([^']+)\.module\.css'/g, (m, name) => {
      if (name.endsWith('Tab')) return m;
      return `styles from './${name}Tab.module.css'`;
    });
}

let moved = 0;
for (const [feature, files] of Object.entries(mapping)) {
  const tabsDir = path.join(src, 'features', feature, 'tabs');
  fs.mkdirSync(tabsDir, { recursive: true });
  for (const name of files) {
    const srcFile = path.join(pagesDir, `${name}.jsx`);
    if (!fs.existsSync(srcFile)) continue;
    const tabName = `${name}Tab`;
    const destFile = path.join(tabsDir, `${tabName}.jsx`);
    if (fs.existsSync(destFile)) continue;

    let content = fs.readFileSync(srcFile, 'utf8');
    content = fixImports(content);
    fs.writeFileSync(destFile, content);

    const cssSrc = path.join(pagesDir, `${name}.module.css`);
    const cssDest = path.join(tabsDir, `${tabName}.module.css`);
    if (fs.existsSync(cssSrc) && !fs.existsSync(cssDest)) {
      fs.copyFileSync(cssSrc, cssDest);
    }

    const rel = `../features/${feature}/tabs/${tabName}`;
    fs.writeFileSync(
      srcFile,
      `/** @deprecated Import from features/${feature}/tabs/${tabName} */\nexport { default } from '${rel}';\n`
    );
    moved++;
  }
}

console.log(`Migrated ${moved} page modules to feature tabs.`);
