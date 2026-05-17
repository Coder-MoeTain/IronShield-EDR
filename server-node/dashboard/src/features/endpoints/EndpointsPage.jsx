import React, { lazy } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ConsolePage from '../../components/ConsolePage';
import TabNav from '../../components/TabNav';
import EmbeddedPanel from '../../components/EmbeddedPanel';
import KpiStrip from '../../components/KpiStrip';
import { useConsoleTab } from '../../utils/consoleTabs';
import { useConsoleBff } from '../../hooks/useConsoleBff';

const Endpoints = lazy(() => import('./tabs/EndpointsTab'));
const HostGroups = lazy(() => import('./tabs/HostGroupsTab'));
const HostTimeline = lazy(() => import('./tabs/HostTimelineTab'));
const ProcessMonitor = lazy(() => import('./tabs/ProcessMonitorTab'));
const ProcessTree = lazy(() => import('./tabs/ProcessTreeTab'));
const Network = lazy(() => import('./tabs/NetworkTab'));
const AgentNetworkMap = lazy(() => import('./tabs/AgentNetworkMapTab'));
const SensorHealth = lazy(() => import('../overview/tabs/SensorHealthTab'));

const TABS = [
  { id: 'list', label: 'All Endpoints' },
  { id: 'groups', label: 'Host Groups' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'processes', label: 'Processes' },
  { id: 'network', label: 'Network' },
  { id: 'map', label: 'Agent Map' },
  { id: 'health', label: 'Sensor Health' },
];

const VALID = TABS.map((t) => t.id);

export default function EndpointsPage() {
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view');
  const defaultTab =
    view === 'processes'
      ? 'processes'
      : view === 'process-tree'
        ? 'processes'
        : view === 'timeline'
          ? 'timeline'
          : 'list';
  const { api } = useAuth();
  const [tab, setTab] = useConsoleTab(defaultTab, VALID);
  const { data: bff } = useConsoleBff(api, 'endpoints');
  const ep = bff?.kpis?.endpoints || {};
  const kpiItems = bff
    ? [
        { id: 'total', label: 'Endpoints', value: ep.total ?? '—' },
        { id: 'online', label: 'Online', value: ep.online ?? '—' },
      ]
    : [];

  return (
    <ConsolePage
      kicker="Console"
      title="Endpoints"
      description="Hosts, groups, process activity, network telemetry, and agent health."
      tabs={<TabNav tabs={TABS} activeTab={tab} onChange={setTab} ariaLabel="Endpoint sections" />}
    >
      {kpiItems.length > 0 && <KpiStrip items={kpiItems} />}
      {tab === 'list' && (
        <EmbeddedPanel label="Endpoints">
          <Endpoints />
        </EmbeddedPanel>
      )}
      {tab === 'groups' && (
        <EmbeddedPanel label="Host groups">
          <HostGroups />
        </EmbeddedPanel>
      )}
      {tab === 'timeline' && (
        <EmbeddedPanel label="Host timeline">
          <HostTimeline />
        </EmbeddedPanel>
      )}
      {tab === 'processes' && (
        <EmbeddedPanel label="Process monitor">
          {view === 'process-tree' ? <ProcessTree /> : <ProcessMonitor />}
        </EmbeddedPanel>
      )}
      {tab === 'network' && (
        <EmbeddedPanel label="Network">
          <Network />
        </EmbeddedPanel>
      )}
      {tab === 'map' && (
        <EmbeddedPanel label="Agent network map">
          <AgentNetworkMap />
        </EmbeddedPanel>
      )}
      {tab === 'health' && (
        <EmbeddedPanel label="Sensor health">
          <SensorHealth />
        </EmbeddedPanel>
      )}
    </ConsolePage>
  );
}
