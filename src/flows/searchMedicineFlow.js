const dispensingService =
  require('../services/dispensingService');

const { FLOW_NAMES } =
  require('../utils/constants');

const STEPS = {
  QUERY: 'query'
};

async function start(context) {

  const session = {
    authenticated: true,
    actor: context.actor,
    flow: FLOW_NAMES.SEARCH_MEDICINE,
    step: STEPS.QUERY,
    facilityId: context.actor.facilityId
  };

  await context.sessionManager.saveSession(
    context.userId,
    session
  );

  return [
    '💊 Search Medicine',
    '',
    'Enter medicine name'
  ].join('\n');
}

async function handle(context) {

    
      if (context.text.trim() === '0') {

    await context.sessionManager.clearSession(
      context.userId
    );

    const formatter =
      require('../utils/formatter');

    return formatter.mainMenu();
  }

  const medicines =
    await dispensingService
      .searchMedicinesForLookup(
        context.text,
        context.session.facilityId
      );

 if (!medicines.length) {

  return [
    '❌ Medicine not found',
    '',
    'Enter another medicine',
    '',
    '0️⃣ Back To Menu'
  ].join('\n');
}

  const output = [];

  medicines.forEach(
    (medicine, index) => {

      output.push(
        `${index + 1}. ${medicine.name}`
      );

      if (
        medicine.batches &&
        medicine.batches.length
      ) {

        const batch =
          medicine.batches[0];

        output.push(
          `Batch: ${batch.batchNumber}`
        );

        output.push(
          `Expiry: ${batch.expiryDate}`
        );
      }

      output.push(
        `Stock: ${medicine.stock}`
      );

      if (index < medicines.length - 1) {
        output.push('');
      }
    }
  );

  

 return [
  '💊 Search Results',
  '',
  ...output,
  '',
  '0️⃣ Back To Menu'
].join('\n');
}

module.exports = {
  start,
  handle
};