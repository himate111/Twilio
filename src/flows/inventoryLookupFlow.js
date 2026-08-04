const formatter = require('../utils/formatter');
const validators = require('../utils/validators');
const { FLOW_NAMES } = require('../utils/constants');

const STEPS = {
  QUERY_ENTRY: 'query_entry'
};

function initialReply() {
  return [
    '💊 Check Stock',
    '',
    'Enter medicine name or code:'
  ].join('\n');
}

async function start(context) {
  const session = {
    authenticated: true,
    actor: context.actor,
    flow: FLOW_NAMES.INVENTORY_LOOKUP,
    step: STEPS.QUERY_ENTRY,
    facilityId: context.actor.facilityId,
    userDbId: context.actor.userId,
    startedAt: new Date().toISOString(),
    data: {}
  };

  await context.sessionManager.saveSession(context.userId, session);
  return initialReply();
}

async function lookup(context, query, facilityId) {
  const medicine = validators.requiredText(
    query,
    'medicine name or code'
  );

  if (!medicine.valid) {
    return medicine.message;
  }

  const product =
    await context.services.inventoryService.findBestProduct(
      medicine.value
    );

  if (!product) {
    return 'Medicine not found.';
  }

  const insight =
    await context.services.inventoryService.getStockInsight(
      product.id,
      facilityId
    );

  return [
    `Medicine: ${product.name}`,
    `Balance: ${insight.balance} ${product.unit || 'units'}`,
    `Days left (approx): ${insight.daysLeft}`,
    insight.earliestExpiry
      ? `Earliest expiry: batch ${insight.earliestExpiry.batchNumber} on ${insight.earliestExpiry.expiryDate}`
      : 'Earliest expiry: N/A',
    `Low stock threshold: ${insight.lowStockThreshold} ${product.unit || 'units'}`,
    '',
    formatter.mainMenu()
  ].join('\n');
}

async function handle(context) {
  const response = await lookup(
    context,
    context.text,
    context.session.facilityId
  );

  await context.sessionManager.clearSession(context.userId);

  return response;
}

async function quickLookup(context) {
  return lookup(
    context,
    context.text,
    context.actor.facilityId
  );
}

module.exports = {
  STEPS,
  start,
  handle,
  quickLookup
};