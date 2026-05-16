import { lazy } from 'react';
import { Navigate } from 'react-router-dom';
import SocRouteGuard from '../components/SocRouteGuard';
import RedirectPreserve from '../components/RedirectPreserve';
import {
  LegacyAlertRedirect,
  LegacyCaseRedirect,
  LegacyIncidentRedirect,
  LegacyMalwareAlertRedirect,
} from '../components/LegacyRedirects';
import { LegacyRuleDetailRedirect, LegacyRuleEditRedirect } from '../components/LegacyRuleRedirects';
import { canAccessAdminShell } from './permissions';
import { LEGACY_REDIRECT_ROUTES } from './legacyRedirects';

const OverviewPage = lazy(() => import('../features/overview/OverviewPage'));
const EndpointsPage = lazy(() => import('../features/endpoints/EndpointsPage'));
const EndpointDetailPage = lazy(() => import('../features/endpoints/EndpointDetailPage'));
const DetectionsPage = lazy(() => import('../features/detections/DetectionsPage'));
const AlertDetailPage = lazy(() => import('../features/detections/AlertDetailPage'));
const InvestigationPage = lazy(() => import('../features/investigation/InvestigationPage'));
const InvestigationDetailPage = lazy(() => import('../features/investigation/InvestigationDetailPage'));
const ResponsePage = lazy(() => import('../features/response/ResponsePage'));
const HuntingPage = lazy(() => import('../features/hunting/HuntingPage'));
const ProtectionPage = lazy(() => import('../features/protection/ProtectionPage'));
const AdminPage = lazy(() => import('../features/admin/AdminPage'));

const DetectionRuleEditor = lazy(() => import('../features/detections/DetectionRuleEditorPage'));
const DetectionRuleDetail = lazy(() => import('../features/detections/DetectionRuleDetailPage'));
const EventDetail = lazy(() => import('../features/hunting/EventDetailPage'));
const NormalizedEventDetail = lazy(() => import('../features/hunting/NormalizedEventDetailPage'));
const AvDetectionDetail = lazy(() => import('../features/protection/AvDetectionDetailPage'));
const FalconRoadmapPage = lazy(() => import('../features/admin/tabs/FalconRoadmapPageTab'));
const NotFound = lazy(() => import('../pages/NotFound'));

/** Compact console routes (under Layout). */
export const CONSOLE_ROUTES = [
  { index: true, element: <Navigate to="/overview" replace /> },
  { path: 'overview', element: <OverviewPage /> },
  { path: 'endpoints', element: <EndpointsPage /> },
  { path: 'endpoints/:id', element: <EndpointDetailPage /> },
  { path: 'detections', element: <DetectionsPage /> },
  { path: 'detections/alerts/:id', element: <AlertDetailPage /> },
  { path: 'detections/rules/new', element: <DetectionRuleEditor /> },
  { path: 'detections/rules/:id/edit', element: <DetectionRuleEditor /> },
  { path: 'detections/rules/:id', element: <DetectionRuleDetail /> },
  { path: 'investigation', element: <InvestigationPage /> },
  { path: 'investigation/incidents/:id', element: <InvestigationDetailPage /> },
  { path: 'investigation/cases/:id', element: <InvestigationDetailPage /> },
  { path: 'investigation/:id', element: <InvestigationDetailPage /> },
  { path: 'response', element: <ResponsePage /> },
  { path: 'hunting', element: <HuntingPage /> },
  { path: 'protection', element: <ProtectionPage /> },
  {
    path: 'admin',
    element: (
      <SocRouteGuard allow={canAccessAdminShell}>
        <AdminPage />
      </SocRouteGuard>
    ),
  },
];

/** Standalone detail routes (legacy paths, not redirected). */
export const STANDALONE_ROUTES = [
  { path: 'raw-events/:id', element: <EventDetail /> },
  { path: 'normalized-events/:id', element: <NormalizedEventDetail /> },
  { path: 'av/detections/:id', element: <AvDetectionDetail /> },
  { path: 'falcon/:area', element: <FalconRoadmapPage /> },
  { path: '*', element: <NotFound /> },
];

function legacyElement(def) {
  switch (def.type) {
    case 'navigate':
      return <Navigate to={def.to} replace />;
    case 'preserve':
      return (
        <RedirectPreserve to={def.to} defaultTab={def.defaultTab} defaultView={def.defaultView} />
      );
    case 'legacy-alert':
      return <LegacyAlertRedirect />;
    case 'legacy-incident':
      return <LegacyIncidentRedirect />;
    case 'legacy-case':
      return <LegacyCaseRedirect />;
    case 'legacy-malware-alert':
      return <LegacyMalwareAlertRedirect />;
    case 'legacy-rule-detail':
      return <LegacyRuleDetailRedirect />;
    case 'legacy-rule-edit':
      return <LegacyRuleEditRedirect />;
    default:
      return <NotFound />;
  }
}

/** Build React Router route objects from legacy redirect table. */
export function buildLegacyRoutes() {
  return LEGACY_REDIRECT_ROUTES.map((def) => ({
    path: def.path,
    element: legacyElement(def),
  }));
}

export function getAllLayoutRoutes() {
  return [...CONSOLE_ROUTES, ...buildLegacyRoutes(), ...STANDALONE_ROUTES];
}
