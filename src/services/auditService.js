const inventoryService = require('./inventoryService');

async function findMedicine(query) {
  return inventoryService.findBestProduct(query);
}

async function getSystemStock(productId, facilityId) {
  return inventoryService.getAvailableStock(productId, facilityId);
}

async function saveAudit(input) {
  return inventoryService.recordAudit(input);
}

module.exports = {
  findMedicine,
  getSystemStock,
  saveAudit
};
