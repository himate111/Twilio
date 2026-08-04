const inventoryService = require('./inventoryService');

async function lookupMedicine(query, facilityId) {
  const results = await inventoryService.lookupAvailableInventory(
    query,
    facilityId
  );

  if (!results || results.length === 0) {
    throw new Error('Medicine not found.');
  }

  const medicine = results[0];

  const stock = await inventoryService.getAvailableStock(
    medicine.id,
    facilityId
  );

  medicine.availableStock = stock;

  return medicine;
}

async function validateStock(productId, facilityId, requestedQty) {
  const stock = await inventoryService.getAvailableStock(
    productId,
    facilityId
  );

  if (stock < requestedQty) {
    throw new Error(`Insufficient stock. Available: ${stock}`);
  }

  return stock;
}

async function processFacilityReturn(input) {
  return inventoryService.consumeStock({
    facilityId: input.facilityId,
    userId: input.userId,
    product: {
      id: input.productId
    },
    quantity: input.quantity
  });
}

async function processPatientReturn(input) {
  return inventoryService.receiveStock({
    facilityId: input.facilityId,
    userId: input.userId,
    productId: input.productId,
    quantity: input.quantity,
    batchNumber: null,
    expiryDate: null,
    deliveryStatus: 'FULL'
  });
}

module.exports = {
  lookupMedicine,
  validateStock,
  processPatientReturn,
  processFacilityReturn
};