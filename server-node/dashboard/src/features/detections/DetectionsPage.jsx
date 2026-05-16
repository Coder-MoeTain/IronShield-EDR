import React, { lazy } from 'react';
import ConsolePage from '../../components/ConsolePage';
import TabNav from '../../components/TabNav';
import EmbeddedPanel from '../../components/EmbeddedPanel';
import { useConsoleTab } from '../../utils/consoleTabs';

const SocTriageQueue = lazy(() => import('../../pages/SocTriageQueue'));
const Alerts = lazy(() => import('../../pages/Alerts'));
const DetectionRules = lazy(() => import('../../pages/DetectionRules'));
const MitreCoverage = lazy(() => import('../../pages/MitreCoverage'));
const XdrDetections = lazy(() => import('../../pages/XdrDetections'));
const AvMalwareAlerts = lazy(() => import('../../pages/AvMalwareAlerts'));
const AnalyticsDetections = lazy(() => import('../../pages/AnalyticsDetections'));
const Suppressions = lazy(() => import('../../pages/Suppressions'));

const TABS = [
  { id: 'triage', label: 'Triage Queue' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'rules', label: 'Detection Rules' },
  { id: 'mitre', label: 'MITRE Coverage' },
  { id: 'xdr', label: 'XDR Detections' },
  { id: 'suppressions', label: 'Suppressions' },
  { id: 'analytics', label: 'Detection Analytics' },
];

const VALID = TABS.map((t) => t.id);

export default function DetectionsPage() {
  const [tab, setTab] = useConsoleTab('triage', VALID);

  return (
    <ConsolePage
      kicker="Console"
      title="Detections"
      description="Triage queue, alerts, rules, MITRE coverage, and detection analytics."
      tabs={<TabNav tabs={TABS} activeTab={tab} onChange={setTab} ariaLabel="Detection sections" />}
    >
      {tab === 'triage' && (
        <EmbeddedPanel label="Triage queue">
          <SocTriageQueue />
        </EmbeddedPanel>
      )}
      {tab === 'alerts' && (
        <EmbeddedPanel label="Alerts">
          <Alerts />
        </EmbeddedPanel>
      )}
      {tab === 'rules' && (
        <EmbeddedPanel label="Detection rules">
          <DetectionRules />
        </EmbeddedPanel>
      )}
      {tab === 'mitre' && (
        <EmbeddedPanel label="MITRE coverage">
          <MitreCoverage />
        </EmbeddedPanel>
      )}
      {tab === 'xdr' && (
        <EmbeddedPanel label="XDR detections">
          <XdrDetections />
        </EmbeddedPanel>
      )}
      {tab === 'suppressions' && (
        <EmbeddedPanel label="Suppressions">
          <Suppressions />
        </EmbeddedPanel>
      )}
      {tab === 'analytics' && (
        <EmbeddedPanel label="Detection analytics">
          <AnalyticsDetections />
        </EmbeddedPanel>
      )}
    </ConsolePage>
  );
}
