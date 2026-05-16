import React, { lazy } from 'react';
import { useAuth } from '../../context/AuthContext';
import ConsolePage from '../../components/ConsolePage';
import TabNav from '../../components/TabNav';
import EmbeddedPanel from '../../components/EmbeddedPanel';
import { useConsoleTab } from '../../utils/consoleTabs';
import { isReadOnlyViewer } from '../../utils/socRoles';

const ResponseApprovals = lazy(() => import('./tabs/ResponseApprovalsTab'));
const RtrConsole = lazy(() => import('./tabs/RtrConsoleTab'));
const Playbooks = lazy(() => import('./tabs/PlaybooksTab'));
const Triage = lazy(() => import('./tabs/TriageTab'));
const AvQuarantine = lazy(() => import('./tabs/AvQuarantineTab'));

const TABS = [
  { id: 'approvals', label: 'Pending Approvals' },
  { id: 'active', label: 'Active Actions' },
  { id: 'rtr', label: 'RTR Sessions' },
  { id: 'playbooks', label: 'Playbooks' },
  { id: 'quarantine', label: 'Quarantine' },
  { id: 'history', label: 'Action History' },
];

const VALID = TABS.map((t) => t.id);

export default function ResponsePage() {
  const { user } = useAuth();
  const readOnly = isReadOnlyViewer(user);
  const [tab, setTab] = useConsoleTab('approvals', VALID);

  const tabs = TABS.map((t) => ({
    ...t,
    disabled: readOnly && (t.id === 'rtr' || t.id === 'quarantine' || t.id === 'playbooks'),
    title: readOnly ? 'Read-only users cannot run destructive response actions' : undefined,
  }));

  return (
    <ConsolePage
      kicker="Console"
      title="Response"
      description="Approvals, remote response, playbooks, quarantine, and action history. High-risk actions require approval."
      tabs={<TabNav tabs={tabs} activeTab={tab} onChange={setTab} ariaLabel="Response sections" />}
    >
      {tab === 'approvals' && (
        <EmbeddedPanel label="Pending approvals">
          <ResponseApprovals />
        </EmbeddedPanel>
      )}
      {tab === 'active' && (
        <EmbeddedPanel label="Active actions">
          <Triage />
        </EmbeddedPanel>
      )}
      {tab === 'rtr' && !readOnly && (
        <EmbeddedPanel label="RTR sessions">
          <RtrConsole />
        </EmbeddedPanel>
      )}
      {tab === 'playbooks' && !readOnly && (
        <EmbeddedPanel label="Playbooks">
          <Playbooks embedded />
        </EmbeddedPanel>
      )}
      {tab === 'quarantine' && !readOnly && (
        <EmbeddedPanel label="Quarantine">
          <AvQuarantine />
        </EmbeddedPanel>
      )}
      {tab === 'history' && (
        <EmbeddedPanel label="Action history">
          <ResponseApprovals />
        </EmbeddedPanel>
      )}
    </ConsolePage>
  );
}
