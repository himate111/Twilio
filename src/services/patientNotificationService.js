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

console.log(
  'Sending WhatsApp to:',
  `whatsapp:+${finalPhone}`
);

return client.messages.create({
  from: env.twilio.whatsappFrom,
  to: `whatsapp:+${finalPhone}`,
  body: message
});

}

module.exports = {
  notifyPatient
};