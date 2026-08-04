function productDisplayName(product = {}) {
  const name = product.name || product.product_name || product.productName || 'Unknown medicine';
  const formulation = product.formulation || '';
  const strength = product.strength || '';
  const suffix = [formulation, strength].filter(Boolean).join(' ');

  if (!suffix || name.toLowerCase().includes(suffix.toLowerCase())) {
    return name;
  }

  return `${name} ${suffix}`;
}

function mainMenu() {
  return [
    '🏥 Drug Supply Assistant',
    '',
    'Main Menu:',
    '1️⃣ Medicine Dispensing',
    '2️⃣ Stock Receipt',
    '3️⃣ Search Medicine'
  ].join('\n');
}

function help() {
  return [
    'Help',
    '',
    'Send menu anytime to return to the main menu.',
    'Use the numbered options to start a workflow.',
    'You can also send a medicine name or code directly for inventory lookup.',
    '',
    'Reply cancel to end the current workflow.'
  ].join('\n');
}

function medicineFound(product) {
  return [
    'Found:',
    `💊 ${productDisplayName(product)}`,
    `Code: ${product.code || 'N/A'}`
  ].join('\n');
}

function receiptRecorded(items = [], facilityName = '', mainMenuText = '') {
  if (!items.length) {
    return 'Receipt recorded.';
  }

  if (items.length === 1) {
    const item = items[0];

    return [
      '✅ Receipt Recorded',
      '',
      `Facility: ${facilityName}`,
      `Medicine: ${item.medicineName}`,
      `Qty: ${item.quantity}`,
      `Batch: ${item.batchNumber}`,
      `Expiry: ${item.expiryYearMonth}`,
      `Delivery: ${
        item.deliveryStatus === 'FULL'
          ? 'Full Delivery'
          : `Partial Delivery (Shortfall: ${item.shortfallQuantity})`
      }`,
      `Reference: ${item.transactionId}`,
      '',
      'Stock level updated.',
      '',
      mainMenuText
    ].join('\n');
  }

  const lines = items.flatMap((item, index) => [
    `${index + 1}. ${item.medicineName}`,
    `   Qty: ${item.quantity}`,
    `   Batch: ${item.batchNumber}`,
    `   Expiry: ${item.expiryYearMonth}`,
    `   Delivery: ${
      item.deliveryStatus === 'FULL'
        ? 'Full Delivery'
        : `Partial Delivery (Shortfall: ${item.shortfallQuantity})`
    }`,
    `   Reference: ${item.transactionId}`,
    ''
  ]);

  return [
    '✅ Receipt Recorded',
    '',
    `Facility: ${facilityName}`,
    '',
    ...lines,
    'Stock level updated.',
    '',
    mainMenuText
  ].join('\n');
}

function consumptionLogged(product, quantity) {
  return [
    '✅ Consumption Logged',
    '',
    `Medicine: ${productDisplayName(product)}`,
    `Qty Used: ${quantity}`
  ].join('\n');
}

function expiryAlert(alert, index = 0, total = 1) {
  const countLine = total > 1 ? `Alert ${index + 1} of ${total}` : '';

  return [
    '⚠ Expiry Alerts',
    countLine,
    '',
    `Medicine: ${productDisplayName(alert)}`,
    `Batch: ${alert.batchNumber || alert.batch_number}`,
    `Expiry: ${alert.expiryDate || alert.expiry_date}`,
    `Qty: ${alert.availableQuantity ?? alert.available_quantity}`,
    '',
    'Options:',
    '1. Acknowledge',
    '2. Dispose'
  ].filter((line) => line !== '').join('\n');
}

function noExpiryAlerts(days) {
  return `No active near-expiry stock found for the next ${days} days.`;
}

function disposalLogged(alert, quantity) {
  return [
    '✅ Disposal Logged',
    '',
    `Medicine: ${productDisplayName(alert)}`,
    `Batch: ${alert.batchNumber || alert.batch_number}`,
    `Qty Disposed: ${quantity}`
  ].join('\n');
}

function auditSaved(product, systemStock, physicalCount, variance, reason) {
  return [
    '✅ Audit Saved',
    '',
    `Medicine: ${productDisplayName(product)}`,
    `System Stock: ${systemStock}`,
    `Physical Count: ${physicalCount}`,
    `Variance: ${variance}`,
    `Reason: ${reason}`,
    '',
    'Marked for supervisor review.'
  ].join('\n');
}

function inventoryResults(results) {
  if (!results.length) {
    return [
      'No available stock found.',
      '',
      'Try another medicine name, code, or send menu.'
    ].join('\n');
  }

  const blocks = results.map((item, index) => {
    const header = index === 0 ? '💊 Inventory Results' : '';
    return [
      header,
      `Product: ${productDisplayName(item)}`,
      `Code: ${item.code || 'N/A'}`,
      `Stock: ${item.stock ?? item.availableStock ?? item.available_quantity ?? 0}`
    ].filter(Boolean).join('\n');
  });

  return blocks.join('\n\n');
}

function invalidOption() {
  return 'Please choose a valid option from the menu.';
}

function askAddAnotherMedicine() {
  return [
    'Would you like to add another medicine?',
    '1. Yes',
    '2. No'
  ].join('\n');
}

module.exports = {
  productDisplayName,
  mainMenu,
  help,
  medicineFound,
  receiptRecorded,
  consumptionLogged,
  expiryAlert,
  noExpiryAlerts,
  disposalLogged,
  auditSaved,
  inventoryResults,
  invalidOption,
  askAddAnotherMedicine
};
