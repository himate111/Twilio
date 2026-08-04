const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const webhookRoutes = require('./routes/webhookRoutes');
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');

function createApp() {
  const app = express();

  app.set('trust proxy', env.trustProxy);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(requestLogger);

  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'whatsapp-drug-supply-chain-bot'
    });
  });

  const webhookLimiter = rateLimit({
    windowMs: env.rateLimitWindowMs,
    max: env.rateLimitMax
  });

  app.use('/webhooks', webhookLimiter, webhookRoutes);

  app.use(errorHandler);

  return app;
}

module.exports = createApp;