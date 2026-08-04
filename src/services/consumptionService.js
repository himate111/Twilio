const inventoryService = require('./inventoryService');

async function findMedicine(query) {
  return inventoryService.findBestProduct(query);
}

async function getAvailableStock(productId, facilityId) {
  return inventoryService.getAvailableStock(
    productId,
    facilityId
  );
}

async function getOpeningStock(
  productId,
  facilityId,
  period
) {
  return inventoryService.getOpeningStock(
    productId,
    facilityId,
    period
  );
}

async function createPendingApproval(input) {
  return inventoryService.createPendingApproval(
    input
  );
}

async function resetNonReportingAlert(
  facilityId
) {
  return inventoryService.resetNonReportingAlert(
    facilityId
  );
}

async function logConsumption(input) {
  return inventoryService.consumeStock(input);
}

module.exports = {
  findMedicine,
  getAvailableStock,
  getOpeningStock,
  createPendingApproval,
  resetNonReportingAlert,
  logConsumption
};