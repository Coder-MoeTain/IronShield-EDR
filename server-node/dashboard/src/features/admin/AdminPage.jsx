import React, { lazy } from 'react';
import ConsolePage from '../../components/ConsolePage';
import TabNav from '../../components/TabNav';
import EmbeddedPanel from '../../components/EmbeddedPanel';
import SocRouteGuard from '../../components/SocRouteGuard';
import { useConsoleTab } from '../../utils/consoleTabs';
import { useAuth } from '../../context/AuthContext';
import ProductionReadinessPanel from '../../components/ProductionReadinessPanel';
import KpiStrip from '../../components/KpiStrip';
import { useConsoleBff } from '../../hooks/useConsoleBff';
import {
  canAccessAuditTab,
  canAccessIntegrationsTab,
  canAccessRbacTab,
  canAccessReportsTab,
  canAccessSettingsTab,
  canAccessSystemHealthTab,
  canAccessTenantsTab,
} from '../../routes/permissions';

const EnterpriseSettings = lazy(() => import('./tabs/EnterpriseSettingsTab'));
const TenantManagement = lazy(() => import('./tabs/TenantManagementTab'));
const RbacManagement = lazy(() => import('./tabs/RbacManagementTab'));
const AuditLogs = lazy(() => import('./tabs/AuditLogsTab'));
const Reports = lazy(() => import('../investigation/tabs/ReportsTab'));
const Integrations = lazy(() => import('./tabs/IntegrationsTab'));
const SystemHealth = lazy(() => import('../overview/tabs/SystemHealthTab'));
const FalconRoadmapPage = lazy(() => import('./tabs/FalconRoadmapPageTab'));

const ALL_TABS = [
  { id: 'settings', label: 'Settings', guard: canAccessSettingsTab },
  { id: 'tenants', label: 'Tenants', guard: canAccessTenantsTab },
  { id: 'rbac', label: 'RBAC', guard: canAccessRbacTab },
  { id: 'integrations', label: 'Integrations', guard: canAccessIntegrationsTab },
  { id: 'audit', label: 'Audit Logs', guard: canAccessAuditTab },
  { id: 'reports', label: 'Reports', guard: (u, p) => canAccessReportsTab(u, p) },
  { id: 'system-health', label: 'System Health', guard: canAccessSystemHealthTab },
  { id: 'roadmap', label: 'Roadmap' },
];

export default function AdminPage() {
  const { user, permissions, api } = useAuth();
  const { data: bff } = useConsoleBff(api, 'admin');
  const kpiItems = bff
    ? [
        { id: 'tenants', label: 'Tenants', value: bff.kpis?.tenants?.total ?? '—' },
        {
          id: 'ready',
          label: 'Readiness',
          value: bff.production_readiness?.score != null ? `${bff.production_readiness.score}%` : '—',
        },
      ]
    : [];
  const visibleTabs = ALL_TABS.filter((t) => !t.guard || t.guard(user, permissions)).map(({ id, label }) => ({
    id,
    label,
  }));
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
      {kpiItems.length > 0 && <KpiStrip items={kpiItems} />}
      {(tab === 'system-health' || tab === 'settings') && <ProductionReadinessPanel />}
      {tab === 'settings' && (
        <SocRouteGuard allow={canAccessSettingsTab}>
          <EmbeddedPanel label="Settings">
            <EnterpriseSettings />
          </EmbeddedPanel>
        </SocRouteGuard>
      )}
      {tab === 'tenants' && (
        <SocRouteGuard allow={canAccessTenantsTab}>
          <EmbeddedPanel label="Tenants">
            <TenantManagement />
          </EmbeddedPanel>
        </SocRouteGuard>
      )}
      {tab === 'rbac' && (
        <SocRouteGuard allow={canAccessRbacTab}>
          <EmbeddedPanel label="RBAC">
            <RbacManagement />
          </EmbeddedPanel>
        </SocRouteGuard>
      )}
      {tab === 'integrations' && (
        <SocRouteGuard allow={canAccessIntegrationsTab}>
          <EmbeddedPanel label="Integrations">
            <Integrations />
          </EmbeddedPanel>
        </SocRouteGuard>
      )}
      {tab === 'audit' && (
        <SocRouteGuard allow={canAccessAuditTab}>
          <EmbeddedPanel label="Audit logs">
            <AuditLogs />
          </EmbeddedPanel>
        </SocRouteGuard>
      )}
      {tab === 'reports' && (
        <SocRouteGuard allow={(u) => canAccessReportsTab(u, permissions)}>
          <EmbeddedPanel label="Reports">
            <Reports />
          </EmbeddedPanel>
        </SocRouteGuard>
      )}
      {tab === 'system-health' && (
        <SocRouteGuard allow={canAccessSystemHealthTab}>
          <EmbeddedPanel label="System health">
            <SystemHealth />
          </EmbeddedPanel>
        </SocRouteGuard>
      )}
      {tab === 'roadmap' && (
        <EmbeddedPanel label="Roadmap">
          <FalconRoadmapPage />
        </EmbeddedPanel>
      )}
    </ConsolePage>
  );
}
