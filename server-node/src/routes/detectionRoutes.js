/**
 * Detection engineering API — /api/v1/detections
 */
const express = require('express');
const { authAdmin } = require('../middleware/auth');
const { attachTenant } = require('../middleware/tenantMiddleware');
const { requireTenantContext } = require('../middleware/requireTenantContext');
const { requireMfaCompliant } = require('../middleware/mfaPolicy');
const { tenantRateLimit } = require('../middleware/tenantRateLimit');
const { adminAuditTrail } = require('../middleware/adminAuditTrail');
const { requireAnyPermission } = require('../middleware/rbac');
const { PERMISSIONS } = require('../constants/permissions');
const detectionController = require('../controllers/detectionController');

const router = express.Router();
router.use(authAdmin);
router.use(attachTenant);
router.use(requireTenantContext);
router.use(requireMfaCompliant);
router.use(tenantRateLimit);
router.use(adminAuditTrail);

const view = requireAnyPermission(PERMISSIONS.DETECTION_VIEW, 'alerts:read', '*');
const manage = requireAnyPermission(PERMISSIONS.DETECTION_MANAGE, 'rules:write', '*');
const test = requireAnyPermission(PERMISSIONS.DETECTION_TEST, PERMISSIONS.DETECTION_MANAGE, 'rules:write', '*');
const replay = requireAnyPermission(PERMISSIONS.DETECTION_REPLAY, PERMISSIONS.DETECTION_MANAGE, '*');
const review = requireAnyPermission(
  PERMISSIONS.DETECTION_REVIEW,
  PERMISSIONS.DETECTION_APPROVE,
  PERMISSIONS.DETECTION_MANAGE,
  '*'
);
const suppress = requireAnyPermission(PERMISSIONS.DETECTION_SUPPRESS, PERMISSIONS.DETECTION_MANAGE, 'rules:write', '*');

router.get('/rules', view, detectionController.listRules);
router.get('/rules/validate', view, detectionController.validateRulesHandler);
router.get('/rule-reviews', review, detectionController.listRuleReviews);
router.post('/import-sigma', manage, detectionController.importSigma);
router.get('/rules/:id', view, detectionController.getRule);
router.get('/rules/:id/versions', view, detectionController.listRuleVersions);
router.get('/rules/:id/diff', view, detectionController.diffRule);
router.post('/rules/:id/rollback', requireAnyPermission(PERMISSIONS.DETECTION_ROLLBACK, PERMISSIONS.DETECTION_MANAGE, '*'), detectionController.rollbackRule);
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
