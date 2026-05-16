import React, { lazy } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import ConsolePage from '../../components/ConsolePage';
import TabNav from '../../components/TabNav';
import EmbeddedPanel from '../../components/EmbeddedPanel';
import { useConsoleTab } from '../../utils/consoleTabs';

const EndpointDetail = lazy(() => import('../../pages/EndpointDetail'));
const HostTimeline = lazy(() => import('../../pages/HostTimeline'));
const ProcessMonitor = lazy(() => import('../../pages/ProcessMonitor'));
const ProcessTree = lazy(() => import('../../pages/ProcessTree'));
const Network = lazy(() => import('../../pages/Network'));
const ResponseApprovals = lazy(() => import('../../pages/ResponseApprovals'));

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'processes', label: 'Processes' },
  { id: 'network', label: 'Network' },
  { id: 'files', label: 'Files & Registry' },
  { id: 'events', label: 'Security Events' },
  { id: 'protection', label: 'Protection Status' },
  { id: 'response', label: 'Response' },
  { id: 'trust', label: 'Agent Trust' },
];

const VALID = TABS.map((t) => t.id);

export default function EndpointDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view');
  const defaultTab = view === 'timeline' ? 'timeline' : view === 'processes' ? 'processes' : 'overview';
  const [tab, setTab] = useConsoleTab(defaultTab, VALID);

  return (
    <ConsolePage
      kicker="Endpoint"
      title={`Host ${id}`}
      description="Endpoint detail, telemetry, protection, and response."
      tabs={<TabNav tabs={TABS} activeTab={tab} onChange={setTab} ariaLabel="Endpoint detail sections" />}
    >
      {tab === 'overview' && (
        <EmbeddedPanel label="Overview">
          <EndpointDetail />
        </EmbeddedPanel>
      )}
      {tab === 'timeline' && (
        <EmbeddedPanel label="Timeline">
          <HostTimeline />
        </EmbeddedPanel>
      )}
      {tab === 'processes' && (
        <EmbeddedPanel label="Processes">
          {view === 'process-tree' ? <ProcessTree /> : <ProcessMonitor />}
        </EmbeddedPanel>
      )}
      {tab === 'network' && (
        <EmbeddedPanel label="Network">
          <Network />
        </EmbeddedPanel>
      )}
      {tab === 'files' && (
        <EmbeddedPanel label="Files and registry">
          <EndpointDetail />
        </EmbeddedPanel>
      )}
      {tab === 'events' && (
        <EmbeddedPanel label="Security events">
          <HostTimeline />
        </EmbeddedPanel>
      )}
      {tab === 'protection' && (
        <EmbeddedPanel label="Protection">
          <EndpointDetail />
        </EmbeddedPanel>
      )}
      {tab === 'response' && (
        <EmbeddedPanel label="Response">
          <ResponseApprovals />
        </EmbeddedPanel>
      )}
      {tab === 'trust' && (
        <EmbeddedPanel label="Agent trust">
          <EndpointDetail />
        </EmbeddedPanel>
      )}
    </ConsolePage>
  );
}
