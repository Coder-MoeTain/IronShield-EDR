const crypto = require('crypto');
const config = require('../config');
const db = require('../utils/db');
const AuditLogService = require('../services/AuditLogService');
const AuthService = require('../services/AuthService');

const oidc = require('openid-client');

const pendingStates = new Map();

function htmlBridge(result) {
  const safe = JSON.stringify(result).replace(/</g, '\\u003c');
  return `<!doctype html><html><body><script>
  (function(){
    var data=${safe};
    localStorage.setItem('edr_token', data.token);
    localStorage.setItem('edr_user', JSON.stringify(data.user));
    window.location.replace('/');
  })();
  </script></body></html>`;
}

async function lookupUserFromClaims(claims) {
  const username = (claims.preferred_username || claims.email || claims.sub || '').toString().trim();
  if (!username) return null;
  let user = await db.queryOne(
    'SELECT id, username, role, tenant_id, is_active FROM admin_users WHERE username = ? LIMIT 1',
    [username]
  );
  if (!user && claims.email) {
    user = await db.queryOne(
      'SELECT id, username, role, tenant_id, is_active FROM admin_users WHERE email = ? LIMIT 1',
      [String(claims.email)]
    );
  }
  if (!user || !user.is_active) return null;
  return user;
}

function computeMfaFromClaims(claims) {
  const amr = Array.isArray(claims?.amr) ? claims.amr.map((x) => String(x).toLowerCase()) : [];
  const acr = String(claims?.acr || '').toLowerCase();
  const hasMfaSignal = amr.includes('mfa') || amr.includes('otp') || amr.includes('hwk') || acr.includes('mfa');
  return hasMfaSignal;
}

async function oidcStart(req, res, next) {
  try {
    if (!config.sso.oidcEnabled) return res.status(400).json({ error: 'OIDC not enabled' });
    const issuer = new URL(config.sso.oidcIssuer);
    const server = new URL(issuer.origin);
    const as = await oidc.discovery(server, config.sso.oidcClientId, config.sso.oidcClientSecret);
    const state = crypto.randomBytes(16).toString('hex');
    const nonce = crypto.randomBytes(16).toString('hex');
    pendingStates.set(state, { nonce, createdAt: Date.now() });
    const acrValues = config.sso.oidcAcrValues || undefined;
    const authUrl = oidc.buildAuthorizationUrl(as, {
      redirect_uri: config.sso.oidcRedirectUri,
      scope: config.sso.oidcScope,
      response_type: 'code',
      state,
      nonce,
      acr_values: acrValues,
    });
    res.redirect(authUrl.toString());
  } catch (err) {
    next(err);
  }
}

async function oidcCallback(req, res, next) {
  try {
    const state = String(req.query.state || '');
    const row = pendingStates.get(state);
    if (!row) return res.status(400).json({ error: 'Invalid SSO state' });
    pendingStates.delete(state);
    const issuer = new URL(config.sso.oidcIssuer);
    const server = new URL(issuer.origin);
    const as = await oidc.discovery(server, config.sso.oidcClientId, config.sso.oidcClientSecret);
    const tokenSet = await oidc.authorizationCodeGrant(as, new URL(req.originalUrl, `${req.protocol}://${req.get('host')}`), {
      expectedState: state,
      expectedNonce: row.nonce,
    });
    const claims = tokenSet.claims();
    const user = await lookupUserFromClaims(claims);
    if (!user) return res.status(403).json({ error: 'SSO user not provisioned' });
    const mfaSignal = computeMfaFromClaims(claims);
    const mfaCompliant = !config.auth.enforceMfaAllAdmins || mfaSignal;
    const result = AuthService.buildJwtForUser(user, { mfaEnabled: mfaSignal, mfaCompliant, authMethod: 'oidc' });
    await AuditLogService.log({
      userId: user.id,
      username: user.username,
      action: 'login_sso_oidc',
      resourceType: 'auth',
      details: { mfa_signal: mfaSignal, issuer: config.sso.oidcIssuer },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.send(htmlBridge(result));
  } catch (err) {
    next(err);
  }
}

async function samlAcs(req, res, next) {
  try {
    if (!config.sso.samlEnabled) return res.status(400).json({ error: 'SAML not enabled' });
    if (config.sso.samlTrustedProxySecret) {
      const provided = String(req.headers['x-sso-proxy-secret'] || '');
      if (provided !== String(config.sso.samlTrustedProxySecret)) {
        return res.status(401).json({ error: 'Unauthorized SAML proxy' });
      }
    }
    const hUser = String(config.sso.samlTrustedHeaderUser || 'x-sso-user').toLowerCase();
    const hEmail = String(config.sso.samlTrustedHeaderEmail || 'x-sso-email').toLowerCase();
    const hNameId = String(config.sso.samlTrustedHeaderNameId || 'x-sso-nameid').toLowerCase();
    const claims = {
      preferred_username: req.headers[hUser] || req.headers[hNameId] || req.body?.username,
      email: req.headers[hEmail] || req.body?.email,
      amr: req.body?.amr || ['mfa'],
    };
    const user = await lookupUserFromClaims(claims);
    if (!user) return res.status(403).json({ error: 'SAML user not provisioned' });
    const mfaSignal = computeMfaFromClaims(claims);
    const mfaCompliant = !config.auth.enforceMfaAllAdmins || mfaSignal;
    const result = AuthService.buildJwtForUser(user, { mfaEnabled: mfaSignal, mfaCompliant, authMethod: 'saml' });
    await AuditLogService.log({
      userId: user.id,
      username: user.username,
      action: 'login_sso_saml',
      resourceType: 'auth',
      details: { mfa_signal: mfaSignal },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.send(htmlBridge(result));
  } catch (err) {
    next(err);
  }
}

module.exports = { oidcStart, oidcCallback, samlAcs };

