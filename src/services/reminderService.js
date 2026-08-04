const cron = require('node-cron');
const env = require('../config/env');
const logger = require('../utils/logger');
const formatter = require('../utils/formatter');
const expiryService = require('./expiryService');
const inventoryService = require('./inventoryService');
const whatsappService = require('./whatsappService');

async function sendExpiryRemindersForFacility(facilityId) {
  const alerts = await expiryService.getActiveAlerts(facilityId, env.expiryAlertDays);
  if (!alerts.length) {
    return { sent: 0, alerts: 0 };
  }

  const users = await inventoryService.listActiveUsersForFacility(facilityId);
  let sent = 0;
  const body = [
    `Expiry Reminder: ${alerts.length} batch(es) need review.`,
    '',
    formatter.expiryAlert(alerts[0], 0, alerts.length),
    '',
    'Reply 3 to manage expiry alerts.'
  ].join('\n');

  for (const user of users) {
    if (!user.whatsappNumber) {
      continue;
    }

    await whatsappService.sendOutboundMessage(user.whatsappNumber, body);
    sent += 1;
  }

  return { sent, alerts: alerts.length };
}

async function sendDailyReminderForFacility(facilityId) {
  const users = await inventoryService.listActiveUsersForFacility(facilityId);
  let sent = 0;

  for (const user of users) {
    if (!user.whatsappNumber) {
      continue;
    }

    await whatsappService.sendOutboundMessage(user.whatsappNumber, env.consumptionReminderText);
    sent += 1;
  }

  return { sent };
}

function start() {
  if (!env.enableCron) {
    logger.info('cron reminders disabled');
    return [];
  }

  const jobs = [
    cron.schedule(env.reminderCron, async () => {
      try {
        await sendExpiryRemindersForFacility(env.defaultFacilityId);
        await sendDailyReminderForFacility(env.defaultFacilityId);
      } catch (error) {
        logger.error({ err: error }, 'scheduled reminder failed');
      }
    })
  ];

  logger.info({ schedule: env.reminderCron }, 'cron reminders started');
  return jobs;
}

module.exports = {
  start,
  sendExpiryRemindersForFacility,
  sendDailyReminderForFacility
};
