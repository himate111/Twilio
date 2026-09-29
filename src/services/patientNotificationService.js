const twilioConfig =
  require('../config/twilio');

const env =
  require('../config/env');

async function notifyPatient(
  phone,
  message
) {

  const client =
    twilioConfig.getTwilioClient();

  if (!client) {
    throw new Error(
      'Twilio client unavailable'
    );
  }

  const normalizedPhone =
  phone.replace(/\D/g, '');

const finalPhone =
  normalizedPhone.startsWith('91')
    ? normalizedPhone
    : `91${normalizedPhone}`;

return client.messages.create({
  from: env.twilio.whatsappFrom,
  to: `whatsapp:+${finalPhone}`,
  body: message
});

}

module.exports = {
  notifyPatient
};