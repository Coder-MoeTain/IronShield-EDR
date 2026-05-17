import React, { lazy } from 'react';
import { useAuth } from '../../context/AuthContext';
import ConsolePage from '../../components/ConsolePage';
import TabNav from '../../components/TabNav';
import EmbeddedPanel from '../../components/EmbeddedPanel';
import KpiStrip from '../../components/KpiStrip';
import { useConsoleTab } from '../../utils/consoleTabs';
import { useConsoleBff } from '../../hooks/useConsoleBff';

const AvOverview = lazy(() => import('./tabs/AvOverviewTab'));
const AvDetections = lazy(() => import('./tabs/AvDetectionsTab'));
const AvQuarantine = lazy(() => import('../response/tabs/AvQuarantineTab'));
const AvScanTasks = lazy(() => import('./tabs/AvScanTasksTab'));
const AvPolicies = lazy(() => import('./tabs/AvPoliciesTab'));
const AvSignatures = lazy(() => import('./tabs/AvSignaturesTab'));
const AvFileReputation = lazy(() => import('./tabs/AvFileReputationTab'));
const WebUrlProtection = lazy(() => import('../hunting/tabs/WebUrlProtectionTab'));
const ProtectionCapabilities = lazy(() => import('./tabs/ProtectionCapabilitiesTab'));
const SoftwareRisk = lazy(() => import('./tabs/SoftwareRiskTab'));
const TABS = [
  { id: 'overview', label: 'Protection Overview' },
  { id: 'software-risk', label: 'Software Risk' },
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
  const { api } = useAuth();
  const [tab, setTab] = useConsoleTab('overview', VALID);
  const { data: bff } = useConsoleBff(api, 'protection');
  const av = bff?.kpis?.av || {};
  const kpiItems = bff
    ? [
        { id: 'det', label: 'Detections (24h)', value: av.detections_24h ?? av.detections24h ?? '—' },
        { id: 'q', label: 'Quarantined', value: av.quarantined ?? av.quarantine_count ?? '—' },
        { id: 'scan', label: 'Scans running', value: av.scans_running ?? av.active_scans ?? '—' },
      ]
    : [];

  return (
    <ConsolePage
      kicker="Console"
      title="Protection"
      description="NGAV overview, malware detections, quarantine, policies, signatures, and web protection."
      tabs={<TabNav tabs={TABS} activeTab={tab} onChange={setTab} ariaLabel="Protection sections" />}
    >
      {kpiItems.length > 0 && <KpiStrip items={kpiItems} />}
      {tab === 'overview' && (
        <EmbeddedPanel label="Protection overview">
          <AvOverview />
        </EmbeddedPanel>
      )}
      {tab === 'software-risk' && (
        <EmbeddedPanel label="Software risk">
          <SoftwareRisk />
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
