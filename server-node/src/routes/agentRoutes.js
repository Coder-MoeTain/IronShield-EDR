/**
 * Agent API routes
 */
const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agentController');
const { authAgent } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const schemas = require('../schemas/agentSchemas');

// Registration - no auth, uses registration token
router.post('/register', validate(schemas.registerSchema), agentController.register);

// Agent update check - no auth, public for version check
router.get('/update/check', agentController.checkUpdate);

// Heartbeat and events require agent key
router.post('/heartbeat', authAgent, validate(schemas.heartbeatSchema), agentController.heartbeat);
router.post('/events/batch', authAgent, agentController.eventsBatch);
router.post('/network/connections', authAgent, agentController.networkConnections);

// Phase 2: Response actions
router.get('/actions/pending', authAgent, agentController.getPendingActions);
router.post('/actions/:id/result', authAgent, agentController.submitActionResult);

// Phase 3: Policy and triage
const policyController = require('../controllers/policyController');
const triageController = require('../controllers/triageController');
router.get('/policy', authAgent, policyController.getPolicy);
router.get('/tasks/pending', authAgent, triageController.getPendingTasks);
router.post('/tasks/:id/result', authAgent, triageController.submitTaskResult);
router.post('/triage/result', authAgent, triageController.submitTriageResult);

// Antivirus (Phase 7)
const avController = require('../controllers/avController');
router.get('/av/policy', authAgent, avController.getAgentPolicy);
router.get('/av/signatures/version', authAgent, avController.getSignaturesVersion);
router.get('/av/signatures/download', authAgent, avController.downloadSignatures);
router.post('/av/scan-result', authAgent, avController.submitScanResult);
router.post('/av/quarantine-result', authAgent, avController.submitQuarantineResult);
router.post('/av/update-status', authAgent, avController.submitUpdateStatus);
router.get('/av/tasks/pending', authAgent, avController.getPendingTasks);
router.post('/av/tasks/:id/result', authAgent, avController.submitTaskResult);

module.exports = router;
