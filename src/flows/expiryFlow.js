const AppError = require('../utils/appError');
const formatter = require('../utils/formatter');
const validators = require('../utils/validators');
const { FLOW_NAMES } = require('../utils/constants');

const STEPS = {
  MEDICINE_ENTRY: 'medicine_entry',
  BATCH_ENTRY: 'batch_entry',
  BATCH_NOT_FOUND: 'batch_not_found',
  ALERT_CONFIRM: 'alert_confirm',
  ALERT_DAYS_ENTRY: 'alert_days_entry',
  QUANTITY_ENTRY: 'quantity_entry',
  DISPOSAL_METHOD_ENTRY: 'disposal_method_entry',
  SUMMARY_CONFIRM: 'summary_confirm'
};

async function start(context) {
  const session = {
    authenticated: true,
    actor: context.actor,
    flow: FLOW_NAMES.EXPIRY,
    step: STEPS.MEDICINE_ENTRY,
    facilityId: context.actor.facilityId,
    userDbId: context.actor.userId,
    startedAt: new Date().toISOString(),
    data: {}
  };

  await context.sessionManager.saveSession(context.userId, session);

  return 'Enter medicine name:';
}

async function handleMedicineEntry(context, session, data) {
  const medicine = validators.requiredText(context.text, 'medicine name');

  if (!medicine.valid) {
    return medicine.message;
  }

  const product = await context.services.inventoryService.findBestProduct(
    medicine.value
  );

  if (!product) {
    return 'Medicine not found. Enter valid medicine name.';
  }

  await context.sessionManager.saveSession(context.userId, {
    ...session,
    step: STEPS.BATCH_ENTRY,
    data: {
      ...data,
      product
    }
  });

  return `Medicine selected: ${product.name}\nEnter batch number:`;
}

async function handleBatchEntry(context, session, data) {
  const batchNumber = context.text.trim();

  if (!batchNumber) {
    return 'Batch number is required.';
  }

  const batch =
    await context.services.inventoryService.findBatchByMedicineAndBatch(
      data.product.id,
      batchNumber,
      session.facilityId
    );

  if (!batch.length) {
  await context.sessionManager.saveSession(context.userId, {
    ...session,
    step: STEPS.BATCH_NOT_FOUND,
    data
  });

  return [
    'Batch not found or no stock available.',
    '',
    '1. Main Menu',
    '',
    '2. Try Another Batch'
  ].join('\n');
}

  const selectedBatch = batch[0];
  const expiryDate = new Date(selectedBatch.expiryDate);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (expiryDate > today) {
    await context.sessionManager.saveSession(context.userId, {
      ...session,
      step: STEPS.ALERT_CONFIRM,
      data: {
        ...data,
        batch: selectedBatch
      }
    });

    return [
      `Batch: ${selectedBatch.batchNumber}`,
      `Expiry Date: ${selectedBatch.expiryDate}`,
      '',
      'Medicine has not expired yet.',
      'Create expiry alert?',
      '',
      '1. Yes',
      '',
      '2. No'
    ].join('\n');
  }

  await context.sessionManager.saveSession(context.userId, {
    ...session,
    step: STEPS.QUANTITY_ENTRY,
    data: {
      ...data,
      batch: selectedBatch
    }
  });

  return [
    `Batch: ${selectedBatch.batchNumber}`,
    `Expiry Date: ${selectedBatch.expiryDate}`,
    '',
    'Medicine is expired.',
    'Enter expired quantity:'
  ].join('\n');
}

async function handleAlertConfirm(context, session, data) {
  const option = validators.oneOf(context.text, ['1', '2']);

  if (!option.valid) {
    return 'Choose 1 or 2';
  }

  if (option.value === '2') {
    await context.sessionManager.clearSession(context.userId);
    return formatter.mainMenu();
  }

  await context.sessionManager.saveSession(context.userId, {
    ...session,
    step: STEPS.ALERT_DAYS_ENTRY,
    data
  });

  return 'Enter alert days before expiry (example: 30):';
}

async function handleAlertDaysEntry(context, session, data) {
  const days = validators.positiveQuantity(context.text);

  if (!days.valid) {
    return days.message;
  }

  await context.services.expiryService.createReminder({
    batchId: data.batch.id,
    facilityId: session.facilityId,
    alertDays: days.value,
    expiryDate: data.batch.expiryDate,
    userId: session.userDbId
  });

  await context.sessionManager.clearSession(context.userId);

  return [
    'Expiry alert created successfully.',
    '',
    formatter.mainMenu()
  ].join('\n');
}

async function handleQuantityEntry(context, session, data) {
  const quantity = validators.positiveQuantity(context.text);

  if (!quantity.valid) {
    return quantity.message;
  }

  if (quantity.value > Number(data.batch.stock)) {
    return `Quantity exceeds available stock (${data.batch.stock})`;  
  }

  await context.sessionManager.saveSession(context.userId, {
    ...session,
    step: STEPS.DISPOSAL_METHOD_ENTRY,
    data: {
      ...data,
      quantity: quantity.value
    }
  });

  return 'Enter disposal method (burn / landfill / other):';
}

async function handleDisposalMethodEntry(context, session, data) {
  const method = validators.requiredText(context.text, 'disposal method');

  if (!method.valid) {
    return method.message;
  }

  await context.sessionManager.saveSession(context.userId, {
    ...session,
    step: STEPS.SUMMARY_CONFIRM,
    data: {
      ...data,
      disposalMethod: method.value
    }
  });

  return [
    'Expiry Summary',
    '',
    `Medicine: ${data.product.name}`,
    `Batch: ${data.batch.batchNumber}`,
    `Expiry Date: ${data.batch.expiryDate}`,
    `Quantity: ${data.quantity}`,
    `Disposal Method: ${method.value}`,
    '',
    'Confirm?',
    '',
    '1. Yes',
    '',
    '2. No'
  ].join('\n');
}

async function handleSummaryConfirm(context, session, data) {
  const option = validators.oneOf(context.text, ['1', '2']);

  if (!option.valid) {
    return 'Choose 1 or 2';
  }

  if (option.value === '2') {
    await context.sessionManager.clearSession(context.userId);
    return formatter.mainMenu();
  }

  try {
    await context.services.expiryService.dispose({
      facilityId: session.facilityId,
      batchId: data.batch.id,
      quantity: data.quantity,
      product: data.product,
      userId: session.userDbId
    });

    const remaining =
      Number(data.batch.stock) - Number(data.quantity);

    await context.sessionManager.clearSession(context.userId);

    return [
      'Expired stock recorded successfully.',
      `New balance: ${remaining}`,
      '',
      formatter.mainMenu()
    ].join('\n');
  } catch (error) {
    if (error instanceof AppError) {
      return error.message;
    }

    throw error;
  }
}

async function handle(context) {
  const session = context.session;
  const data = session.data || {};

  switch (session.step) {
    case STEPS.MEDICINE_ENTRY:
      return handleMedicineEntry(context, session, data);

    case STEPS.BATCH_ENTRY:
      return handleBatchEntry(context, session, data);

    case STEPS.BATCH_NOT_FOUND:
       return handleBatchNotFound(context, session, data);
       
    case STEPS.ALERT_CONFIRM: 
      return handleAlertConfirm(context, session, data);

    case STEPS.ALERT_DAYS_ENTRY:
      return handleAlertDaysEntry(context, session, data);

    case STEPS.QUANTITY_ENTRY:
      return handleQuantityEntry(context, session, data);

    case STEPS.DISPOSAL_METHOD_ENTRY:
      return handleDisposalMethodEntry(context, session, data);

    case STEPS.SUMMARY_CONFIRM:
      return handleSummaryConfirm(context, session, data);

    default:
      await context.sessionManager.clearSession(context.userId);
      return start(context);
  }
}

async function handleBatchNotFound(context, session, data) {
  const option = validators.oneOf(context.text, ['1', '2']);

  if (!option.valid) {
    return 'Choose 1 or 2';
  }

  if (option.value === '1') {
    await context.sessionManager.clearSession(context.userId);
    return formatter.mainMenu();
  }

  await context.sessionManager.saveSession(context.userId, {
    ...session,
    step: STEPS.BATCH_ENTRY,
    data
  });

  return 'Enter batch number:';
}

module.exports = {
  STEPS,
  start,
  handle
};