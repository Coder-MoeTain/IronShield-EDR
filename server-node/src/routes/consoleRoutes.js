/**
 * Compact console BFF routes — aggregate data for 8-page dashboard modules.
 */
const express = require('express');
const router = express.Router();
const consoleController = require('../controllers/consoleController');
const { authAdmin } = require('../middleware/auth');
const { attachTenant } = require('../middleware/tenantMiddleware');
const { requireTenantContext } = require('../middleware/requireTenantContext');
const { requireMfaCompliant } = require('../middleware/mfaPolicy');
const { tenantRateLimit } = require('../middleware/tenantRateLimit');
const { adminAuditTrail } = require('../middleware/adminAuditTrail');
const { requirePermission } = require('../middleware/rbac');

router.use(authAdmin);
router.use(attachTenant);
router.use(requireTenantContext);
router.use(requireMfaCompliant);
router.use(tenantRateLimit);
router.use(adminAuditTrail);

router.get('/overview', requirePermission('dashboard:view'), consoleController.overview);
router.get('/endpoints', requirePermission('endpoint:view'), consoleController.endpoints);
router.get('/endpoints/:id', requirePermission('endpoint:view'), consoleController.endpointDetail);
router.get('/detections', requirePermission('alert:view'), consoleController.detections);
router.get('/investigation', requirePermission('incident:view'), consoleController.investigation);
router.get('/response', requirePermission('response:view'), consoleController.response);
router.get('/hunting', requirePermission('hunting:view'), consoleController.hunting);
router.get('/protection', requirePermission('dashboard:view'), consoleController.protection);
router.get('/admin', requirePermission('audit:view'), consoleController.admin);

module.exports = router;
