import React, { lazy } from 'react';
import ConsolePage from '../../components/ConsolePage';
import TabNav from '../../components/TabNav';
import EmbeddedPanel from '../../components/EmbeddedPanel';
import { useConsoleTab } from '../../utils/consoleTabs';

const AvOverview = lazy(() => import('../../pages/AvOverview'));
const AvDetections = lazy(() => import('../../pages/AvDetections'));
const AvQuarantine = lazy(() => import('../../pages/AvQuarantine'));
const AvScanTasks = lazy(() => import('../../pages/AvScanTasks'));
const AvPolicies = lazy(() => import('../../pages/AvPolicies'));
const AvSignatures = lazy(() => import('../../pages/AvSignatures'));
const AvFileReputation = lazy(() => import('../../pages/AvFileReputation'));
const WebUrlProtection = lazy(() => import('../../pages/WebUrlProtection'));
const ProtectionCapabilities = lazy(() => import('../../pages/ProtectionCapabilities'));
const TABS = [
  { id: 'overview', label: 'Protection Overview' },
  { id: 'detections', label: 'Malware Detections' },
  { id: 'quarantine', label: 'Quarantine' },
  { id: 'scans', label: 'Scan Tasks' },
  { id: 'policies', label: 'Policies' },
  { id: 'signatures', label: 'Signatures' },
  { id: 'reputation', label: 'File Reputation' },
  { id: 'web', label: 'Web Protection' },
  { id: 'capabilities', label: 'Capabilities' },
];

const VALID = TABS.map((t) => t.id);

export default function ProtectionPage() {
  const [tab, setTab] = useConsoleTab('overview', VALID);

  return (
    <ConsolePage
      kicker="Console"
      title="Protection"
      description="NGAV overview, malware detections, quarantine, policies, signatures, and web protection."
      tabs={<TabNav tabs={TABS} activeTab={tab} onChange={setTab} ariaLabel="Protection sections" />}
    >
      {tab === 'overview' && (
        <EmbeddedPanel label="Protection overview">
          <AvOverview />
        </EmbeddedPanel>
      )}
      {tab === 'detections' && (
        <EmbeddedPanel label="Malware detections">
          <AvDetections />
        </EmbeddedPanel>
      )}
      {tab === 'quarantine' && (
        <EmbeddedPanel label="Quarantine">
          <AvQuarantine />
        </EmbeddedPanel>
      )}
      {tab === 'scans' && (
        <EmbeddedPanel label="Scan tasks">
          <AvScanTasks />
        </EmbeddedPanel>
      )}
      {tab === 'policies' && (
        <EmbeddedPanel label="Policies">
          <AvPolicies />
        </EmbeddedPanel>
      )}
      {tab === 'signatures' && (
        <EmbeddedPanel label="Signatures">
          <AvSignatures />
        </EmbeddedPanel>
      )}
      {tab === 'reputation' && (
        <EmbeddedPanel label="File reputation">
          <AvFileReputation />
        </EmbeddedPanel>
      )}
      {tab === 'web' && (
        <EmbeddedPanel label="Web protection">
          <WebUrlProtection />
        </EmbeddedPanel>
      )}
      {tab === 'capabilities' && (
        <EmbeddedPanel label="Capabilities">
          <ProtectionCapabilities />
        </EmbeddedPanel>
      )}
    </ConsolePage>
  );
}
