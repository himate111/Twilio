const env = require('../config/env');
const inventoryService = require('./inventoryService');

async function getActiveAlerts(
  facilityId,
  thresholdDays = env.expiryAlertDays
) {
  return inventoryService.getExpiringBatches(
    facilityId,
    thresholdDays
  );
}

async function acknowledge(input) {
  return inventoryService.acknowledgeExpiryBatch(input);
}

async function dispose(input) {
  return inventoryService.disposeBatch(input);
}

async function createReminder(input) {
  return inventoryService.createExpiryReminder(input);
}

module.exports = {
  getActiveAlerts,
  acknowledge,
  dispose,
  createReminder
};