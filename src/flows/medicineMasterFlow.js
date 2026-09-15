const { FLOW_NAMES } =
  require('../utils/constants');

const formatter =
  require('../utils/formatter');

const STEPS = {
  MENU: 'menu',

  ADD_CATEGORY: 'add_category',
  ADD_MEDICINE_NAME: 'add_medicine_name',
  ADD_GENERIC_NAME: 'add_generic_name',
  ADD_DOSAGE_FORM: 'add_dosage_form',
  ADD_STRENGTH: 'add_strength',
  ADD_STOCK_THRESHOLD: 'add_stock_threshold',
  ADD_LEAD_DAYS: 'add_lead_days',
  ADD_MINIMUM_ORDER_LEVEL: 'add_minimum_order_level',
  ADD_CONFIRM: 'add_confirm',

  EDIT_SELECT: 'edit_select',
  EDIT_NAME: 'edit_name',
  EDIT_BRAND: 'edit_brand',

  SEARCH_NAME: 'search_name',
  SEARCH_RESULTS: 'search_results'
};


function renderMenu() {
  return [
    '💊 MEDICINE MASTER',
    '',
    '1. List medicines',
    '',
    '2. Add medicine',
    '',
    '3. Edit medicine',
    '',
    '4. Search by name/generic',
    '',
    'Type number:'
  ].join('\n');
}

async function start(context) {

  const session = {
    authenticated: true,
    actor: context.actor,
    flow: FLOW_NAMES.MEDICINE_MASTER,
    step: STEPS.MENU,
    facilityId: context.actor.facilityId,
    userDbId: context.actor.userId,
    data: {}
  };

  await context.sessionManager.saveSession(
    context.userId,
    session
  );

  return renderMenu();
}

async function handleMenu(
  context,
  session
) {

  const option =
    String(context.text || '').trim();

  if (option === '1') {

    const medicines =
      await context.services
        .medicineMasterService
        .listMedicines();

    if (!medicines.length) {
      return 'No medicines found.';
    }

    const lines =
      medicines.map(
        (m, index) =>
          `${index + 1}. ${m.name}`
      );

    return [
      '💊 Medicines',
      '',
      ...lines,
      '',
      '0. Back'
    ].join('\n');
  }

if (option === '2') {

  const categories =
    await context.services
      .medicineMasterService
      .listCategories();

  const lines = categories.map(
    (c, index) =>
      `${index + 1}. ${c.name}`
  );

  await context.sessionManager.saveSession(
    context.userId,
    {
      ...session,
      step: STEPS.ADD_CATEGORY,
      data: {
        categories
      }
    }
  );

  return [
    '📂 Select Category',
    '',
    ...lines,
    '',
    'Type number:'
  ].join('\n');
}

  if (option === '3') {

  const medicines =
    await context.services
      .medicineMasterService
      .listMedicines();

  const lines =
    medicines.map(
      (m, index) =>
        `${index + 1}. ${m.name}`
    );

  await context.sessionManager.saveSession(
    context.userId,
    {
      ...session,
      step: STEPS.EDIT_SELECT,
      data: {
        medicines
      }
    }
  );

  return [
    '💊 Edit Medicine',
    '',
    'Select medicine:',
    '',
    ...lines,
    '',
    '0. Back'
  ].join('\n');
}

  if (option === '4') {

  await context.sessionManager.saveSession(
    context.userId,
    {
      ...session,
      step: STEPS.SEARCH_NAME
    }
  );

  return 'Enter medicine name or brand name:';
}

  return renderMenu();
}

async function handleAddGenericName(
  context,
  session
) {

  const genericName =
    String(context.text || '').trim();

  if (!genericName) {
    return 'Enter Generic Name:';
  }

  await context.sessionManager.saveSession(
    context.userId,
    {
      ...session,
      step: STEPS.ADD_DOSAGE_FORM,
      data: {
  ...session.data,
  genericName
}
    }
  );

  return 'Enter Dosage Form (Tablet/Capsule/Syrup/etc):';
}

async function handleAddDosageForm(
  context,
  session
) {

  const dosageForm =
    String(context.text || '').trim();

  if (!dosageForm) {
    return 'Enter Dosage Form:';
  }

  await context.sessionManager.saveSession(
    context.userId,
    {
      ...session,
      step: STEPS.ADD_STRENGTH,
      data: {
        ...session.data,
        dosageForm
      }
    }
  );

  return 'Enter Strength:';
}



async function handleAddCategory(
  context,
  session
) {

  const index =
    Number(context.text);

  const categories =
    session.data.categories || [];

  if (
    !index ||
    index < 1 ||
    index > categories.length
  ) {
    return 'Select a valid category number.';
  }

  const category =
    categories[index - 1];

  await context.sessionManager.saveSession(
  context.userId,
  {
    ...session,
    step: STEPS.ADD_MEDICINE_NAME,
    data: {
      ...session.data,
      categoryId: category.id,
      categoryName: category.name
    }
  }
);

return 'Enter Medicine Name:';
}

async function handleAddMedicineName(
  context,
  session
) {

  const medicineName =
    String(context.text || '').trim();

  if (!medicineName) {
    return 'Enter Medicine Name:';
  }

  await context.sessionManager.saveSession(
    context.userId,
    {
      ...session,
      step: STEPS.ADD_GENERIC_NAME,
      data: {
        ...session.data,
        medicineName
      }
    }
  );

  return 'Enter Generic Name:';
}

async function handleAddStrength(
  context,
  session
) {

  const strength =
    String(context.text || '').trim();

  if (!strength) {
    return 'Enter Strength (Example: 500mg):';
  }

  await context.sessionManager.saveSession(
  context.userId,
  {
    ...session,
    step: STEPS.ADD_STOCK_THRESHOLD,
    data: {
      ...session.data,
      strength
    }
  }
);

return 'Enter Stock Threshold:';
}

async function handleAddStockThreshold(
  context,
  session
) {

  const stockThreshold =
    Number(context.text);

  if (isNaN(stockThreshold)) {
    return 'Enter Stock Threshold:';
  }

  await context.sessionManager.saveSession(
    context.userId,
    {
      ...session,
      step: STEPS.ADD_LEAD_DAYS,
      data: {
        ...session.data,
        stockThreshold
      }
    }
  );

  return 'Enter Lead Days:';
}

async function handleAddLeadDays(
  context,
  session
) {

  const leadDays =
    Number(context.text);

  if (isNaN(leadDays)) {
    return 'Enter Lead Days:';
  }

  await context.sessionManager.saveSession(
    context.userId,
    {
      ...session,
      step: STEPS.ADD_MINIMUM_ORDER_LEVEL,
      data: {
        ...session.data,
        leadDays
      }
    }
  );

  return 'Enter Minimum Order Level:';
}


async function handleAddMinimumOrderLevel(
  context,
  session
) {

  const minimumOrderLevel =
    Number(context.text);

  if (isNaN(minimumOrderLevel)) {
    return 'Enter Minimum Order Level:';
  }

  await context.sessionManager.saveSession(
    context.userId,
    {
      ...session,
      step: STEPS.ADD_CONFIRM,
      data: {
        ...session.data,
        minimumOrderLevel
      }
    }
  );

  return [
    'Review Medicine',
    '',
    `Category: ${session.data.categoryName}`,
    `Medicine Name: ${session.data.medicineName}`,
    `Generic Name: ${session.data.genericName}`,
    `Dosage Form: ${session.data.dosageForm}`,
    `Strength: ${session.data.strength}`,
    `Stock Threshold: ${session.data.stockThreshold}`,
    `Lead Days: ${session.data.leadDays}`,
    `Minimum Order Level: ${minimumOrderLevel}`,
    '',
    'Reply YES to Save',
    'Reply NO to Cancel'
  ].join('\n');
}



async function handleEditSelect(
  context,
  session
) {

  const index =
    Number(context.text);

  const medicines =
    session.data.medicines || [];

  if (
    !index ||
    index < 1 ||
    index > medicines.length
  ) {
    return 'Select a valid medicine number.';
  }

  const medicine =
    medicines[index - 1];

  await context.sessionManager.saveSession(
  context.userId,
  {
    ...session,
    step: STEPS.EDIT_NAME,
    data: {
      medicineId: medicine.id,
      currentName: medicine.name,
      currentBrand: medicine.brand_name
    }
  }
);

  return [
    `Current Name: ${medicine.name}`,
    '',
    'Enter new Generic Name:'
  ].join('\n');
}

async function handleEditName(
  context,
  session
) {

  const genericName =
    String(context.text || '').trim();

  await context.sessionManager.saveSession(
    context.userId,
    {
      ...session,   
      step: STEPS.EDIT_BRAND,
      data: {
        ...session.data,
        genericName
      }
    }
  );

  return [
  `Current Brand: ${
    session.data.currentBrand || 'N/A'
  }`,
  '',
  'Enter new Brand Name:'
].join('\n');
}

async function handleEditBrand(
  context,
  session
) {

  const brandName =
    String(context.text || '').trim();

  await context.services
    .medicineMasterService
    .updateMedicine({
      id: session.data.medicineId,
      genericName:
        session.data.genericName,
      brandName
    });

  await context.sessionManager
    .clearSession(
      context.userId
    );

  return [
    '✅ Medicine Updated',
    '',
    formatter.mainMenu()
  ].join('\n');
}

async function handleAddConfirm(
  context,
  session
) {

  const answer =
    String(context.text || '')
      .trim()
      .toUpperCase();

  if (answer === 'NO') {

    await context.sessionManager
      .clearSession(
        context.userId
      );

    return renderMenu();
  }

  if (answer !== 'YES') {
    return 'Reply YES or NO';
  }

  await context.services
    .medicineMasterService
    .createMedicine({

      categoryId:
        session.data.categoryId,

      medicineName:
        session.data.medicineName,

      genericName:
        session.data.genericName,

      dosageForm:
        session.data.dosageForm,

      strength:
        session.data.strength,

      stockThreshold:
        session.data.stockThreshold,

      leadDays:
        session.data.leadDays,

      minimumOrderLevel:
        session.data.minimumOrderLevel
    });

  await context.sessionManager
    .clearSession(
      context.userId
    );

  return [
    '✅ Medicine Created',
    '',
    `Medicine: ${session.data.medicineName}`,
    '',
    formatter.mainMenu()
  ].join('\n');
}

async function handleSearchName(
  context,
  session
) {

  const searchText =
    String(context.text || '').trim();

  if (!searchText) {
    return 'Enter medicine name or brand name:';
  }

  const medicines =
    await context.services
      .medicineMasterService
      .searchMedicines(
        searchText
      );

  if (!medicines.length) {

    await context.sessionManager.saveSession(
      context.userId,
      {
        ...session,
        step: STEPS.MENU
      }
    );

    return [
      '❌ No medicines found.',
      '',
      renderMenu()
    ].join('\n');
  }

  const lines =
  medicines.map(
    (m, index) =>
      `${index + 1}. ${m.name}${
        m.brand_name
          ? ` (${m.brand_name})`
          : ''
      }`
  );

await context.sessionManager.saveSession(
  context.userId,
  {
    ...session,
    step: STEPS.SEARCH_RESULTS,
    data: {
      medicines
    }
  }
);

return [
  '💊 Search Results',
  '',
  ...lines,
  '',
  '0. Back to Medicine Master'
].join('\n');

}

async function handleSearchResults(
  context,
  session
) {

  if (context.text === '0') {

    await context.sessionManager.saveSession(
      context.userId,
      {
        ...session,
        step: STEPS.MENU
      }
    );

    return renderMenu();
  }

  return 'Reply 0 to go back.';
}

async function handle(context) {

  const session =
    context.session;

  switch (session.step) {

    case STEPS.MENU:
      return handleMenu(
        context,
        session
      );


      case STEPS.ADD_GENERIC_NAME:
  return handleAddGenericName(
    context,
    session
  );



  case STEPS.ADD_CATEGORY:
  return handleAddCategory(
    context,
    session
  );

  case STEPS.ADD_MEDICINE_NAME:
  return handleAddMedicineName(
    context,
    session
  );


case STEPS.ADD_DOSAGE_FORM:
  return handleAddDosageForm(
    context,
    session
  );

  case STEPS.ADD_STRENGTH:
  return handleAddStrength(context, session);

  case STEPS.EDIT_SELECT:
  return handleEditSelect(
    context,
    session
  );

case STEPS.EDIT_NAME:
  return handleEditName(
    context,
    session
  );

case STEPS.EDIT_BRAND:
  return handleEditBrand(
    context,
    session
  );

  case STEPS.SEARCH_NAME:
  return handleSearchName(
    context,
    session
  );

  case STEPS.SEARCH_RESULTS:
  return handleSearchResults(
    context,
    session
  );

  case STEPS.ADD_STOCK_THRESHOLD:
  return handleAddStockThreshold(
    context,
    session
  );

case STEPS.ADD_LEAD_DAYS:
  return handleAddLeadDays(
    context,
    session
  );

case STEPS.ADD_MINIMUM_ORDER_LEVEL:
  return handleAddMinimumOrderLevel(
    context,
    session
  );

  case STEPS.ADD_CONFIRM:
  return handleAddConfirm(
    context,
    session
  );

  
    default:

      await context.sessionManager
        .clearSession(
          context.userId
        );

      return formatter.mainMenu();
  }
}

module.exports = {
  start,
  handle
};