const twilioConfig = require('../config/twilio');

function toTwiml(message) {
  const twiml = twilioConfig.createMessagingResponse();
  twiml.message(message);
  return twiml.toString();
}

module.exports = {
  toTwiml
};