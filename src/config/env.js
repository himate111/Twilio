const dotenv = require('dotenv');
const Joi = require('joi');

dotenv.config();

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().integer().min(1).max(65535).default(3000),
  PUBLIC_BASE_URL: Joi.string().uri({ scheme: ['http', 'https'] }).allow('').default(''),

  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().integer().min(1).max(65535).default(3306),
  DB_USER: Joi.string().default('root'),
  DB_PASSWORD: Joi.string().allow('').default(''),
  DB_NAME: Joi.string().default('drug_supply_chain'),
  DB_CONNECTION_LIMIT: Joi.number().integer().min(1).max(50).default(10),

  REDIS_URL: Joi.string().uri({ scheme: ['redis', 'rediss'] }).allow('').default(''),
  SESSION_TTL_SECONDS: Joi.number().integer().min(300).default(60 * 60 * 24 * 7),

  TWILIO_ACCOUNT_SID: Joi.string().allow('').default(''),
  TWILIO_AUTH_TOKEN: Joi.string().allow('').default(''),
  TWILIO_WHATSAPP_FROM: Joi.string().allow('').default(''),
  TWILIO_VALIDATE_SIGNATURE: Joi.boolean().truthy('true').falsy('false').default(false),


  WHATSAPP_ACCESS_TOKEN: Joi.string().allow('').default(''),
WHATSAPP_PHONE_NUMBER_ID: Joi.string().allow('').default(''),
WHATSAPP_BUSINESS_ACCOUNT_ID: Joi.string().allow('').default(''),
WHATSAPP_VERIFY_TOKEN: Joi.string().allow('').default(''),

  DEFAULT_FACILITY_ID: Joi.string().required(),
  ALLOW_UNKNOWN_USERS: Joi.boolean().truthy('true').falsy('false').default(true),
  EXPIRY_ALERT_DAYS: Joi.number().integer().min(1).max(365).default(90),

  ENABLE_CRON: Joi.boolean().truthy('true').falsy('false').default(false),
  REMINDER_CRON: Joi.string().default('0 8 * * *'),
  CONSUMPTION_REMINDER_TEXT: Joi.string().default("Please submit today's medicine consumption report."),

  RATE_LIMIT_WINDOW_MS: Joi.number().integer().min(1000).default(60_000),
  RATE_LIMIT_MAX: Joi.number().integer().min(1).default(120),
 TRUST_PROXY: Joi.alternatives().try(Joi.boolean(), Joi.number()),
  LOG_LEVEL: Joi.string().valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent').default('info')
}).unknown(true);

const { value, error } = schema.validate(process.env, {
  abortEarly: false,
  convert: true
});

if (error) {
  throw new Error(`Invalid environment configuration: ${error.message}`);
}

module.exports = {
  nodeEnv: value.NODE_ENV,
  isProduction: value.NODE_ENV === 'production',
  isTest: value.NODE_ENV === 'test',
  port: value.PORT,
  publicBaseUrl: value.PUBLIC_BASE_URL,

  db: {
    host: value.DB_HOST,
    port: value.DB_PORT,
    user: value.DB_USER,
    password: value.DB_PASSWORD,
    database: value.DB_NAME,
    connectionLimit: value.DB_CONNECTION_LIMIT
  },

  redisUrl: value.REDIS_URL,
  sessionTtlSeconds: value.SESSION_TTL_SECONDS,

  twilio: {
    accountSid: value.TWILIO_ACCOUNT_SID,
    authToken: value.TWILIO_AUTH_TOKEN,
    whatsappFrom: value.TWILIO_WHATSAPP_FROM,
    validateSignature: value.TWILIO_VALIDATE_SIGNATURE
  },
  whatsappAccessToken: value.WHATSAPP_ACCESS_TOKEN,
whatsappPhoneNumberId: value.WHATSAPP_PHONE_NUMBER_ID,
whatsappBusinessAccountId: value.WHATSAPP_BUSINESS_ACCOUNT_ID,
whatsappVerifyToken: value.WHATSAPP_VERIFY_TOKEN,

  defaultFacilityId: value.DEFAULT_FACILITY_ID,
  allowUnknownUsers: value.ALLOW_UNKNOWN_USERS,
  expiryAlertDays: value.EXPIRY_ALERT_DAYS,

  enableCron: value.ENABLE_CRON,
  reminderCron: value.REMINDER_CRON,
  consumptionReminderText: value.CONSUMPTION_REMINDER_TEXT,

  rateLimitWindowMs: value.RATE_LIMIT_WINDOW_MS,
  rateLimitMax: value.RATE_LIMIT_MAX,
  trustProxy: value.TRUST_PROXY,
  logLevel: value.LOG_LEVEL
};
