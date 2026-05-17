/**
 * Software Risk Management — admin routes (/api/v1/software)
 */
const express = require('express');
const router = express.Router();
const softwareController = require('../controllers/softwareController');
const { authAdmin } = require('../middleware/auth');
const { attachTenant } = require('../middleware/tenantMiddleware');
const { requireTenantContext } = require('../middleware/requireTenantContext');
const { requireMfaCompliant } = require('../middleware/mfaPolicy');
const { tenantRateLimit } = require('../middleware/tenantRateLimit');
const { adminAuditTrail } = require('../middleware/adminAuditTrail');
const { requirePermission, requireAnyPermission } = require('../middleware/rbac');
const { PERMISSIONS } = require('../constants/permissions');

router.use(authAdmin);
router.use(attachTenant);
router.use(requireTenantContext);
router.use(requireMfaCompliant);
router.use(tenantRateLimit);
router.use(adminAuditTrail);

router.get('/inventory', requirePermission(PERMISSIONS.SOFTWARE_VIEW), softwareController.listInventory);
router.get('/inventory/:id', requirePermission(PERMISSIONS.SOFTWARE_VIEW), softwareController.getInventory);
router.get('/summary', requirePermission(PERMISSIONS.SOFTWARE_VIEW), softwareController.getSummary);
router.get('/reports/export', requirePermission(PERMISSIONS.SOFTWARE_EXPORT), softwareController.exportReport);

router.get(
  '/vulnerabilities',
  requirePermission(PERMISSIONS.SOFTWARE_VIEW),
  softwareController.listVulnerabilities
);
router.post(
  '/vulnerabilities',
  requirePermission(PERMISSIONS.SOFTWARE_VULN_MANAGE),
  softwareController.createVulnerability
);
router.put(
  '/vulnerabilities/:id',
  requirePermission(PERMISSIONS.SOFTWARE_VULN_MANAGE),
  softwareController.updateVulnerability
);
router.delete(
  '/vulnerabilities/:id',
  requirePermission(PERMISSIONS.SOFTWARE_VULN_MANAGE),
  softwareController.deleteVulnerability
);

router.post(
  '/inventory/:id/notify-update',
  requirePermission(PERMISSIONS.SOFTWARE_NOTIFY),
  softwareController.notifyUpdate
);
router.post(
  '/inventory/:id/notify-uninstall',
  requirePermission(PERMISSIONS.SOFTWARE_NOTIFY),
  softwareController.notifyUninstall
);
router.post(
  '/inventory/:id/block',
  requireAnyPermission(PERMISSIONS.SOFTWARE_BLOCK, PERMISSIONS.SOFTWARE_MANAGE),
  softwareController.blockInventory
);
router.post(
  '/inventory/:id/unblock',
  requireAnyPermission(PERMISSIONS.SOFTWARE_UNBLOCK, PERMISSIONS.SOFTWARE_MANAGE),
  softwareController.unblockInventory
);
router.post(
  '/inventory/:id/accept-risk',
  requirePermission(PERMISSIONS.SOFTWARE_ACCEPT_RISK),
  softwareController.acceptRisk
);
router.post(
  '/inventory/:id/refresh',
  requirePermission(PERMISSIONS.SOFTWARE_MANAGE),
  softwareController.refreshInventory
);

router.get(
  '/remediation-actions',
  requirePermission(PERMISSIONS.SOFTWARE_VIEW),
  softwareController.listRemediationActions
);

router.get(
  '/block-policies',
  requirePermission(PERMISSIONS.SOFTWARE_VIEW),
  softwareController.listBlockPolicies
);
router.post(
  '/block-policies',
  requirePermission(PERMISSIONS.SOFTWARE_POLICY_MANAGE),
  softwareController.createBlockPolicy
);
router.put(
  '/block-policies/:id',
  requirePermission(PERMISSIONS.SOFTWARE_POLICY_MANAGE),
  softwareController.updateBlockPolicy
);
router.delete(
  '/block-policies/:id',
  requirePermission(PERMISSIONS.SOFTWARE_POLICY_MANAGE),
  softwareController.deleteBlockPolicy
);

router.post(
  '/remediation/:id/notify',
  requirePermission(PERMISSIONS.SOFTWARE_NOTIFY),
  softwareController.notifyUpdate
);

module.exports = router;
