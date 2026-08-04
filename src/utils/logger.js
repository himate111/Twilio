const pino = require('pino');
const env = require('../config/env');

module.exports = pino({
  level: env.logLevel,
  base: undefined,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'TWILIO_AUTH_TOKEN',
      'DB_PASSWORD',
      '*.password',
      '*.authToken'
    ],
    remove: true
  }
});
