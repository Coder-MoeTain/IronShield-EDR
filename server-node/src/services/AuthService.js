/**
 * Admin authentication service
 */
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../utils/db');
const config = require('../config');
const logger = require('../utils/logger');

async function login(username, password) {
  const user = await db.queryOne(
    'SELECT id, username, password_hash, role, is_active, tenant_id FROM admin_users WHERE username = ?',
    [username]
  );

  if (!user || !user.is_active) {
    throw new Error('Invalid credentials');
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new Error('Invalid credentials');
  }

  await db.query(
    'UPDATE admin_users SET last_login_at = NOW() WHERE id = ?',
    [user.id]
  );

  const token = jwt.sign(
    { userId: user.id, username: user.username, role: user.role, tenantId: user.tenant_id },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  logger.info({ userId: user.id, username }, 'Admin login');
  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      tenantId: user.tenant_id,
    },
  };
}

module.exports = { login };
