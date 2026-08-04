const { FLOW_NAMES } = require('../utils/constants');
const menuFlow = require('./menuFlow');
const returnService = require('../services/returnService');

const STEPS = {
  RETURN_TYPE: 'return_type',
  MEDICINE_ENTRY: 'medicine_entry',
  QUANTITY_ENTRY: 'quantity_entry',
  REASON_ENTRY: 'reason_entry',
  CONFIRM_ENTRY: 'confirm_entry',

PATIENT_ID_ENTRY: 'patient_id_entry',
PATIENT_MEDICINE_ENTRY: 'patient_medicine_entry',
PATIENT_QUANTITY_ENTRY: 'patient_quantity_entry',
PATIENT_CONDITION_ENTRY: 'patient_condition_entry',
PATIENT_REASON_ENTRY: 'patient_reason_entry',
PATIENT_CONFIRM_ENTRY: 'patient_confirm_entry',
};

async function start(context) {
  const session = {
    authenticated: true,
    actor: context.actor,
    flow: FLOW_NAMES.RETURN,
    step: STEPS.RETURN_TYPE,
    facilityId: context.actor.facilityId,
    userDbId: context.actor.userId,
    startedAt: new Date().toISOString(),
    data: {}
  };

  await context.sessionManager.saveSession(context.userId, session);

  return [
    '↩ Return Processing',
    '',
    'Select return type:',
    '1 Facility → AMS',
    '2 Facility → Facility',
    '3 Patient Return'
  ].join('\n');
}

async function handle(context) {
  const text = context.text.trim();
  const session = context.session;

  switch (session.step) {
    case STEPS.RETURN_TYPE:
      if (text === '1') {
        session.data.returnType = 'facility_ams';
        session.step = STEPS.MEDICINE_ENTRY;

        await context.sessionManager.saveSession(
          context.userId,
          session
        );

        return 'Enter medicine name:';
      }

      if (text === '2') {
        await context.sessionManager.clearSession(
          context.userId
        );

        return 'Please use Stock Transfer (option 9).';
      }

       if (text === '3') {
  session.data.returnType = 'patient_return';
  session.step = STEPS.PATIENT_ID_ENTRY;

  await context.sessionManager.saveSession(
    context.userId,
    session
  );

  return 'Enter Patient ID:';
}

      return 'Invalid option. Enter 1, 2, or 3.';

    case STEPS.MEDICINE_ENTRY:
      try {
        const medicine = await returnService.lookupMedicine(
          text,
          session.facilityId
        );

        session.data.product = medicine;
        session.step = STEPS.QUANTITY_ENTRY;

        await context.sessionManager.saveSession(
          context.userId,
          session
        );

        return [
          `Medicine found: ${medicine.name}`,
          `Available stock: ${medicine.availableStock}`,
          '',
          'Enter quantity to return:'
        ].join('\n');

      } catch (err) {
        return err.message;
      }

    case STEPS.QUANTITY_ENTRY:
      try {
        const qty = parseInt(text, 10);

        await returnService.validateStock(
          session.data.product.id,
          session.facilityId,
          qty
        );

        session.data.quantity = qty;
        session.step = STEPS.REASON_ENTRY;

        await context.sessionManager.saveSession(
          context.userId,
          session
        );

        return 'Enter return reason:';

      } catch (err) {
        return err.message;
      }

    case STEPS.REASON_ENTRY:
      session.data.reason = text;
      session.step = STEPS.CONFIRM_ENTRY;

      await context.sessionManager.saveSession(
        context.userId,
        session
      );

      return [
        'Return Summary',
        '',
        `Medicine: ${session.data.product.name}`,
        `Quantity: ${session.data.quantity}`,
        `Reason: ${session.data.reason}`,
        '',
        '1 Confirm',
        '2 Cancel'
      ].join('\n');

    case STEPS.CONFIRM_ENTRY:
      if (text === '1') {
        await returnService.processFacilityReturn({
          facilityId: session.facilityId,
          userId: session.userDbId,
          productId: session.data.product.id,
          quantity: session.data.quantity
        });

        await context.sessionManager.clearSession(
          context.userId
        );

        return [
          'Facility return recorded successfully.',
          '',
          menuFlow.renderMainMenu()
        ].join('\n');
      }

      await context.sessionManager.clearSession(
        context.userId
      );

      return menuFlow.renderMainMenu();


      case STEPS.PATIENT_ID_ENTRY:
  session.data.patientId = text;
  session.step = STEPS.PATIENT_MEDICINE_ENTRY;

  await context.sessionManager.saveSession(
    context.userId,
    session
  );

  return 'Enter medicine name:';


case STEPS.PATIENT_MEDICINE_ENTRY:
  try {
    const medicine = await returnService.lookupMedicine(
      text,
      session.facilityId
    );

    session.data.product = medicine;
    session.step = STEPS.PATIENT_QUANTITY_ENTRY;

    await context.sessionManager.saveSession(
      context.userId,
      session
    );

    return [
      `Medicine found: ${medicine.name}`,
      '',
      'Enter quantity returned:'
    ].join('\n');

  } catch (err) {
    return err.message;
  }


case STEPS.PATIENT_QUANTITY_ENTRY:
  session.data.quantity = parseInt(text, 10);
  session.step = STEPS.PATIENT_CONDITION_ENTRY;

  await context.sessionManager.saveSession(
    context.userId,
    session
  );

  return [
    'Select condition:',
    '1 Unopened',
    '2 Opened',
    '3 Damaged'
  ].join('\n');


case STEPS.PATIENT_CONDITION_ENTRY:
  session.data.condition = text;
  session.step = STEPS.PATIENT_REASON_ENTRY;

  await context.sessionManager.saveSession(
    context.userId,
    session
  );

  return 'Enter return reason:';


case STEPS.PATIENT_REASON_ENTRY:
  session.data.reason = text;
  session.step = STEPS.PATIENT_CONFIRM_ENTRY;

  await context.sessionManager.saveSession(
    context.userId,
    session
  );

  return [
    'Patient Return Summary',
    '',
    `Patient ID: ${session.data.patientId}`,
    `Medicine: ${session.data.product.name}`,
    `Quantity: ${session.data.quantity}`,
    `Condition: ${session.data.condition}`,
    `Reason: ${session.data.reason}`,
    '',
    '1 Confirm',
    '2 Cancel'
  ].join('\n');


case STEPS.PATIENT_CONFIRM_ENTRY:
  if (text === '1') {

    if (session.data.condition === '1') {
      await returnService.processPatientReturn({
        facilityId: session.facilityId,
        userId: session.userDbId,
        productId: session.data.product.id,
        quantity: session.data.quantity
      });
    }

    await context.sessionManager.clearSession(
      context.userId
    );

    return [
      'Patient return recorded successfully.',
      '',
      menuFlow.renderMainMenu()
    ].join('\n');
  }

  await context.sessionManager.clearSession(
    context.userId
  );

  return menuFlow.renderMainMenu();
  if (text === '1') {
    await context.sessionManager.clearSession(
      context.userId
    );

    return [
      'Patient return recorded successfully.',
      '',
      menuFlow.renderMainMenu()
    ].join('\n');
  }

  await context.sessionManager.clearSession(
    context.userId
  );

  return menuFlow.renderMainMenu();

    default:
      await context.sessionManager.clearSession(
        context.userId
      );

      return menuFlow.renderMainMenu();
  }
}

module.exports = {
  start,
  handle
};