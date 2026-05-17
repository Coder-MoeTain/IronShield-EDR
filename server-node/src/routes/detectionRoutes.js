/**
 * Detection engineering API — /api/v1/detections
 */
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireAnyPermission } = require('../middleware/rbac');
const { PERMISSIONS } = require('../constants/permissions');
const detectionController = require('../controllers/detectionController');

const router = express.Router();
router.use(authenticate);

const view = requireAnyPermission(PERMISSIONS.DETECTION_VIEW, 'alerts:read', '*');
const manage = requireAnyPermission(PERMISSIONS.DETECTION_MANAGE, 'rules:write', '*');
const test = requireAnyPermission('detection:test', PERMISSIONS.DETECTION_MANAGE, 'rules:write', '*');
const replay = requireAnyPermission('detection:replay', PERMISSIONS.DETECTION_MANAGE, '*');
const review = requireAnyPermission('detection:review', 'detection:approve', PERMISSIONS.DETECTION_MANAGE, '*');
const suppress = requireAnyPermission('detection:suppress', PERMISSIONS.DETECTION_MANAGE, 'rules:write', '*');

router.get('/rules', view, detectionController.listRules);
router.get('/rules/validate', view, detectionController.validateRulesHandler);
router.get('/rules/:id', view, detectionController.getRule);
router.post('/rules/:id/test', test, detectionController.testRule);
router.post('/rules/:id/submit-review', manage, detectionController.submitReview);
router.post('/rules/:id/approve', review, detectionController.approveRule);
router.post('/rules/:id/reject', review, detectionController.rejectRule);

router.get('/rule-packs', view, detectionController.listPacks);
router.post('/rule-packs/:id/enable', manage, detectionController.enablePack);

router.post('/replay', replay, detectionController.startReplay);
router.get('/replay/:id', replay, detectionController.getReplay);

router.get('/quality', view, detectionController.quality);
router.get('/mitre-coverage', view, detectionController.mitreCoverage);
router.get('/data-source-coverage', view, detectionController.dataSourceCoverage);

router.get('/suppressions', view, detectionController.listSuppressions);
router.post('/suppressions', suppress, detectionController.createSuppression);
router.delete('/suppressions/:id', suppress, detectionController.deleteSuppression);

module.exports = router;
