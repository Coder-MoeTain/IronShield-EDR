import React, { lazy, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ConsolePage from '../../components/ConsolePage';
import TabNav from '../../components/TabNav';
import EmbeddedPanel from '../../components/EmbeddedPanel';
import KpiStrip from '../../components/KpiStrip';
import ProductionReadinessPanel from '../../components/ProductionReadinessPanel';
import { useConsoleTab } from '../../utils/consoleTabs';
import { apiPath } from '../../utils/apiPath';

const Dashboard = lazy(() => import('./tabs/DashboardTab'));
const SensorHealth = lazy(() => import('./tabs/SensorHealthTab'));
const SystemHealth = lazy(() => import('./tabs/SystemHealthTab'));
const MsspConsole = lazy(() => import('./tabs/MsspConsoleTab'));
const XdrOverview = lazy(() => import('./tabs/XdrOverviewTab'));
const AnalyticsDetections = lazy(() => import('./tabs/AnalyticsDetectionsTab'));

const TABS = [
  { id: 'executive', label: 'Executive Summary' },
  { id: 'soc', label: 'SOC Operations' },
  { id: 'endpoint-health', label: 'Endpoint Health' },
  { id: 'detection-analytics', label: 'Detection Analytics' },
  { id: 'system-health', label: 'System Health' },
  { id: 'tenant', label: 'Tenant Overview' },
];

const VALID = TABS.map((t) => t.id);

export default function OverviewPage() {
  const { api } = useAuth();
  const [tab, setTab] = useConsoleTab('executive', VALID);
  const [searchParams] = useSearchParams();
  const agentHealthTab = searchParams.get('tab') === 'agent-health';
  const [kpis, setKpis] = useState(null);

  useEffect(() => {
    if (agentHealthTab) setTab('endpoint-health');
  }, [agentHealthTab, setTab]);

  const [softwareSummary, setSoftwareSummary] = useState(null);

  useEffect(() => {
    api(apiPath('/api/console/overview'))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setKpis(data?.kpis || data))
      .catch(() => setKpis(null));
    api(apiPath('/api/software/summary'), { silent: true })
      .then((r) => (r.ok ? r.json() : null))
      .then(setSoftwareSummary)
      .catch(() => setSoftwareSummary(null));
  }, [api]);

  const kpiItems = kpis
    ? [
        { id: 'ep', label: 'Endpoints', value: kpis.endpoints?.total },
        { id: 'on', label: 'Online', value: kpis.endpoints?.online, tone: 'ok' },
        { id: 'crit', label: 'Critical alerts', value: kpis.alerts?.critical, tone: 'bad' },
        { id: 'inc', label: 'Active incidents', value: kpis.incidents?.open, tone: 'warn' },
        ...(softwareSummary
          ? [{
              id: 'sw',
              label: 'Vulnerable software',
              value: softwareSummary.vulnerable_count ?? 0,
              tone: (softwareSummary.critical_count ?? 0) > 0 ? 'bad' : 'warn',
            }]
          : []),
      ]
    : [];

  return (
    <ConsolePage
      kicker="Console"
      title="Overview"
      description="Executive posture, SOC operations, endpoint health, and platform status."
      tabs={<TabNav tabs={TABS} activeTab={tab} onChange={setTab} ariaLabel="Overview sections" />}
    >
      {kpiItems.length > 0 ? <KpiStrip items={kpiItems} /> : null}
      <ProductionReadinessPanel compact />
      {tab === 'executive' && (
        <EmbeddedPanel label="Executive summary">
          <Dashboard />
        </EmbeddedPanel>
      )}
      {tab === 'soc' && (
        <EmbeddedPanel label="SOC operations">
          <XdrOverview />
        </EmbeddedPanel>
      )}
      {tab === 'endpoint-health' && (
        <EmbeddedPanel label="Endpoint health">
          <SensorHealth />
        </EmbeddedPanel>
      )}
      {tab === 'detection-analytics' && (
        <EmbeddedPanel label="Detection analytics">
          <AnalyticsDetections />
        </EmbeddedPanel>
      )}
      {tab === 'system-health' && (
        <EmbeddedPanel label="System health">
          <SystemHealth />
        </EmbeddedPanel>
      )}
      {tab === 'tenant' && (
        <EmbeddedPanel label="Tenant overview">
          <MsspConsole />
        </EmbeddedPanel>
      )}
    </ConsolePage>
  );
}
