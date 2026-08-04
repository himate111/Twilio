const Joi = require('joi');

function parseInteger(value) {
  const normalized = String(value || '').trim();
  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  return Number(normalized);
}

function positiveQuantity(value) {
  const quantity = parseInteger(value);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return {
      valid: false,
      message: 'Enter a valid quantity greater than 0.'
    };
  }

  return { valid: true, value: quantity };
}

function nonNegativeQuantity(value) {
  const quantity = parseInteger(value);
  if (!Number.isInteger(quantity) || quantity < 0) {
    return {
      valid: false,
      message: 'Enter a valid count of 0 or more.'
    };
  }

  return { valid: true, value: quantity };
}

function expiryMonth(value, now = new Date()) {
  const normalized = String(value || '').trim();
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(normalized);

  if (!match) {
    return {
      valid: false,
      message: 'Enter expiry date in YYYY-MM format.'
    };
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const monthEnd = new Date(Date.UTC(year, month, 0));
  const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  if (monthEnd < currentMonthStart) {
    return {
      valid: false,
      message: 'Expiry month cannot be in the past.'
    };
  }

  const date = monthEnd.toISOString().slice(0, 10);

  return {
    valid: true,
    value: {
      yearMonth: normalized,
      date
    }
  };
}

function oneOf(value, allowed) {
  const normalized = String(value || '').trim();
  return allowed.includes(normalized)
    ? { valid: true, value: normalized }
    : { valid: false, message: 'Please choose a valid option.' };
}

function requiredText(value, label = 'value') {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return {
      valid: false,
      message: `Enter ${label}.`
    };
  }

  return { valid: true, value: normalized };
}

const twilioWebhookSchema = Joi.object({
  From: Joi.string().required(),
  Body: Joi.string().allow('').default(''),
  MessageSid: Joi.string().allow('').optional(),
  SmsMessageSid: Joi.string().allow('').optional(),
  NumMedia: Joi.number().integer().min(0).default(0)
}).unknown(true);

function validateTwilioWebhook(payload) {
  return twilioWebhookSchema.validate(payload, {
    abortEarly: false,
    convert: true
  });
}

module.exports = {
  positiveQuantity,
  nonNegativeQuantity,
  expiryMonth,
  oneOf,
  requiredText,
  validateTwilioWebhook
};
