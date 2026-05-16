import React, { lazy } from 'react';
import ConsolePage from '../../components/ConsolePage';
import TabNav from '../../components/TabNav';
import EmbeddedPanel from '../../components/EmbeddedPanel';
import SocRouteGuard from '../../components/SocRouteGuard';
import { useConsoleTab } from '../../utils/consoleTabs';
import { canSeeEnterpriseSettings, canSeeMsspAndTenants, canSeeRbacAdmin } from '../../utils/socRoles';
import { useAuth } from '../../context/AuthContext';

const EnterpriseSettings = lazy(() => import('../../pages/EnterpriseSettings'));
const TenantManagement = lazy(() => import('../../pages/TenantManagement'));
const RbacManagement = lazy(() => import('../../pages/RbacManagement'));
const AuditLogs = lazy(() => import('../../pages/AuditLogs'));
const Reports = lazy(() => import('../../pages/Reports'));
const Integrations = lazy(() => import('../../pages/Integrations'));
const SystemHealth = lazy(() => import('../../pages/SystemHealth'));
const FalconRoadmapPage = lazy(() => import('../../pages/FalconRoadmapPage'));

const ALL_TABS = [
  { id: 'settings', label: 'Settings', guard: canSeeEnterpriseSettings },
  { id: 'tenants', label: 'Tenants', guard: canSeeMsspAndTenants },
  { id: 'rbac', label: 'RBAC', guard: canSeeRbacAdmin },
  { id: 'integrations', label: 'Integrations', guard: canSeeEnterpriseSettings },
  { id: 'audit', label: 'Audit Logs' },
  { id: 'reports', label: 'Reports', guard: canSeeEnterpriseSettings },
  { id: 'system-health', label: 'System Health' },
  { id: 'roadmap', label: 'Roadmap' },
];

export default function AdminPage() {
  const { user } = useAuth();
  const visibleTabs = ALL_TABS.filter((t) => !t.guard || t.guard(user)).map(({ id, label }) => ({ id, label }));
  const defaultTab = visibleTabs[0]?.id || 'audit';
  const valid = visibleTabs.map((t) => t.id);
  const [tab, setTab] = useConsoleTab(defaultTab, valid);

  return (
    <ConsolePage
      kicker="Console"
      title="Administration"
      description="Users, tenants, RBAC, integrations, audit logs, reports, and platform health."
      tabs={<TabNav tabs={visibleTabs} activeTab={tab} onChange={setTab} ariaLabel="Administration sections" />}
    >
      {tab === 'settings' && (
        <SocRouteGuard allow={canSeeEnterpriseSettings}>
          <EmbeddedPanel label="Settings">
            <EnterpriseSettings />
          </EmbeddedPanel>
        </SocRouteGuard>
      )}
      {tab === 'tenants' && (
        <SocRouteGuard allow={canSeeMsspAndTenants}>
          <EmbeddedPanel label="Tenants">
            <TenantManagement />
          </EmbeddedPanel>
        </SocRouteGuard>
      )}
      {tab === 'rbac' && (
        <SocRouteGuard allow={canSeeRbacAdmin}>
          <EmbeddedPanel label="RBAC">
            <RbacManagement />
          </EmbeddedPanel>
        </SocRouteGuard>
      )}
      {tab === 'integrations' && (
        <SocRouteGuard allow={canSeeEnterpriseSettings}>
          <EmbeddedPanel label="Integrations">
            <Integrations />
          </EmbeddedPanel>
        </SocRouteGuard>
      )}
      {tab === 'audit' && (
        <EmbeddedPanel label="Audit logs">
          <AuditLogs />
        </EmbeddedPanel>
      )}
      {tab === 'reports' && (
        <SocRouteGuard allow={canSeeEnterpriseSettings}>
          <EmbeddedPanel label="Reports">
            <Reports />
          </EmbeddedPanel>
        </SocRouteGuard>
      )}
      {tab === 'system-health' && (
        <EmbeddedPanel label="System health">
          <SystemHealth />
        </EmbeddedPanel>
      )}
      {tab === 'roadmap' && (
        <EmbeddedPanel label="Roadmap">
          <FalconRoadmapPage />
        </EmbeddedPanel>
      )}
    </ConsolePage>
  );
}
