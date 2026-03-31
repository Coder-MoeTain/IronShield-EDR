/**
 * Agent API routes
 */
const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agentController');
const { authAgentValidated } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const schemas = require('../schemas/agentSchemas');

// Connectivity (no auth) — use before TLS/cloud LB health checks
router.get('/ping', agentController.ping);

// Registration - no auth, uses registration token
router.post('/register', validate(schemas.registerSchema), agentController.register);

// Agent update check - requires agent auth for ring/tenant targeting
router.get('/update/check', authAgentValidated, agentController.checkUpdate);

// Enterprise: rotate agent key (idempotent, requires current valid key)
router.post('/key/rotate', authAgentValidated, agentController.rotateKey);

// Heartbeat and events require agent key
router.post('/heartbeat', authAgentValidated, validate(schemas.heartbeatSchema), agentController.heartbeat);
router.post('/events/batch', authAgentValidated, agentController.eventsBatch);
router.post('/network/connections', authAgentValidated, agentController.networkConnections);

// Phase 2: Response actions
router.get('/actions/pending', authAgentValidated, agentController.getPendingActions);
router.post('/actions/:id/result', authAgentValidated, agentController.submitActionResult);

// Phase 3: Policy and triage
const policyController = require('../controllers/policyController');
const triageController = require('../controllers/triageController');
router.get('/policy', authAgentValidated, policyController.getPolicy);
router.get('/tasks/pending', authAgentValidated, triageController.getPendingTasks);
router.post('/tasks/:id/result', authAgentValidated, triageController.submitTaskResult);
router.post('/triage/result', authAgentValidated, triageController.submitTriageResult);

// Antivirus (Phase 7)
const avController = require('../controllers/avController');
router.get('/av/policy', authAgentValidated, avController.getAgentPolicy);
router.get('/av/signatures/version', authAgentValidated, avController.getSignaturesVersion);
router.get('/av/signatures/download', authAgentValidated, avController.downloadSignatures);
router.post('/av/scan-result', authAgentValidated, avController.submitScanResult);
router.post('/av/quarantine-result', authAgentValidated, avController.submitQuarantineResult);
router.post('/av/update-status', authAgentValidated, avController.submitUpdateStatus);
router.get('/av/tasks/pending', authAgentValidated, avController.getPendingTasks);
router.post('/av/tasks/:id/result', authAgentValidated, avController.submitTaskResult);

// Web & URL protection (IOC domain/url → agent hosts sinkhole)
const webProtectionController = require('../controllers/webProtectionController');
router.get('/web/blocklist', authAgentValidated, webProtectionController.getWebBlocklist);

const agentDetectionRulesController = require('../controllers/agentDetectionRulesController');
router.get('/detection-rules', authAgentValidated, agentDetectionRulesController.getDetectionRules);

module.exports = router;
