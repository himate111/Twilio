const env = require('../config/env');
const twilioConfig = require('../config/twilio');
const whatsappService = require('../services/whatsappService');

function webhookValidator(req, res, next) {
  if (!env.twilio.validateSignature) {
    next();
    return;
  }

  const signature = req.headers['x-twilio-signature'];
  const baseUrl = env.publicBaseUrl || `${req.protocol}://${req.get('host')}`;
  const url = `${baseUrl}${req.originalUrl}`;

  if (!signature || !twilioConfig.validateRequest(signature, url, req.body)) {
    res
      .status(403)
      .type('text/xml')
      .send(whatsappService.toTwiml('Webhook signature validation failed.'));
    return;
  }

  next();
}

module.exports = webhookValidator;