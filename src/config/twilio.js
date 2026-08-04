const twilio = require('twilio');
const env = require('./env');

let client;

function getTwilioClient() {
  if (!env.twilio.accountSid || !env.twilio.authToken) {
    return null;
  }

  if (!client) {
    client = twilio(env.twilio.accountSid, env.twilio.authToken);
  }

  return client;
}

function createMessagingResponse() {
  return new twilio.twiml.MessagingResponse();
}

function validateRequest(signature, url, params) {
  if (!env.twilio.authToken) {
    return false;
  }

  return twilio.validateRequest(env.twilio.authToken, signature, url, params);
}

module.exports = {
  getTwilioClient,
  createMessagingResponse,
  validateRequest
};
