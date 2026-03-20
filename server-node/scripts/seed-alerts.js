/**
 * Seed demo alerts for Alert Queue.
 * Run: npm run seed-alerts
 */
require('dotenv').config();
const db = require('../src/utils/db');

const DEMO_ALERTS = [
  {
    title: 'PowerShell Encoded Command Detected',
    description: 'Detects PowerShell execution with Base64 encoded command indicators',
    severity: 'high',
    mitre_tactic: 'T1059.001',
    mitre_technique: 'Command and Scripting Interpreter: PowerShell',
  },
  {
    title: 'Office Application Spawned Shell',
    description: 'Microsoft Office application spawned command shell or PowerShell',
    severity: 'high',
    mitre_tactic: 'T1566.001',
    mitre_technique: 'Phishing: Spearphishing Attachment',
  },
  {
    title: 'Suspicious Rundll32 Execution',
    description: 'Rundll32.exe executing with unusual parameters',
    severity: 'medium',
    mitre_tactic: 'T1218.011',
    mitre_technique: 'System Binary Proxy Execution: Rundll32',
  },
  {
    title: 'Execution from Temp Directory',
    description: 'Executable launched from user temp or download directory',
    severity: 'medium',
    mitre_tactic: 'T1204',
    mitre_technique: 'User Execution: Malicious Link',
  },
  {
    title: 'Unsigned Executable from User Profile',
    description: 'Unsigned executable launched from user profile path',
    severity: 'medium',
    mitre_tactic: 'T1204',
    mitre_technique: 'User Execution: Malicious Link',
  },
];

async function main() {
  const endpoints = await db.query('SELECT id FROM endpoints LIMIT 1');
  const endpointId = Array.isArray(endpoints) ? endpoints[0]?.id : null;
  if (!endpointId) {
    console.log('No endpoints found. Register an agent first.');
    process.exit(1);
  }

  const [rules] = await db.query('SELECT id FROM detection_rules WHERE enabled = 1 LIMIT 1');
  const ruleId = rules?.[0]?.id || null;

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  for (let i = 0; i < DEMO_ALERTS.length; i++) {
    const a = DEMO_ALERTS[i];
    const firstSeen = new Date(oneHourAgo.getTime() + i * 10 * 60 * 1000);
    await db.execute(
      `INSERT INTO alerts (endpoint_id, rule_id, title, description, severity, confidence, mitre_tactic, mitre_technique, status, source_event_ids, first_seen, last_seen)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?)`,
      [
        endpointId,
        ruleId,
        a.title,
        a.description,
        a.severity,
        0.85,
        a.mitre_tactic,
        a.mitre_technique,
        JSON.stringify([]),
        firstSeen,
        firstSeen,
      ]
    );
  }

  console.log('Seeded', DEMO_ALERTS.length, 'demo alerts.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
