import React, { lazy } from 'react';
import { useAuth } from '../../context/AuthContext';
import ConsolePage from '../../components/ConsolePage';
import TabNav from '../../components/TabNav';
import EmbeddedPanel from '../../components/EmbeddedPanel';
import KpiStrip from '../../components/KpiStrip';
import { useConsoleTab } from '../../utils/consoleTabs';
import { useConsoleBff } from '../../hooks/useConsoleBff';

const Hunting = lazy(() => import('./tabs/HuntingTab'));
const Events = lazy(() => import('./tabs/EventsTab'));
const RawEvents = lazy(() => import('./tabs/RawEventsTab'));
const NormalizedEvents = lazy(() => import('./tabs/NormalizedEventsTab'));
const XdrEvents = lazy(() => import('./tabs/XdrEventsTab'));
const XdrRealtime = lazy(() => import('./tabs/XdrRealtimeTab'));
const Network = lazy(() => import('../endpoints/tabs/NetworkTab'));
const IOCs = lazy(() => import('./tabs/IOCsTab'));
const WebUrlProtection = lazy(() => import('./tabs/WebUrlProtectionTab'));

const TABS = [
  { id: 'search', label: 'Search' },
  { id: 'events', label: 'Events' },
  { id: 'raw', label: 'Raw Events' },
  { id: 'normalized', label: 'Normalized' },
  { id: 'network', label: 'Network' },
  { id: 'xdr-events', label: 'XDR Events' },
  { id: 'realtime', label: 'Realtime Feed' },
  { id: 'iocs', label: 'IOC Watchlist' },
  { id: 'web', label: 'Web/URL Protection' },
  { id: 'saved', label: 'Saved Queries' },
];

const VALID = TABS.map((t) => t.id);

export default function HuntingPage() {
  const { api } = useAuth();
  const [tab, setTab] = useConsoleTab('search', VALID);
  const { data: bff } = useConsoleBff(api, 'hunting');
  const kpiItems = bff
    ? [{ id: 'evt', label: 'Events today', value: bff.kpis?.events_today ?? '—' }]
    : [];

  return (
    <ConsolePage
      kicker="Console"
      title="Threat Hunting"
      description="Search, events, network telemetry, XDR streams, IOCs, and saved queries. Press Ctrl+K for global search."
      actions={<span className="ui-muted" style={{ fontSize: '0.8rem' }}>Ctrl+K</span>}
      tabs={<TabNav tabs={TABS} activeTab={tab} onChange={setTab} ariaLabel="Threat hunting sections" />}
    >
      {kpiItems.length > 0 && <KpiStrip items={kpiItems} />}
      {tab === 'search' && (
        <EmbeddedPanel label="Hunt search">
          <Hunting />
        </EmbeddedPanel>
      )}
      {tab === 'events' && (
        <EmbeddedPanel label="Events">
          <Events />
        </EmbeddedPanel>
      )}
      {tab === 'raw' && (
        <EmbeddedPanel label="Raw events">
          <RawEvents />
        </EmbeddedPanel>
      )}
      {tab === 'normalized' && (
        <EmbeddedPanel label="Normalized events">
          <NormalizedEvents />
        </EmbeddedPanel>
      )}
      {tab === 'network' && (
        <EmbeddedPanel label="Network">
          <Network />
        </EmbeddedPanel>
      )}
      {tab === 'xdr-events' && (
        <EmbeddedPanel label="XDR events">
          <XdrEvents />
        </EmbeddedPanel>
      )}
      {tab === 'realtime' && (
        <EmbeddedPanel label="Realtime feed">
          <XdrRealtime />
        </EmbeddedPanel>
      )}
      {tab === 'iocs' && (
        <EmbeddedPanel label="IOC watchlist">
          <IOCs />
        </EmbeddedPanel>
      )}
      {tab === 'web' && (
        <EmbeddedPanel label="Web URL protection">
          <WebUrlProtection />
        </EmbeddedPanel>
      )}
      {tab === 'saved' && (
        <EmbeddedPanel label="Saved queries">
          <Hunting />
        </EmbeddedPanel>
      )}
    </ConsolePage>
  );
}
