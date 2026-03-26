import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { isJwtExpired } from './utils/jwt';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Endpoints from './pages/Endpoints';
import EndpointDetail from './pages/EndpointDetail';
import Events from './pages/Events';
import RawEvents from './pages/RawEvents';
import EventDetail from './pages/EventDetail';
import NormalizedEventDetail from './pages/NormalizedEventDetail';
import Alerts from './pages/Alerts';
import AlertDetail from './pages/AlertDetail';
import DetectionRules from './pages/DetectionRules';
import DetectionRuleDetail from './pages/DetectionRuleDetail';
import DetectionRuleEditor from './pages/DetectionRuleEditor';
import AuditLogs from './pages/AuditLogs';
import Investigations from './pages/Investigations';
import InvestigationDetail from './pages/InvestigationDetail';
import Incidents from './pages/Incidents';
import IncidentDetail from './pages/IncidentDetail';
import Risk from './pages/Risk';
import IOCs from './pages/IOCs';
import Policies from './pages/Policies';
import Triage from './pages/Triage';
import ProcessTree from './pages/ProcessTree';
import ProcessMonitor from './pages/ProcessMonitor';
import Network from './pages/Network';
import AvOverview from './pages/AvOverview';
import AvDetections from './pages/AvDetections';
import AvDetectionDetail from './pages/AvDetectionDetail';
import AvQuarantine from './pages/AvQuarantine';
import AvScanTasks from './pages/AvScanTasks';
import AvPolicies from './pages/AvPolicies';
import AvSignatures from './pages/AvSignatures';
import AvMalwareAlerts from './pages/AvMalwareAlerts';
import AvMalwareAlertDetail from './pages/AvMalwareAlertDetail';
import AvFileReputation from './pages/AvFileReputation';
import EnterpriseSettings from './pages/EnterpriseSettings';
import TenantManagement from './pages/TenantManagement';
import MsspConsole from './pages/MsspConsole';
import HostGroups from './pages/HostGroups';
import SensorHealth from './pages/SensorHealth';
import Hunting from './pages/Hunting';
import RtrConsole from './pages/RtrConsole';
import ThreatGraph from './pages/ThreatGraph';
import AnalyticsDetections from './pages/AnalyticsDetections';
import FalconRoadmapPage from './pages/FalconRoadmapPage';
import XdrEvents from './pages/XdrEvents';
import XdrDetections from './pages/XdrDetections';
import XdrRealtime from './pages/XdrRealtime';

function PrivateRoute({ children }) {
  const { token, logout } = useAuth();
  useEffect(() => {
    if (token && isJwtExpired(token)) logout();
  }, [token, logout]);
  if (!token || isJwtExpired(token)) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="endpoints" element={<Endpoints />} />
          <Route path="host-groups" element={<HostGroups />} />
          <Route path="sensor-health" element={<SensorHealth />} />
          <Route path="hunting" element={<Hunting />} />
          <Route path="rtr" element={<RtrConsole />} />
          <Route path="threat-graph" element={<ThreatGraph />} />
          <Route path="analytics-detections" element={<AnalyticsDetections />} />
          <Route path="falcon/:area" element={<FalconRoadmapPage />} />
          <Route path="xdr/events" element={<XdrEvents />} />
          <Route path="xdr/detections" element={<XdrDetections />} />
          <Route path="xdr/realtime" element={<XdrRealtime />} />
          <Route path="endpoints/:id" element={<EndpointDetail />} />
          <Route path="events" element={<Events />} />
          <Route path="raw-events" element={<RawEvents />} />
          <Route path="raw-events/:id" element={<EventDetail />} />
          <Route path="normalized-events/:id" element={<NormalizedEventDetail />} />
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
          <Route path="iocs" element={<IOCs />} />
          <Route path="policies" element={<Policies />} />
          <Route path="triage" element={<Triage />} />
          <Route path="endpoints/:endpointId/process-tree" element={<ProcessTree />} />
          <Route path="process-monitor" element={<ProcessMonitor />} />
          <Route path="network" element={<Network />} />
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
          <Route path="enterprise" element={<EnterpriseSettings />} />
          <Route path="tenants" element={<TenantManagement />} />
          <Route path="mssp" element={<MsspConsole />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
