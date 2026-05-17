import React, { lazy } from 'react';
import ConsolePage from '../../components/ConsolePage';
import TabNav from '../../components/TabNav';
import EmbeddedPanel from '../../components/EmbeddedPanel';
import { useConsoleTab } from '../../utils/consoleTabs';

const SocTriageQueue = lazy(() => import('./tabs/SocTriageQueueTab'));
const Alerts = lazy(() => import('./tabs/AlertsTab'));
const DetectionRules = lazy(() => import('./tabs/DetectionRulesTab'));
const MitreCoverage = lazy(() => import('./tabs/MitreCoverageTab'));
const XdrDetections = lazy(() => import('./tabs/XdrDetectionsTab'));
const AvMalwareAlerts = lazy(() => import('./tabs/AvMalwareAlertsTab'));
const AnalyticsDetections = lazy(() => import('../overview/tabs/AnalyticsDetectionsTab'));
const Suppressions = lazy(() => import('./tabs/SuppressionsTab'));
const DetectionQualityTab = lazy(() => import('./tabs/DetectionQualityTab'));
const RulePacks = lazy(() => import('./tabs/RulePacksTab'));
const DataSourceCoverage = lazy(() => import('./tabs/DataSourceCoverageTab'));
const ReplayLab = lazy(() => import('./tabs/ReplayLabTab'));
const RuleReviews = lazy(() => import('./tabs/RuleReviewsTab'));

const TABS = [
  { id: 'triage', label: 'Triage Queue' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'rules', label: 'Detection Rules' },
  { id: 'packs', label: 'Rule Packs' },
  { id: 'quality', label: 'Detection Quality' },
  { id: 'mitre', label: 'MITRE Coverage' },
  { id: 'datasources', label: 'Data Sources' },
  { id: 'suppressions', label: 'Suppressions' },
  { id: 'replay', label: 'Replay Lab' },
  { id: 'reviews', label: 'Rule Reviews' },
  { id: 'xdr', label: 'XDR Detections' },
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
      {tab === 'quality' && (
        <EmbeddedPanel label="Detection quality">
          <DetectionQualityTab />
        </EmbeddedPanel>
      )}
      {tab === 'packs' && (
        <EmbeddedPanel label="Rule packs">
          <RulePacks />
        </EmbeddedPanel>
      )}
      {tab === 'datasources' && (
        <EmbeddedPanel label="Data source coverage">
          <DataSourceCoverage />
        </EmbeddedPanel>
      )}
      {tab === 'replay' && (
        <EmbeddedPanel label="Replay lab">
          <ReplayLab />
        </EmbeddedPanel>
      )}
      {tab === 'reviews' && (
        <EmbeddedPanel label="Rule reviews">
          <RuleReviews />
        </EmbeddedPanel>
      )}
    </ConsolePage>
  );
}
