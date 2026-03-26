/**
 * Auth routes
 */
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validate } = require('../middleware/validate');
const { authAdmin } = require('../middleware/auth');
const { loginSchema, mfaCodeSchema } = require('../schemas/authSchemas');
const ssoController = require('../controllers/ssoController');
const { requireSoD } = require('../middleware/sod');

router.post('/login', validate(loginSchema), authController.login);
router.get('/sso/oidc/start', ssoController.oidcStart);
router.get('/sso/oidc/callback', ssoController.oidcCallback);
router.post('/sso/saml/acs', ssoController.samlAcs);
router.get('/mfa/status', authAdmin, authController.mfaStatus);
router.post('/mfa/setup', authAdmin, authController.beginMfaSetup);
router.post('/mfa/enable', authAdmin, validate(mfaCodeSchema), authController.enableMfa);
router.post('/mfa/disable', authAdmin, validate(mfaCodeSchema), authController.disableMfa);
router.get('/security/policy', authAdmin, authController.securityPolicy);
router.post('/session/revoke-self', authAdmin, authController.revokeMySessions);
router.post('/session/revoke-user/:id', authAdmin, requireSoD({ allowedRoles: ['super_admin'] }), authController.revokeUserSessions);

module.exports = router;
