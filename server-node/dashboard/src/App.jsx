import React, { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import AppErrorBoundary from './components/AppErrorBoundary';
import SocRouteGuard from './components/SocRouteGuard';
import Layout from './components/Layout';
import Login from './pages/Login';
import { canSeeEnterpriseSettings, canSeeMsspAndTenants, canSeeRbacAdmin } from './utils/socRoles';
import { isJwtExpired } from './utils/jwt';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Endpoints = lazy(() => import('./pages/Endpoints'));
const EndpointDetail = lazy(() => import('./pages/EndpointDetail'));
const Events = lazy(() => import('./pages/Events'));
const NormalizedEvents = lazy(() => import('./pages/NormalizedEvents'));
const RawEvents = lazy(() => import('./pages/RawEvents'));
const EventDetail = lazy(() => import('./pages/EventDetail'));
const NormalizedEventDetail = lazy(() => import('./pages/NormalizedEventDetail'));
const Alerts = lazy(() => import('./pages/Alerts'));
const AlertDetail = lazy(() => import('./pages/AlertDetail'));
const DetectionRules = lazy(() => import('./pages/DetectionRules'));
const DetectionRuleDetail = lazy(() => import('./pages/DetectionRuleDetail'));
const DetectionRuleEditor = lazy(() => import('./pages/DetectionRuleEditor'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));
const Investigations = lazy(() => import('./pages/Investigations'));
const InvestigationDetail = lazy(() => import('./pages/InvestigationDetail'));
const Incidents = lazy(() => import('./pages/Incidents'));
const IncidentDetail = lazy(() => import('./pages/IncidentDetail'));
const Risk = lazy(() => import('./pages/Risk'));
const IOCs = lazy(() => import('./pages/IOCs'));
const WebUrlProtection = lazy(() => import('./pages/WebUrlProtection'));
const Policies = lazy(() => import('./pages/Policies'));
const Triage = lazy(() => import('./pages/Triage'));
const ProcessTree = lazy(() => import('./pages/ProcessTree'));
const ProcessMonitor = lazy(() => import('./pages/ProcessMonitor'));
const Network = lazy(() => import('./pages/Network'));
const AvOverview = lazy(() => import('./pages/AvOverview'));
const AvDetections = lazy(() => import('./pages/AvDetections'));
const AvDetectionDetail = lazy(() => import('./pages/AvDetectionDetail'));
const AvQuarantine = lazy(() => import('./pages/AvQuarantine'));
const AvScanTasks = lazy(() => import('./pages/AvScanTasks'));
const AvPolicies = lazy(() => import('./pages/AvPolicies'));
const AvSignatures = lazy(() => import('./pages/AvSignatures'));
const AvMalwareAlerts = lazy(() => import('./pages/AvMalwareAlerts'));
const AvMalwareAlertDetail = lazy(() => import('./pages/AvMalwareAlertDetail'));
const AvFileReputation = lazy(() => import('./pages/AvFileReputation'));
const ProtectionCapabilities = lazy(() => import('./pages/ProtectionCapabilities'));
const EnterpriseSettings = lazy(() => import('./pages/EnterpriseSettings'));
const TenantManagement = lazy(() => import('./pages/TenantManagement'));
const MsspConsole = lazy(() => import('./pages/MsspConsole'));
const HostGroups = lazy(() => import('./pages/HostGroups'));
const SensorHealth = lazy(() => import('./pages/SensorHealth'));
const Hunting = lazy(() => import('./pages/Hunting'));
const RtrConsole = lazy(() => import('./pages/RtrConsole'));
const ThreatGraph = lazy(() => import('./pages/ThreatGraph'));
const AgentNetworkMap = lazy(() => import('./pages/AgentNetworkMap'));
const AnalyticsDetections = lazy(() => import('./pages/AnalyticsDetections'));
const FalconRoadmapPage = lazy(() => import('./pages/FalconRoadmapPage'));
const XdrOverview = lazy(() => import('./pages/XdrOverview'));
const XdrEvents = lazy(() => import('./pages/XdrEvents'));
const XdrDetections = lazy(() => import('./pages/XdrDetections'));
const XdrRealtime = lazy(() => import('./pages/XdrRealtime'));
const ResponseApprovals = lazy(() => import('./pages/ResponseApprovals'));
const RbacManagement = lazy(() => import('./pages/RbacManagement'));
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
                  <Route index element={<Dashboard />} />
                  <Route path="dashboard" element={<Navigate to="/" replace />} />
                  <Route path="endpoints" element={<Endpoints />} />
                  <Route path="host-groups" element={<HostGroups />} />
                  <Route path="sensor-health" element={<SensorHealth />} />
                  <Route path="hunting" element={<Hunting />} />
                  <Route path="rtr" element={<RtrConsole />} />
                  <Route path="threat-graph" element={<ThreatGraph />} />
                  <Route path="agent-network-map" element={<AgentNetworkMap />} />
                  <Route path="analytics-detections" element={<AnalyticsDetections />} />
                  <Route path="falcon/:area" element={<FalconRoadmapPage />} />
                  <Route path="xdr" element={<XdrOverview />} />
                  <Route path="xdr/events" element={<XdrEvents />} />
                  <Route path="xdr/detections" element={<XdrDetections />} />
                  <Route path="xdr/realtime" element={<XdrRealtime />} />
                  <Route path="endpoints/:id" element={<EndpointDetail />} />
                  <Route path="events" element={<Events />} />
                  <Route path="normalized-events" element={<NormalizedEvents />} />
                  <Route path="normalized-events/:id" element={<NormalizedEventDetail />} />
                  <Route path="raw-events" element={<RawEvents />} />
                  <Route path="raw-events/:id" element={<EventDetail />} />
                  <Route path="alerts" element={<Alerts />} />
                  <Route path="alerts/:id" element={<AlertDetail />} />
                  <Route path="detection-rules" element={<DetectionRules />} />
                  <Route path="detection-rules/new" element={<DetectionRuleEditor />} />
                  <Route path="detection-rules/:id/edit" element={<DetectionRuleEditor />} />
                  <Route path="detection-rules/:id" element={<DetectionRuleDetail />} />
                  <Route path="suppressions" element={<Navigate to="/detection-rules?tab=suppressions" replace />} />
                  <Route path="playbooks" element={<Navigate to="/triage?tab=playbooks" replace />} />
                  <Route path="audit-logs" element={<AuditLogs />} />
                  <Route path="investigations" element={<Investigations />} />
                  <Route path="investigations/:id" element={<InvestigationDetail />} />
                  <Route path="incidents" element={<Incidents />} />
                  <Route path="incidents/:id" element={<IncidentDetail />} />
                  <Route path="risk" element={<Risk />} />
                  <Route path="web-url-protection" element={<WebUrlProtection />} />
                  <Route path="iocs" element={<IOCs />} />
                  <Route path="policies" element={<Policies />} />
                  <Route path="triage" element={<Triage />} />
                  <Route path="endpoints/:endpointId/process-tree" element={<ProcessTree />} />
                  <Route path="process-monitor" element={<ProcessMonitor />} />
                  <Route path="network" element={<Network />} />
                  <Route path="respond/approvals" element={<ResponseApprovals />} />
                  <Route path="protection" element={<ProtectionCapabilities />} />
                  <Route path="av" element={<AvOverview />} />
                  <Route path="av/detections" element={<AvDetections />} />
                  <Route path="av/detections/:id" element={<AvDetectionDetail />} />
                  <Route path="av/quarantine" element={<AvQuarantine />} />
                  <Route path="av/scan-tasks" element={<AvScanTasks />} />
                  <Route path="av/policies" element={<AvPolicies />} />
                  <Route path="av/signatures" element={<AvSignatures />} />
                  <Route path="av/reputation" element={<AvFileReputation />} />
                  <Route path="av/malware-alerts" element={<AvMalwareAlerts />} />
                  <Route path="av/malware-alerts/:id" element={<AvMalwareAlertDetail />} />
                  <Route
                    path="enterprise"
                    element={
                      <SocRouteGuard allow={canSeeEnterpriseSettings}>
                        <EnterpriseSettings />
                      </SocRouteGuard>
                    }
                  />
                  <Route
                    path="tenants"
                    element={
                      <SocRouteGuard allow={canSeeMsspAndTenants}>
                        <TenantManagement />
                      </SocRouteGuard>
                    }
                  />
                  <Route
                    path="mssp"
                    element={
                      <SocRouteGuard allow={canSeeMsspAndTenants}>
                        <MsspConsole />
                      </SocRouteGuard>
                    }
                  />
                  <Route
                    path="rbac"
                    element={
                      <SocRouteGuard allow={canSeeRbacAdmin}>
                        <RbacManagement />
                      </SocRouteGuard>
                    }
                  />
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
