import React, { lazy } from 'react';
import { useAuth } from '../../context/AuthContext';
import ConsolePage from '../../components/ConsolePage';
import TabNav from '../../components/TabNav';
import EmbeddedPanel from '../../components/EmbeddedPanel';
import KpiStrip from '../../components/KpiStrip';
import { useConsoleTab } from '../../utils/consoleTabs';
import { useConsoleBff } from '../../hooks/useConsoleBff';

const Incidents = lazy(() => import('./tabs/IncidentsTab'));
const Investigations = lazy(() => import('./tabs/InvestigationsTab'));
const HostTimeline = lazy(() => import('../endpoints/tabs/HostTimelineTab'));
const ThreatGraph = lazy(() => import('./tabs/ThreatGraphTab'));
const Reports = lazy(() => import('./tabs/ReportsTab'));

const TABS = [
  { id: 'incidents', label: 'Incidents' },
  { id: 'cases', label: 'Cases' },
  { id: 'evidence', label: 'Evidence Timeline' },
  { id: 'graph', label: 'Threat Graph' },
  { id: 'reports', label: 'Reports' },
];

const VALID = TABS.map((t) => t.id);

export default function InvestigationPage() {
  const { api } = useAuth();
  const [tab, setTab] = useConsoleTab('incidents', VALID);
  const { data: bff } = useConsoleBff(api, 'investigation');
  const inc = bff?.kpis?.incidents || {};
  const kpiItems = bff
    ? [
        { id: 'open', label: 'Open incidents', value: inc.open ?? '—' },
        { id: 'total', label: 'Total incidents', value: inc.total ?? '—' },
      ]
    : [];

  return (
    <ConsolePage
      kicker="Console"
      title="Investigation"
      description="Incidents, cases, evidence timelines, threat graph, and investigation reports."
      tabs={<TabNav tabs={TABS} activeTab={tab} onChange={setTab} ariaLabel="Investigation sections" />}
    >
      {kpiItems.length > 0 && <KpiStrip items={kpiItems} />}
      {tab === 'incidents' && (
        <EmbeddedPanel label="Incidents">
          <Incidents />
        </EmbeddedPanel>
      )}
      {tab === 'cases' && (
        <EmbeddedPanel label="Cases">
          <Investigations />
        </EmbeddedPanel>
      )}
      {tab === 'evidence' && (
        <EmbeddedPanel label="Evidence timeline">
          <HostTimeline />
        </EmbeddedPanel>
      )}
      {tab === 'graph' && (
        <EmbeddedPanel label="Threat graph">
          <ThreatGraph />
        </EmbeddedPanel>
      )}
      {tab === 'reports' && (
        <EmbeddedPanel label="Reports">
          <Reports />
        </EmbeddedPanel>
      )}
    </ConsolePage>
  );
}
