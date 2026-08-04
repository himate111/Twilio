const env = require('../config/env');
const logger = require('../utils/logger');

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    next(error);
    return;
  }

  const statusCode = error.statusCode || 500;
  const code = error.code || 'INTERNAL_ERROR';

  logger.error(
    {
      err: error,
      code,
      path: req.originalUrl
    },
    'request failed'
  );

  if (req.originalUrl.startsWith('/webhooks/')) {
    return res.sendStatus(200);
  }

  res.status(statusCode).json({
    error: {
      code,
      message:
        env.isProduction && statusCode >= 500
          ? 'Internal server error'
          : error.message
    }
  });
}

module.exports = errorHandler;