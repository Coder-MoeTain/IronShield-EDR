/**
 * Admin API routes - Phase C: tenant scoping + RBAC
 */
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authAdmin } = require('../middleware/auth');
const { attachTenant } = require('../middleware/tenantMiddleware');
const { requirePermission, requireAnyPermission } = require('../middleware/rbac');

router.use(authAdmin);
router.use(attachTenant);

// Phase 7: Antivirus (mount early to avoid param route conflicts)
const avController = require('../controllers/avController');
router.get('/av/dashboard/summary', avController.getDashboardSummary);
router.post('/av/seed-test-data', avController.seedTestData);
router.get('/av/detections', avController.listDetections);
router.get('/av/detections/:id', avController.getDetection);
router.get('/av/quarantine', avController.listQuarantine);
router.post('/av/quarantine/:id/restore', requireAnyPermission('actions:write', '*'), avController.restoreQuarantine);
router.post('/av/quarantine/:id/delete', requireAnyPermission('actions:write', '*'), avController.deleteQuarantine);
router.get('/av/policies', avController.listPolicies);
router.post('/av/policies', requireAnyPermission('actions:write', '*'), avController.createPolicy);
router.put('/av/policies/:id', requireAnyPermission('actions:write', '*'), avController.updatePolicy);
router.get('/av/signatures', avController.listSignatures);
router.post('/av/signatures', requireAnyPermission('actions:write', '*'), avController.createSignature);
router.put('/av/signatures/:id', requireAnyPermission('actions:write', '*'), avController.updateSignature);
router.get('/av/exclusions', avController.listExclusions);
router.post('/av/exclusions', requireAnyPermission('actions:write', '*'), avController.createExclusion);
router.delete('/av/exclusions/:id', requireAnyPermission('actions:write', '*'), avController.deleteExclusion);
router.get('/av/reputation', avController.getFileReputation);
router.post('/av/scan-task', requireAnyPermission('actions:write', '*'), avController.createScanTask);
router.get('/av/scan-tasks', avController.listScanTasks);
router.get('/av/malware-alerts', avController.listMalwareAlerts);
router.patch('/av/malware-alerts/:id/status', requireAnyPermission('actions:write', '*'), avController.updateMalwareAlertStatus);
router.get('/av/malware-alerts/:id', avController.getMalwareAlert);
router.get('/av/updates/status', avController.listUpdateStatus);

router.get('/dashboard/summary', adminController.dashboardSummary);
router.get('/endpoints', adminController.listEndpoints);
// RBAC: requirePermission applied to write operations (optional - super_admin bypasses)
router.get('/endpoints/:id/metrics', adminController.getEndpointMetrics);
router.post('/endpoints/:id/test-metrics', adminController.setEndpointTestMetrics);
router.get('/endpoints/:id', adminController.getEndpoint);
router.delete('/endpoints/:id', requireAnyPermission('actions:write', '*'), adminController.deleteEndpoint);
router.get('/events', adminController.listEvents);
router.get('/events/:id', adminController.getEvent);
router.get('/normalized-events', adminController.listNormalizedEvents);
router.get('/normalized-events/:id', adminController.getNormalizedEvent);
router.get('/audit-logs', adminController.listAuditLogs);
router.get('/alerts', adminController.listAlerts);
router.get('/alerts/summary', adminController.getAlertsSummary);
router.get('/alerts/:id', adminController.getAlert);
router.post('/alerts/:id/status', requireAnyPermission('alerts:write', '*'), adminController.updateAlertStatus);
router.post('/alerts/:id/notes', adminController.addAlertNote);
router.get('/alerts/:id/notes', adminController.getAlertNotes);
router.post('/endpoints/:id/actions', requireAnyPermission('actions:write', '*'), adminController.createResponseAction);
router.get('/endpoints/:id/actions', adminController.listResponseActions);
router.get('/detection-rules', adminController.listDetectionRules);
router.patch('/detection-rules/:id', requireAnyPermission('rules:write', '*'), adminController.updateDetectionRule);

// Phase 3: Policies, Investigations, Triage, Process Tree, Search
const phase3 = require('../controllers/phase3Controller');
router.get('/policies', phase3.listPolicies);
router.post('/policies', phase3.createPolicy);
router.put('/policies/:id', phase3.updatePolicy);
router.post('/endpoints/:id/assign-policy', phase3.assignPolicy);
router.get('/investigations', phase3.listInvestigations);
router.post('/investigations', phase3.createInvestigation);
router.get('/investigations/:id', phase3.getInvestigation);
router.get('/investigations/:id/notes', phase3.getInvestigationNotes);
router.post('/investigations/:id/notes', phase3.addInvestigationNote);
router.get('/triage', phase3.listTriage);
router.get('/triage/:id', phase3.getTriageRequest);
router.post('/endpoints/:id/triage-request', phase3.createTriageRequest);
router.get('/process-tree/:endpointId', phase3.getProcessTree);

// Network activity
const networkController = require('../controllers/networkController');
router.get('/network/connections', networkController.listConnections);
router.get('/network/outgoing-ips', networkController.getOutgoingIps);
router.get('/network/traffic', networkController.getTrafficSummary);
router.get('/network/logs', networkController.getNetworkLogs);
router.get('/process-monitor', phase3.processMonitor);
router.get('/search/global', phase3.globalSearch);

// Phase 4: Incidents, Risk, IOC
const phase4 = require('../controllers/phase4Controller');
router.get('/incidents', phase4.listIncidents);
router.get('/incidents/:id', phase4.getIncident);
router.post('/incidents/:id/status', phase4.updateIncidentStatus);
router.get('/risk/endpoints', phase4.getRiskList);
router.get('/endpoints/:id/risk', phase4.getEndpointRisk);
router.get('/iocs', phase4.listIocs);
router.post('/iocs', phase4.createIoc);
router.delete('/iocs/:id', phase4.deleteIoc);
router.get('/iocs/matches', phase4.getIocMatches);

// Tenant management (super_admin for create/update/delete)
const tenantController = require('../controllers/tenantController');
router.get('/tenants', tenantController.listTenants);
router.get('/tenants/:id', tenantController.getTenant);
router.post('/tenants', requireAnyPermission('*'), tenantController.createTenant);
router.patch('/tenants/:id', requireAnyPermission('*'), tenantController.updateTenant);
router.delete('/tenants/:id', requireAnyPermission('*'), tenantController.deleteTenant);

// Phase 6: Enterprise - Notification channels, retention, agent releases
const phase6 = require('../controllers/phase6Controller');
router.get('/notification-channels', phase6.listNotificationChannels);
router.post('/notification-channels', requireAnyPermission('*', 'manage_integrations'), phase6.createNotificationChannel);
router.patch('/notification-channels/:id', requireAnyPermission('*', 'manage_integrations'), phase6.updateNotificationChannel);
router.get('/retention-policies', phase6.listRetentionPolicies);
router.post('/retention-policies', requireAnyPermission('*', 'manage_tenants'), phase6.createRetentionPolicy);
router.patch('/retention-policies/:id', requireAnyPermission('*', 'manage_tenants'), phase6.updateRetentionPolicy);
router.delete('/retention-policies/:id', requireAnyPermission('*', 'manage_tenants'), phase6.deleteRetentionPolicy);
router.post('/retention-policies/run', requireAnyPermission('*', 'manage_tenants'), phase6.runRetention);
router.get('/agent-releases', phase6.listAgentReleases);
router.post('/agent-releases', requireAnyPermission('*'), phase6.createAgentRelease);

module.exports = router;
