/**
 * JWT verification with optional previous secret (zero-downtime JWT_SECRET rotation).
 * New tokens are always signed with JWT_SECRET; during rotation, JWT_SECRET_PREVIOUS
 * still verifies signatures from the prior key until those tokens expire.
 */
const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * @param {string} token
 * @param {import('jsonwebtoken').VerifyOptions} [options]
 */
function verifyWithRotation(token, options) {
  try {
    return jwt.verify(token, config.jwt.secret, options);
  } catch (e) {
    const prev = config.jwt.secretPrevious;
    if (prev && e.name === 'JsonWebTokenError') {
      try {
        return jwt.verify(token, prev, options);
      } catch {
        /* fall through */
      }
    }
    throw e;
  }
}

module.exports = { verifyWithRotation };
