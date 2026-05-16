import React, { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import AppErrorBoundary from './components/AppErrorBoundary';
import SocRouteGuard from './components/SocRouteGuard';
import Layout from './components/Layout';
import RedirectPreserve from './components/RedirectPreserve';
import {
  LegacyAlertRedirect,
  LegacyCaseRedirect,
  LegacyIncidentRedirect,
  LegacyMalwareAlertRedirect,
} from './components/LegacyRedirects';
import Login from './pages/Login';
import { canSeeEnterpriseSettings, canSeeMsspAndTenants, canSeeRbacAdmin } from './utils/socRoles';
import { isJwtExpired } from './utils/jwt';

const OverviewPage = lazy(() => import('./features/overview/OverviewPage'));
const EndpointsPage = lazy(() => import('./features/endpoints/EndpointsPage'));
const EndpointDetailPage = lazy(() => import('./features/endpoints/EndpointDetailPage'));
const DetectionsPage = lazy(() => import('./features/detections/DetectionsPage'));
const AlertDetailPage = lazy(() => import('./features/detections/AlertDetailPage'));
const InvestigationPage = lazy(() => import('./features/investigation/InvestigationPage'));
const InvestigationDetailPage = lazy(() => import('./features/investigation/InvestigationDetailPage'));
const ResponsePage = lazy(() => import('./features/response/ResponsePage'));
const HuntingPage = lazy(() => import('./features/hunting/HuntingPage'));
const ProtectionPage = lazy(() => import('./features/protection/ProtectionPage'));
const AdminPage = lazy(() => import('./features/admin/AdminPage'));

const DetectionRuleEditor = lazy(() => import('./pages/DetectionRuleEditor'));
const DetectionRuleDetail = lazy(() => import('./pages/DetectionRuleDetail'));
const EventDetail = lazy(() => import('./pages/EventDetail'));
const NormalizedEventDetail = lazy(() => import('./pages/NormalizedEventDetail'));
const AvDetectionDetail = lazy(() => import('./pages/AvDetectionDetail'));
const FalconRoadmapPage = lazy(() => import('./pages/FalconRoadmapPage'));
const NotFound = lazy(() => import('./pages/NotFound'));

function RouteFallback() {
  return (
    <div className="ui-route-fallback" role="status" aria-live="polite" aria-label="Loading view">
      Loading…
    </div>
  );
}

function PrivateRoute({ children }) {
  const { token, logout, sessionReady } = useAuth();
  useEffect(() => {
    if (token && isJwtExpired(token)) logout();
  }, [token, logout]);
  if (!sessionReady) {
    return (
      <div className="ui-loading" role="status" style={{ padding: '2rem', textAlign: 'center' }}>
        Loading session…
      </div>
    );
  }
  if (!token || isJwtExpired(token)) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <AppErrorBoundary>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                  path="/"
                  element={
                    <PrivateRoute>
                      <Layout />
                    </PrivateRoute>
                  }
                >
                  <Route index element={<Navigate to="/overview" replace />} />
                  <Route path="overview" element={<OverviewPage />} />
                  <Route path="endpoints" element={<EndpointsPage />} />
                  <Route path="endpoints/:id" element={<EndpointDetailPage />} />
                  <Route path="detections" element={<DetectionsPage />} />
                  <Route path="detections/alerts/:id" element={<AlertDetailPage />} />
                  <Route path="detections/rules/new" element={<DetectionRuleEditor />} />
                  <Route path="detections/rules/:id/edit" element={<DetectionRuleEditor />} />
                  <Route path="detections/rules/:id" element={<DetectionRuleDetail />} />
                  <Route path="investigation" element={<InvestigationPage />} />
                  <Route path="investigation/incidents/:id" element={<InvestigationDetailPage />} />
                  <Route path="investigation/cases/:id" element={<InvestigationDetailPage />} />
                  <Route path="investigation/:id" element={<InvestigationDetailPage />} />
                  <Route path="response" element={<ResponsePage />} />
                  <Route path="hunting" element={<HuntingPage />} />
                  <Route path="protection" element={<ProtectionPage />} />
                  <Route
                    path="admin"
                    element={
                      <SocRouteGuard allow={(u) => canSeeEnterpriseSettings(u) || canSeeMsspAndTenants(u) || canSeeRbacAdmin(u) || u?.role === 'viewer'}>
                        <AdminPage />
                      </SocRouteGuard>
                    }
                  />

                  {/* Legacy redirects → compact console */}
                  <Route path="dashboard" element={<Navigate to="/overview" replace />} />
                  <Route path="alerts" element={<RedirectPreserve to="/detections" defaultTab="alerts" />} />
                  <Route path="alerts/:id" element={<LegacyAlertRedirect />} />
                  <Route path="triage" element={<RedirectPreserve to="/detections" defaultTab="triage" />} />
                  <Route path="soc/triage" element={<RedirectPreserve to="/detections" defaultTab="triage" />} />
                  <Route path="detection-rules" element={<RedirectPreserve to="/detections" defaultTab="rules" />} />
                  <Route path="detection-rules/new" element={<Navigate to="/detections/rules/new" replace />} />
                  <Route path="detection-rules/:id/edit" element={<Navigate to="/detections/rules/:id/edit" replace />} />
                  <Route path="detection-rules/:id" element={<Navigate to="/detections/rules/:id" replace />} />
                  <Route path="mitre" element={<RedirectPreserve to="/detections" defaultTab="mitre" />} />
                  <Route path="suppressions" element={<RedirectPreserve to="/detections" defaultTab="suppressions" />} />
                  <Route path="events" element={<RedirectPreserve to="/hunting" defaultTab="events" />} />
                  <Route path="raw-events" element={<RedirectPreserve to="/hunting" defaultTab="raw" />} />
                  <Route path="raw-events/:id" element={<EventDetail />} />
                  <Route path="normalized-events" element={<RedirectPreserve to="/hunting" defaultTab="normalized" />} />
                  <Route path="normalized-events/:id" element={<NormalizedEventDetail />} />
                  <Route path="xdr" element={<RedirectPreserve to="/overview" defaultTab="soc" />} />
                  <Route path="xdr/events" element={<RedirectPreserve to="/hunting" defaultTab="xdr-events" />} />
                  <Route path="xdr/detections" element={<RedirectPreserve to="/detections" defaultTab="xdr" />} />
                  <Route path="xdr/realtime" element={<RedirectPreserve to="/hunting" defaultTab="realtime" />} />
                  <Route path="network" element={<RedirectPreserve to="/hunting" defaultTab="network" />} />
                  <Route path="iocs" element={<RedirectPreserve to="/hunting" defaultTab="iocs" />} />
                  <Route path="process-monitor" element={<RedirectPreserve to="/endpoints" defaultView="processes" />} />
                  <Route path="endpoints/:endpointId/process-tree" element={<RedirectPreserve to="/endpoints" defaultView="process-tree" />} />
                  <Route path="host-timeline" element={<RedirectPreserve to="/endpoints" defaultView="timeline" />} />
                  <Route path="hosts/:endpointId/timeline" element={<RedirectPreserve to="/endpoints" defaultView="timeline" />} />
                  <Route path="host-groups" element={<RedirectPreserve to="/endpoints" defaultTab="groups" />} />
                  <Route path="sensor-health" element={<RedirectPreserve to="/overview" defaultTab="agent-health" />} />
                  <Route path="av" element={<Navigate to="/protection" replace />} />
                  <Route path="av/detections" element={<RedirectPreserve to="/protection" defaultTab="detections" />} />
                  <Route path="av/detections/:id" element={<AvDetectionDetail />} />
                  <Route path="av/quarantine" element={<RedirectPreserve to="/protection" defaultTab="quarantine" />} />
                  <Route path="av/scan-tasks" element={<RedirectPreserve to="/protection" defaultTab="scans" />} />
                  <Route path="av/policies" element={<RedirectPreserve to="/protection" defaultTab="policies" />} />
                  <Route path="av/signatures" element={<RedirectPreserve to="/protection" defaultTab="signatures" />} />
                  <Route path="av/reputation" element={<RedirectPreserve to="/protection" defaultTab="reputation" />} />
                  <Route path="av/malware-alerts" element={<RedirectPreserve to="/detections" defaultTab="alerts" />} />
                  <Route path="av/malware-alerts/:id" element={<LegacyMalwareAlertRedirect />} />
                  <Route path="incidents" element={<RedirectPreserve to="/investigation" defaultTab="incidents" />} />
                  <Route path="incidents/:id" element={<LegacyIncidentRedirect />} />
                  <Route path="investigations" element={<RedirectPreserve to="/investigation" defaultTab="cases" />} />
                  <Route path="investigations/:id" element={<LegacyCaseRedirect />} />
                  <Route path="threat-graph" element={<RedirectPreserve to="/investigation" defaultTab="graph" />} />
                  <Route path="respond/approvals" element={<RedirectPreserve to="/response" defaultTab="approvals" />} />
                  <Route path="rtr" element={<RedirectPreserve to="/response" defaultTab="rtr" />} />
                  <Route path="playbooks" element={<RedirectPreserve to="/response" defaultTab="playbooks" />} />
                  <Route path="enterprise" element={<RedirectPreserve to="/admin" defaultTab="settings" />} />
                  <Route path="tenants" element={<RedirectPreserve to="/admin" defaultTab="tenants" />} />
                  <Route path="mssp" element={<RedirectPreserve to="/overview" defaultTab="tenant" />} />
                  <Route path="rbac" element={<RedirectPreserve to="/admin" defaultTab="rbac" />} />
                  <Route path="audit-logs" element={<RedirectPreserve to="/admin" defaultTab="audit" />} />
                  <Route path="reports" element={<RedirectPreserve to="/admin" defaultTab="reports" />} />
                  <Route path="integrations" element={<RedirectPreserve to="/admin" defaultTab="integrations" />} />
                  <Route path="system/health" element={<RedirectPreserve to="/admin" defaultTab="system-health" />} />
                  <Route path="analytics-detections" element={<RedirectPreserve to="/detections" defaultTab="analytics" />} />
                  <Route path="risk" element={<RedirectPreserve to="/overview" defaultTab="executive" />} />
                  <Route path="web-url-protection" element={<RedirectPreserve to="/hunting" defaultTab="web" />} />
                  <Route path="policies" element={<RedirectPreserve to="/protection" defaultTab="policies" />} />
                  <Route path="agent-network-map" element={<RedirectPreserve to="/endpoints" defaultTab="map" />} />
                  <Route path="falcon/:area" element={<FalconRoadmapPage />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </Suspense>
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </AppErrorBoundary>
  );
}
