/**
 * Global error handler
 */
const logger = require('../utils/logger');

function errorHandler(err, req, res, _next) {
  logger.error({ err, path: req.path }, 'Request error');

  const status = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error';

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

module.exports = errorHandler;
