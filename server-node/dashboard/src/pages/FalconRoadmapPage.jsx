import React from 'react';
import { useParams, Link } from 'react-router-dom';
import PageShell from '../components/PageShell';
import styles from './FalconRoadmapPage.module.css';

const AREAS = {
  identity: {
    title: 'Identity / Zero Trust',
    kicker: 'Roadmap',
    description:
      'CrowdStrike-style Identity Protection and IdP posture are not implemented in this self-hosted build.',
    bullets: [
      'Requires IdP integrations (Azure AD, Okta), risk scoring pipelines, and UI for sign-in analytics.',
      'IronShield: use host and user fields in normalized events; extend with dedicated identity tables if needed.',
    ],
  },
  exposure: {
    title: 'Exposure / attack surface',
    kicker: 'Roadmap',
    description: 'External attack surface management (ASM) is out of scope for the core EDR stack.',
    bullets: [
      'Typical Falcon modules combine cloud inventory scanners and third-party ASM feeds.',
      'IronShield: document external assets manually or integrate a separate ASM product via API.',
    ],
  },
  'managed-hunting': {
    title: 'Managed hunting / Overwatch',
    kicker: 'Roadmap',
    description: 'Vendor-managed hunting is a CrowdStrike service tier — not available in self-hosted IronShield.',
    bullets: [
      'Use the in-app Hunting page for custom queries over normalized_events.',
      'Export SIEM NDJSON for external SOC workflows.',
    ],
  },
  'prevention-deep': {
    title: 'Deep prevention (exploit, device control, USB)',
    kicker: 'Roadmap',
    description: 'Kernel exploit mitigation and device control require driver-level components.',
    bullets: [
      'IronShield NGAV: signatures, policies, quarantine under Next-gen AV.',
      'EDR prevention: extend agent with WDAC/AppLocker policies and documented hardening (see docs).',
    ],
  },
  integrations: {
    title: 'Integrations / XDR fabric',
    kicker: 'Roadmap',
    description: 'Bi-directional SOAR, ticketing, and LogScale-class pipelines are partially covered.',
    bullets: [
      'Implemented: webhooks, SIEM NDJSON export, notification channels (Enterprise settings).',
      'Missing: native ServiceNow/Jira bidirectional sync — use generic webhook + automation layer.',
    ],
  },
};

export default function FalconRoadmapPage() {
  const { area } = useParams();
  const cfg = AREAS[area] || {
    title: 'Falcon-class roadmap',
    kicker: 'Advanced',
    description: 'Pick an area from the Advanced menu.',
    bullets: [],
  };

  return (
    <PageShell kicker={cfg.kicker} title={cfg.title} description={cfg.description}>
      <div className={styles.box}>
        <p className={styles.note}>
          CrowdStrike® / Falcon™ are trademarks of CrowdStrike, Inc. IronShield is an independent self-hosted EDR.
        </p>
        <ul className={styles.ul}>
          {cfg.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <p className={styles.links}>
          <Link to="/hunting">Hunting</Link>
          {' · '}
          <Link to="/enterprise">Enterprise / integrations</Link>
          {' · '}
          <Link to="/av">Next-gen AV</Link>
        </p>
      </div>
    </PageShell>
  );
}
