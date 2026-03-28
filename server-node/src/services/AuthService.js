/**
 * Admin authentication service
 */
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { authenticator } = require('otplib');
const db = require('../utils/db');
const config = require('../config');
const logger = require('../utils/logger');
const { verifyWithRotation } = require('../utils/jwtVerify');

function isLocked(lockedUntil) {
  if (!lockedUntil) return false;
  return new Date(lockedUntil).getTime() > Date.now();
}

async function bumpFailedAttempt(userId, attempts) {
  const next = (attempts || 0) + 1;
  const shouldLock = next >= Math.max(1, config.auth.maxFailedLogins || 5);
  if (shouldLock) {
    await db.execute(
      'UPDATE admin_users SET failed_login_attempts = ?, locked_until = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE id = ?',
      [next, Math.max(1, config.auth.lockMinutes || 15), userId]
    );
  } else {
    await db.execute('UPDATE admin_users SET failed_login_attempts = ? WHERE id = ?', [next, userId]);
  }
}

async function login(username, password, mfaCode = null) {
  let user;
  try {
    user = await db.queryOne(
      `SELECT id, username, password_hash, role, is_active, tenant_id, failed_login_attempts, locked_until, mfa_enabled, mfa_secret, session_version
       FROM admin_users WHERE username = ?`,
      [username]
    );
  } catch (err) {
    // Backward compatibility when SOC migration hasn't been run yet.
    if (err.code !== 'ER_BAD_FIELD_ERROR') throw err;
    user = await db.queryOne(
      'SELECT id, username, password_hash, role, is_active, tenant_id FROM admin_users WHERE username = ?',
      [username]
    );
  }

  if (!user || !user.is_active) {
    throw new Error('Invalid credentials');
  }
  if (isLocked(user.locked_until)) {
    throw new Error('Account temporarily locked');
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    if (user.failed_login_attempts !== undefined) {
      await bumpFailedAttempt(user.id, user.failed_login_attempts);
    }
    throw new Error('Invalid credentials');
  }

  if (user.failed_login_attempts !== undefined) {
    await db.query(
      'UPDATE admin_users SET last_login_at = NOW(), failed_login_attempts = 0, locked_until = NULL WHERE id = ?',
      [user.id]
    );
  } else {
    await db.query('UPDATE admin_users SET last_login_at = NOW() WHERE id = ?', [user.id]);
  }

  if (user.mfa_enabled && user.mfa_secret) {
    const ok = mfaCode ? authenticator.check(String(mfaCode), String(user.mfa_secret)) : false;
    if (!ok) throw new Error('MFA required');
  }

  const hasMfa = !!(user.mfa_enabled && user.mfa_secret);
  if (config.auth.requireMfaForLocalLogin && !hasMfa) {
    throw new Error('MFA enrollment required');
  }

  const mfaCompliant = hasMfa;
  const token = jwt.sign(
    { userId: user.id, username: user.username, role: user.role, tenantId: user.tenant_id, mfaEnabled: hasMfa, mfaCompliant, authMethod: 'local', sv: user.session_version || 1 },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
  const refresh_token = signRefreshToken(user);

  logger.info({ userId: user.id, username }, 'Admin login');
  return {
    token,
    refresh_token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      tenantId: user.tenant_id,
      mfaEnabled: hasMfa,
      mfaCompliant,
      authMethod: 'local',
      sessionVersion: user.session_version || 1,
    },
  };
}

function signRefreshToken(user) {
  return jwt.sign(
    { type: 'refresh', userId: user.id, sv: Number(user.session_version || 1) },
    config.jwt.secret,
    { expiresIn: config.jwt.refreshExpiresIn || '7d' }
  );
}

async function refreshAccessToken(refreshTokenString) {
  let decoded;
  try {
    decoded = verifyWithRotation(refreshTokenString);
  } catch {
    throw new Error('Invalid refresh token');
  }
  if (decoded.type !== 'refresh' || !decoded.userId) {
    throw new Error('Invalid refresh token');
  }
  const user = await db.queryOne(
    `SELECT id, username, role, tenant_id, session_version, is_active, mfa_enabled, mfa_secret FROM admin_users WHERE id = ?`,
    [decoded.userId]
  );
  if (!user || !user.is_active) throw new Error('Invalid refresh token');
  if (Number(decoded.sv) !== Number(user.session_version || 1)) throw new Error('Session revoked');
  const hasMfa = !!(user.mfa_enabled && user.mfa_secret);
  const mfaCompliant = hasMfa;
  const token = jwt.sign(
    {
      userId: user.id,
      username: user.username,
      role: user.role,
      tenantId: user.tenant_id,
      mfaEnabled: hasMfa,
      mfaCompliant,
      authMethod: 'local',
      sv: user.session_version || 1,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
  const refresh_token = signRefreshToken(user);
  return {
    token,
    refresh_token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      tenantId: user.tenant_id,
      mfaEnabled: hasMfa,
      mfaCompliant,
      authMethod: 'local',
      sessionVersion: user.session_version || 1,
    },
  };
}

function buildJwtForUser(user, opts = {}) {
  const mfaEnabled = !!opts.mfaEnabled;
  const mfaCompliant = !!opts.mfaCompliant;
  const authMethod = opts.authMethod || 'sso';
  const sessionVersion = opts.sessionVersion || user.session_version || 1;
  const token = jwt.sign(
    {
      userId: user.id,
      username: user.username,
      role: user.role,
      tenantId: user.tenant_id,
      mfaEnabled,
      mfaCompliant,
      authMethod,
      sv: sessionVersion,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
  const refresh_token = signRefreshToken(user);
  return {
    token,
    refresh_token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      tenantId: user.tenant_id,
      mfaEnabled,
      mfaCompliant,
      authMethod,
      sessionVersion,
    },
  };
}

async function mfaStatus(userId) {
  let row;
  try {
    row = await db.queryOne(
      'SELECT mfa_enabled, mfa_temp_secret FROM admin_users WHERE id = ?',
      [userId]
    );
  } catch (err) {
    if (err.code === 'ER_BAD_FIELD_ERROR') return { enabled: false, setupPending: false };
    throw err;
  }
  return { enabled: !!row?.mfa_enabled, setupPending: !!row?.mfa_temp_secret };
}

async function beginMfaSetup(userId, username) {
  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri(username, 'IronShield EDR', secret);
  await db.execute('UPDATE admin_users SET mfa_temp_secret = ? WHERE id = ?', [secret, userId]);
  return { secret, otpauth_url: otpauthUrl };
}

async function enableMfa(userId, code) {
  const row = await db.queryOne('SELECT mfa_temp_secret FROM admin_users WHERE id = ?', [userId]);
  const secret = row?.mfa_temp_secret;
  if (!secret) throw new Error('MFA setup not started');
  const ok = authenticator.check(String(code), String(secret));
  if (!ok) throw new Error('Invalid MFA code');
  await db.execute('UPDATE admin_users SET mfa_enabled = 1, mfa_secret = ?, mfa_temp_secret = NULL WHERE id = ?', [secret, userId]);
}

async function disableMfa(userId, code) {
  const row = await db.queryOne('SELECT mfa_secret, mfa_enabled FROM admin_users WHERE id = ?', [userId]);
  if (!row?.mfa_enabled || !row?.mfa_secret) return;
  const ok = authenticator.check(String(code), String(row.mfa_secret));
  if (!ok) throw new Error('Invalid MFA code');
  await db.execute('UPDATE admin_users SET mfa_enabled = 0, mfa_secret = NULL, mfa_temp_secret = NULL WHERE id = ?', [userId]);
}

async function revokeSessions(userId) {
  await db.execute('UPDATE admin_users SET session_version = COALESCE(session_version, 1) + 1 WHERE id = ?', [userId]);
}

async function getSecurityPolicy() {
  return {
    enforceMfaAllAdmins: !!config.auth.enforceMfaAllAdmins,
    requireMfaForLocalLogin: !!config.auth.requireMfaForLocalLogin,
    oidcEnabled: !!config.sso.oidcEnabled,
    samlEnabled: !!config.sso.samlEnabled,
  };
}

module.exports = {
  login,
  mfaStatus,
  beginMfaSetup,
  enableMfa,
  disableMfa,
  buildJwtForUser,
  revokeSessions,
  getSecurityPolicy,
  refreshAccessToken,
};
