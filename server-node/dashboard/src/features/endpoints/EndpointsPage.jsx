import React, { lazy } from 'react';
import { useSearchParams } from 'react-router-dom';
import ConsolePage from '../../components/ConsolePage';
import TabNav from '../../components/TabNav';
import EmbeddedPanel from '../../components/EmbeddedPanel';
import { useConsoleTab } from '../../utils/consoleTabs';

const Endpoints = lazy(() => import('../../pages/Endpoints'));
const HostGroups = lazy(() => import('../../pages/HostGroups'));
const HostTimeline = lazy(() => import('../../pages/HostTimeline'));
const ProcessMonitor = lazy(() => import('../../pages/ProcessMonitor'));
const ProcessTree = lazy(() => import('../../pages/ProcessTree'));
const Network = lazy(() => import('../../pages/Network'));
const AgentNetworkMap = lazy(() => import('../../pages/AgentNetworkMap'));
const SensorHealth = lazy(() => import('../../pages/SensorHealth'));

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
  const [tab, setTab] = useConsoleTab(defaultTab, VALID);

  return (
    <ConsolePage
      kicker="Console"
      title="Endpoints"
      description="Hosts, groups, process activity, network telemetry, and agent health."
      tabs={<TabNav tabs={TABS} activeTab={tab} onChange={setTab} ariaLabel="Endpoint sections" />}
    >
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
