const inventoryService = require('./inventoryService');

function makeTransferCode() {
  return 'TRF-' + Date.now();
}

async function lookupMedicine(query, facilityId) {
  const results = await inventoryService.lookupAvailableInventory(
    query,
    facilityId
  );

  if (!results || results.length === 0) {
    throw new Error('Medicine not found.');
  }

  return results[0];
}

async function validateStock(productId, facilityId, qty) {
  const stock = await inventoryService.getAvailableStock(
    productId,
    facilityId
  );

  if (stock < qty) {
    throw new Error(`Insufficient stock. Available: ${stock}`);
  }

  return stock;
}

async function validateFacility(locationNumber) {
  const facility = await inventoryService.findFacilityByNumber(
    locationNumber
  );

  if (!facility) {
    throw new Error('Invalid receiving facility.');
  }

  return facility;
}

async function createTransfer(input) {
  const transferCode = makeTransferCode();

  const transferTx = await inventoryService.transferOut({
    facilityId: input.facilityId,
    destinationFacilityId: input.destinationFacilityId,
    userId: input.userId,
    productId: input.productId,
    quantity: input.quantity,
    transferCode
  });

  await inventoryService.createLocalTransfer(
    transferTx.transactionId
  );

  return {
    transferCode
  };
}

async function getTransferByCode(transferCode, facilityId) {
  const transfer = await inventoryService.findTransferByCode(
    transferCode
  );

  if (!transfer) {
    throw new Error('Transfer not found.');
  }

  if (transfer.destination_transaction_id) {
    throw new Error('Transfer already completed.');
  }

  if (transfer.destination_id !== facilityId) {
    throw new Error('This transfer is not for your facility.');
  }

  return transfer;
}

async function receiveTransfer(input) {
  const receipt = await inventoryService.receiveStock({
    facilityId: input.facilityId,
    userId: input.userId,
    productId: input.productId,
    quantity: input.quantity,
    batchNumber: input.batchNumber || null,
    expiryDate: input.expiryDate || null,
    deliveryStatus: input.deliveryStatus || 'FULL'
  });

  await inventoryService.completeTransfer(
    input.localTransferId,
    receipt.transactionId
  );

  return receipt;
}

module.exports = {
  lookupMedicine,
  validateStock,
  validateFacility,
  createTransfer,
  getTransferByCode,
  receiveTransfer
};