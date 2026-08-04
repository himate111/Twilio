const formatter = require('../utils/formatter');
const validators = require('../utils/validators');
const { FLOW_NAMES } = require('../utils/constants');

const STEPS = {
  MEDICINE_ENTRY: 'medicine_entry',
  ADJUSTMENT_QTY_ENTRY: 'adjustment_qty_entry',
  REASON_ENTRY: 'reason_entry',
  NOTES_ENTRY: 'notes_entry',
  CONFIRM_ENTRY: 'confirm_entry'
};



async function handleNotesEntry(
  context,
  session
) {

  const notes =
  String(context.text || '').trim();

const finalNotes =
  notes.toUpperCase() === 'SKIP'
    ? ''
    : notes;

  const LARGE_THRESHOLD = 100;

  if (
  Math.abs(session.data.adjustmentQty) >
    LARGE_THRESHOLD &&
  !finalNotes
) {
  return 'Notes are mandatory for large adjustments.';
}

  await context.sessionManager.saveSession(
    context.userId,
    {
      ...session,
      step: STEPS.CONFIRM_ENTRY,
      data: {
  ...session.data,
  notes: finalNotes
}
    }
  );

  return [
    '📊 Adjustment Summary',
    '',
    `Medicine: ${formatter.productDisplayName(
      session.data.product
    )}`,
    `Current Stock: ${session.data.systemStock}`,
    `Adjustment: ${session.data.adjustmentQty}`,
    `New Stock: ${session.data.newStock}`,
    `Reason: ${session.data.reason}`,
    `Notes: ${finalNotes || 'N/A'}`,
    '',
    '1. Confirm',
    '2. Re-enter'
  ].join('\n');
}

async function start(context) {
  const session = {
    authenticated: true,
    actor: context.actor,
    flow: FLOW_NAMES.AUDIT,
    step: STEPS.MEDICINE_ENTRY,
    facilityId: context.actor.facilityId,
    userDbId: context.actor.userId,
    startedAt: new Date().toISOString(),
    data: {}
  };

  await context.sessionManager.saveSession(context.userId, session);
 return [
  '📊 Stock Adjustment',
  '',
  'Enter medicine name:'
].join('\n');
}

async function handleMedicineEntry(context, session) {
  const medicineName = validators.requiredText(context.text, 'medicine name');

  if (!medicineName.valid) {
    return medicineName.message;
  }

  const product = await context.services.auditService.findMedicine(medicineName.value);

  if (!product) {
    return 'No matching medicine found. Enter medicine again:';
  }

  const systemStock = await context.services.auditService.getSystemStock(
    product.id,
    session.facilityId
  );

  await context.sessionManager.saveSession(context.userId, {
    ...session,
    step: STEPS.ADJUSTMENT_QTY_ENTRY,
    data: {
      ...session.data,
      product,
      systemStock
    }
  });

  return [
  `Facility: ${session.actor.facilityName}`,
  `Medicine: ${formatter.productDisplayName(product)}`,
  `Current Stock: ${systemStock}`,
  '',
  'Enter adjustment quantity:',
  'Examples:',
  '+10',
  '-5'
].join('\n');
}



async function handleAdjustmentQtyEntry(
  context,
  session
) {
  const input =
    String(context.text || '').trim();

  const adjustmentQty = Number(input);

  if (
    Number.isNaN(adjustmentQty) ||
    adjustmentQty === 0
  ) {
    return 'Enter adjustment quantity (+ or -)';
  }

  const newStock =
    session.data.systemStock +
    adjustmentQty;

  if (newStock < 0) {
    return [
      '❌ Adjustment not allowed.',
      '',
      'Resulting stock would be negative.'
    ].join('\n');
  }

  await context.sessionManager.saveSession(
    context.userId,
    {
      ...session,
      step: STEPS.REASON_ENTRY,
      data: {
        ...session.data,
        adjustmentQty,
        newStock
      }
    }
  );

  return [
    'Select reason:',
    '1. Audit Count',
    '2. Damage',
    '3. Loss',
    '4. Other'
  ].join('\n');
}

async function handleReasonEntry(
  context,
  session
) {

  const option =
    validators.oneOf(
      context.text,
      ['1','2','3','4']
    );

  if (!option.valid) {
    return [
      'Select reason:',
      '1. Audit Count',
      '2. Damage',
      '3. Loss',
      '4. Other'
    ].join('\n');
  }

  const reasonMap = {
    '1': 'Audit Count',
    '2': 'Damage',
    '3': 'Loss',
    '4': 'Other'
  };

  await context.sessionManager.saveSession(
    context.userId,
    {
      ...session,
      step: STEPS.NOTES_ENTRY,
      data: {
        ...session.data,
        reason: reasonMap[option.value]
      }
    }
  );

  return 'Enter notes (or type SKIP):';
}

async function handleConfirmEntry(context, session) {

  const option = validators.oneOf(context.text, ['1', '2']);

  if (!option.valid) {
    return 'Reply with 1 to Confirm or 2 to Re-enter';
  }

  if (option.value === '2') {
    await context.sessionManager.saveSession(context.userId, {
      ...session,
      step: STEPS.MEDICINE_ENTRY,
      data: {}
    });

    return 'Enter medicine name:';
  }


  const LARGE_THRESHOLD = 100;

if (
  Math.abs(
    session.data.adjustmentQty
  ) > LARGE_THRESHOLD
) {

  await context.sessionManager.clearSession(
  context.userId
);

  return [
    '⚠ Large adjustment detected.',
    '',
    'Supervisor approval required.'
  ].join('\n');
}

  await context.services.auditService.saveAudit({
    facilityId: session.facilityId,
    userId: session.userDbId,
    product: session.data.product,
    productId: session.data.product.id,
    systemQuantity: session.data.systemStock,
    physicalQuantity: session.data.newStock,
    reason: session.data.reason
  });

  await context.sessionManager.clearSession(context.userId);

  return [
    '✅ Stock Adjusted',
    '',
    `Facility: ${session.actor.facilityName}`,
    `Medicine: ${formatter.productDisplayName(session.data.product)}`,
    `New Balance: ${session.data.newStock}`,
    '',
    formatter.mainMenu()
  ].join('\n');
}

async function handle(context) {
  const session = context.session;

  switch (session.step) {
  
    case STEPS.MEDICINE_ENTRY:
      return handleMedicineEntry(context, session);

   case STEPS.ADJUSTMENT_QTY_ENTRY:
  return handleAdjustmentQtyEntry(
    context,
    session
  );

case STEPS.NOTES_ENTRY:
  return handleNotesEntry(
    context,
    session
  );

    case STEPS.REASON_ENTRY:
      return handleReasonEntry(context, session);

    case STEPS.CONFIRM_ENTRY:
      return handleConfirmEntry(context, session);

    default:
      await context.sessionManager.clearSession(context.userId);
      return formatter.mainMenu();
  }
}

module.exports = {
  STEPS,
  start,
  handle
};