const { FLOW_NAMES } = require('../utils/constants');
const menuFlow = require('./menuFlow');
const dispensingService = require('../services/dispensingService');
const imageDownloadService =
  require('../services/imageDownloadService');

const prescriptionOcrService =
  require('../services/prescriptionOcrService');

  const patientNotificationService =
  require('../services/patientNotificationService');

  const stringSimilarity =
  require('string-similarity');

const STEPS = {


  PATIENT_TYPE: 'patient_type',
  EXISTING_PATIENT_PHONE: 'existing_patient_phone',

  // STEP 1 - PATIENT REGISTRATION
  NAME: 'name',
  GENDER: 'gender',
  AGE: 'age',
  PHONE: 'phone',
  PATIENT_REVIEW: 'patient_review',

  SELECT_EXISTING_PATIENT:
  'select_existing_patient',

  SEARCH_MEDICINE: 'search_medicine',

  PROCEED_TO_PRESCRIPTION:
  'proceed_to_prescription',

  // Additional IDs
  RX_ID: 'rx_id',
  PATIENT_ID: 'patient_id',

  // STEP 2 - PRESCRIPTION

 

  MEDICINE_ENTRY:
    'medicine_entry',

    SELECT_MEDICINE: 'select_medicine',


  QUANTITY_ENTRY:
    'quantity_entry',

  OCR_QUANTITY_CONFIRMATION:
    'ocr_quantity_confirmation',

  OCR_QUANTITY_OVERRIDE_ENTRY:
    'ocr_quantity_override_entry',

  OCR_QUANTITY_ENTRY:
    'ocr_quantity_entry',

  OCR_REVIEW: 'ocr_review',

OCR_SUGGESTION:
  'ocr_suggestion',

  OCR_NAME_MISMATCH:
  'ocr_name_mismatch',

  ADD_MORE_MEDICINES:
    'add_more_medicines',

  PRESCRIPTION_UPLOAD:
    'prescription_upload',

  PRESCRIPTION_REVIEW:
    'prescription_review',

    

    POST_DISPENSE: 'post_dispense',

  // STEP 3 - DISPENSING
  LOAD_PATIENT_OR_RX:
    'load_patient_or_rx',

  DOCTOR_NAME:
    'doctor_name',

  DIAGNOSIS:
    'diagnosis',

  FINAL_CHECK:
    'final_check',

  CONFIRM_ENTRY:
    'confirm_entry'
};

async function start(context) {
  const session = {
    authenticated: true,
    actor: context.actor,
    flow: FLOW_NAMES.DISPENSING,
    step: STEPS.PATIENT_TYPE,
    facilityId: context.actor.facilityId,
    userDbId: context.actor.userId,
    startedAt: new Date().toISOString(),
    data: {
  items: []
}
  };

  await context.sessionManager.saveSession(context.userId, session);

return [
  '📋 Step 1 of 3',
  '',
  '👤 Patient',
  '',
  '1️⃣ Existing Patient',
  '',
  '2️⃣ New Patient',
  '',
  'Reply with 1 or 2.'
].join('\n');
}

function clearOcrCandidateState(session) {
  session.data.pendingSuggestion = null;
  delete session.data.ocrCandidates;
  delete session.data.ocrCandidateIndex;
}

function resetOcrState(session) {
  session.data.items = [];
  session.data.unmatchedMedicines = [];
  clearOcrCandidateState(session);
  delete session.data.ocrText;
  delete session.data.prescriptionName;
}

function toOcrItem(medicine, candidate = {}) {
  const calculatedQty = candidate.calculatedQuantity ?? null;
  const explicitQty = candidate.explicitQuantity ?? null;
  const availableStock = medicine.stock ?? 0;

  let quantity = null;
  if (typeof calculatedQty === 'number' && calculatedQty > 0 && calculatedQty <= availableStock) {
    quantity = calculatedQty;
  } else if (typeof explicitQty === 'number' && explicitQty > 0 && explicitQty <= availableStock) {
    quantity = explicitQty;
  }

  return {
    productId: medicine.id,
    medicineName: medicine.name,
    quantity,
    batch: medicine.batchNumber || 'N/A',
    expiryDate: medicine.expiryDate || 'N/A',
    availableStock,
    controlledDrug: medicine.controlledDrug,
    rawText: candidate.rawText || null,
    medicineText: candidate.medicineText || null,
    prescribedQuantityText: candidate.prescribedQuantityText || null,
    dosePerAdministration: candidate.dosePerAdministration || null,
    frequency: candidate.frequency || null,
    duration: candidate.duration || null,
    calculatedQuantity: calculatedQty,
    explicitQuantity: explicitQty,
    numericQuantity: candidate.numericQuantity || null,
    quantitySource: candidate.quantitySource || 'manual_input_required',
    quantityConfidence: candidate.quantityConfidence || null
  };
}
function mergeOcrItems(existing, incoming) {
  const existingQty = typeof existing.quantity === 'number' ? existing.quantity : null;
  const incomingQty = typeof incoming.quantity === 'number' ? incoming.quantity : null;

  if (existingQty === null && incomingQty !== null) {
    existing.quantity = incomingQty;
    existing.prescribedQuantityText = incoming.prescribedQuantityText || existing.prescribedQuantityText;
    existing.dosePerAdministration = incoming.dosePerAdministration ?? existing.dosePerAdministration;
    existing.frequency = incoming.frequency ?? existing.frequency;
    existing.duration = incoming.duration ?? existing.duration;
    existing.calculatedQuantity = incoming.calculatedQuantity ?? existing.calculatedQuantity;
    existing.explicitQuantity = incoming.explicitQuantity ?? existing.explicitQuantity;
    existing.numericQuantity = incoming.numericQuantity ?? existing.numericQuantity;
    existing.quantitySource = incoming.quantitySource;
    existing.quantityConfidence = incoming.quantityConfidence;
  } else if (existingQty !== null && incomingQty === null) {
    // Keep existing trusted quantity
  } else if (existingQty !== null && incomingQty !== null) {
    if (existingQty === incomingQty) {
      // Same trusted quantity -> keep one
    } else {
      // Conflicting trusted quantities -> require manual quantity review
      existing.quantity = null;
      existing.calculatedQuantity = null;
      existing.explicitQuantity = null;
      existing.numericQuantity = null;
      existing.quantitySource = 'manual_input_required';
      existing.quantityConfidence = null;
    }
  }

  if (!existing.batch || existing.batch === 'N/A') existing.batch = incoming.batch;
  if (!existing.expiryDate || existing.expiryDate === 'N/A') existing.expiryDate = incoming.expiryDate;
  if (!existing.availableStock && incoming.availableStock) existing.availableStock = incoming.availableStock;

  return existing;
}

function addOrMergeOcrItem(session, newItem) {
  session.data.items = session.data.items || [];
  const existing = session.data.items.find(item => item.productId === newItem.productId);
  if (existing) {
    mergeOcrItems(existing, newItem);
    return existing;
  }
  session.data.items.push(newItem);
  return newItem;
}


function renderPossibleMatch(medicine) {
  return [
    'PRESCRIPTION ANALYSIS',
    '',
    'Detected:',
    '',
    `1. ${medicine.detected}`,
    '',
    'Possible Match:',
    '',
    `1. ${medicine.suggested} (${medicine.confidence}%)`,
    '',
    '1 Accept Match',
    '',
    '2 Upload Another Image',
    '',
    '3 Manual Entry',
    '',
    '0 Cancel'
  ].join('\n');
}

function renderAmbiguousMatch(medicine) {
  return [
    'PRESCRIPTION ANALYSIS',
    '',
    `Detected: ${medicine.detected}`,
    '',
    'Multiple active Medicine Master records match this name and strength.',
    'A medicine was not selected automatically.',
    '',
    '2 Upload Another Image',
    '',
    '3 Manual Entry',
    '',
    '0 Cancel'
  ].join('\n');
}

function formatQuantityToDispense(item) {
  if (item.prescribedQuantityText) {
    return item.prescribedQuantityText;
  }
  const qty = typeof item.calculatedQuantity === 'number'
    ? item.calculatedQuantity
    : (typeof item.quantity === 'number' ? item.quantity : null);
  if (typeof qty === 'number') {
    const unit = qty === 1 ? 'tablet' : 'tablets';
    return `${qty} ${unit}`;
  }
  return 'Enter manually';
}

function renderDispensingSummary(session) {
  const matched = session.data.items.map(
    (item, i) =>
      `${i + 1}. ${item.medicineName}\nBatch: ${item.batch}\nExpiry: ${item.expiryDate}\nQty: ${item.quantity}`
  );

  return [
    'DISPENSING SUMMARY',
    '',
    ...matched.flatMap((line, index) => [
      line,
      ...(index < matched.length - 1 ? [''] : [])
    ]),
    '',
    '1 Confirm Dispense',
    '',
    '2 Cancel'
  ].join('\n');
}

function renderOcrAnalysis(session) {
  const matched = session.data.items.map(
    (item, i) => [
      `${i + 1}. ${item.medicineName}`,
      `Quantity to dispense: ${formatQuantityToDispense(item)}`,
      `Batch: ${item.batch}`,
      `Expiry: ${item.expiryDate}`,
      `Stock: ${item.availableStock}`
    ].join('\n')
  );
  const unmatched = session.data.unmatchedMedicines.length
    ? session.data.unmatchedMedicines.map((medicine) => `• ${medicine}`)
    : ['None'];

  return [
    'PRESCRIPTION ANALYSIS',
    '',
    '✅ MEDICINES IN STOCK',
    '',
    ...matched.flatMap((line, index) => [
      line,
      ...(index < matched.length - 1 ? [''] : [])
    ]),
    '',
    '❌ MEDICINES OUT OF STOCK',
    '',
    ...unmatched,
    '',
    '1 Continue',
    '',
    '2 Cancel'
  ].join('\n');
}

function renderQuantityPrompt(item, isRecorded = false) {
  const parts = [];
  if (isRecorded) {
    parts.push('Quantity Recorded', '');
  }
  parts.push(item.medicineName, '');
  parts.push(`Quantity to dispense: ${formatQuantityToDispense(item)}`, '');
  parts.push(`Batch: ${item.batch}`);
  parts.push(`Expiry: ${item.expiryDate}`);
  parts.push(`Available Stock: ${item.availableStock}`);
  parts.push('');

  if (typeof item.quantity === 'number' && item.quantity > 0) {
    parts.push('1 Keep this quantity');
    parts.push('2 Enter a different quantity');
  } else {
    parts.push('Enter quantity:');
  }
  return parts.join('\n');
}


async function processOcrCandidates(context, session) {
  const candidates = session.data.ocrCandidates || [];
  session.data.items = session.data.items || [];
  session.data.unmatchedMedicines = session.data.unmatchedMedicines || [];

  while (session.data.ocrCandidateIndex < candidates.length) {
    const candidate = candidates[session.data.ocrCandidateIndex];
    const medicineLine = candidate.medicineText;
    console.log('[RX] RAW MEDICINE ROW:', candidate.rawText);
    console.log('[RX] MEDICINE TEXT:', medicineLine);
    console.log('[RX] PRESCRIBED QUANTITY:', candidate.prescribedQuantityText);
    console.log('[RX] SEARCH QUERY:', medicineLine);

    try {
      const results = await dispensingService.searchMedicines(
        medicineLine,
        session.facilityId
      );

      if (!results.length) {
        console.log('\nMASTER MATCH:');
        console.log(`candidate: ${medicineLine}`);
        console.log('matched product: null');
        console.log('match type: none');
        console.log('confidence if fuzzy: null');
        console.log('active: false');
        console.log('availability: null');
        session.data.unmatchedMedicines.push(medicineLine);
        session.data.ocrCandidateIndex += 1;
        continue;
      }

      const medicine = results[0];
      console.log('\nMASTER MATCH:');
      console.log(`candidate: ${medicineLine}`);
      console.log(`matched product: ${medicine.suggested || medicine.name || 'null'}`);
      console.log(`match type: ${medicine.suggested ? 'fuzzy' : 'direct'}`);
      console.log(`confidence if fuzzy: ${typeof medicine.confidence === 'number' ? medicine.confidence : 'null'}`);
      console.log(`active: ${medicine ? 'true' : 'false'}`);
      console.log(`availability: ${JSON.stringify(medicine.suggested ? null : { stock: medicine.stock ?? 0 })}`);

      console.log('[RX] MASTER MATCH:', medicine.suggested || medicine.name || null);
      console.log('[RX] MATCH SCORE:', typeof medicine.confidence === 'number' ? medicine.confidence : 'direct');
      console.log('[RX] AVAILABILITY:', medicine.suggested ? null : {
        medicine: medicine.name,
        availableStock: medicine.stock ?? 0
      });

      if (medicine.suggested) {
        session.data.pendingSuggestion = {
          ...medicine,
          candidateIndex: session.data.ocrCandidateIndex
        };
        session.step = STEPS.OCR_SUGGESTION;
        await context.sessionManager.saveSession(context.userId, session);
        return renderPossibleMatch(medicine);
      }

      if (medicine.ambiguous) {
        session.data.pendingSuggestion = {
          ...medicine,
          candidateIndex: session.data.ocrCandidateIndex
        };
        session.step = STEPS.OCR_SUGGESTION;
        await context.sessionManager.saveSession(context.userId, session);
        return renderAmbiguousMatch(medicine);
      }

      addOrMergeOcrItem(session, toOcrItem(medicine, candidate));
      session.data.ocrCandidateIndex += 1;
    } catch (error) {
      console.log('\nMASTER MATCH:');
      console.log(`candidate: ${medicineLine}`);
      console.log('matched product: null');
      console.log('match type: none');
      console.log('confidence if fuzzy: null');
      console.log('active: false');
      console.log('availability: null');
      console.error('MATCH FAILED:', medicineLine);
      console.error('REAL ERROR:', error.message || error);
      session.data.unmatchedMedicines.push(medicineLine);
      session.data.ocrCandidateIndex += 1;
    }
  }

  clearOcrCandidateState(session);

  if (!session.data.items.length) {
    console.log('\nFINAL FLOW DECISION: Unable to identify medicines from prescription');
    console.log('EXACT REASON: "Unable to identify medicines from prescription" (None of the extracted prescription candidates could be matched to active stock in facility ' + session.facilityId + '; unmatched: ' + JSON.stringify(session.data.unmatchedMedicines) + ')');
    session.step = STEPS.OCR_SUGGESTION;
    await context.sessionManager.saveSession(context.userId, session);
    return [
      'Unable to identify medicines from prescription',
      '',
      '1 Upload Another Image',
      '',
      '2 Manual Entry',
      '',
      '0 Cancel'
    ].join('\n');
  }

  session.data.prescriptionUploaded = true;
  session.data.currentQuantityIndex = 0;
  session.step = STEPS.OCR_REVIEW;
  await context.sessionManager.saveSession(context.userId, session);
  return renderOcrAnalysis(session);
}

function traceTiming(context, event) {
  if (typeof context.traceTiming === 'function') {
    context.traceTiming(event);
  }
}

async function handle(context) {
  const text = context.text.trim();
  const session = context.session;

  if (session.step === STEPS.OCR_SUGGESTION && context.media && context.media.length) {
    resetOcrState(session);
    session.step = STEPS.PRESCRIPTION_UPLOAD;
    await context.sessionManager.saveSession(context.userId, session);
    console.log('[RX] Replacement image received; restarting prescription OCR');
    return handle({ ...context, session });
  }

  console.log('CURRENT STEP:', session.step);
console.log('USER INPUT:', text);

  switch (session.step) {

case STEPS.PATIENT_TYPE:

  if (text === '1') {

    session.step =
      STEPS.EXISTING_PATIENT_PHONE;

    await context.sessionManager.saveSession(
      context.userId,
      session
    );

    return 'Enter Patient Phone Number';
  }

  if (text === '2') {

    session.step =
      STEPS.NAME;

    await context.sessionManager.saveSession(
      context.userId,
      session
    );

    return 'Enter Patient Name';
  }


  return 'Select 1 or 2';


case STEPS.EXISTING_PATIENT_PHONE: {

  const patients =
    await dispensingService
      .findPatientByPhone(text);

  if (!patients.length) {

    session.step = STEPS.PATIENT_TYPE;

    await context.sessionManager.saveSession(
      context.userId,
      session
    );

    return [
      'Patient not found',
      '',
      '1 Existing Patient',
      '',
      '2 New Patient'
    ].join('\n');
  }

 session.data.phoneMatches =
  patients;

session.step =
  STEPS.SELECT_EXISTING_PATIENT;

await context.sessionManager.saveSession(
  context.userId,
  session
);

return [
  '👥 Patients Found',
  '',
  ...patients.flatMap((p, i) => {
    const name = String(p.firstName || '').trim();
    const displayName = name
      ? name.charAt(0).toUpperCase() + name.slice(1)
      : name;
    const age = p.age === null || p.age === undefined || p.age === ''
      ? ''
      : `${p.age} yrs`;
    const gender = String(p.gender || '').trim();
    const details = [age, gender]
      .filter(Boolean)
      .join(' • ');

    return [
      `${i + 1}️⃣ ${displayName}`,
      ...(details ? [`   ${details}`] : []),
      ...(i < patients.length - 1 ? [''] : [])
    ];
  }),
  '',
  'Reply with the patient number.'
].join('\n');
}


   case STEPS.NAME:

  const patientName = text.trim();

  if (!patientName) {
    return 'Patient Name cannot be blank';
  }

  if (!/^[A-Za-z ]+$/.test(patientName)) {
    return 'Patient Name must contain letters only';
  }

  if (
    patientName.length < 2 ||
    patientName.length > 50
  ) {
    return 'Patient Name must be between 2 and 50 characters';
  }

  session.data.patientName =
    patientName;

  session.step =
    STEPS.PHONE;

  await context.sessionManager.saveSession(
    context.userId,
    session
  );

  return 'Enter Phone Number';

case STEPS.AGE:

  if (text === '0') {

    session.data.age = null;

    session.step = STEPS.GENDER;

    await context.sessionManager.saveSession(
      context.userId,
      session
    );

    return [
      'Select Gender',
      '',
      '1 Male',
      '',
      '2 Female',
      '',
      '3 Other',
      '',
      '4 Prefer Not To Say',
      'Type 1/2/3/4 or SKIP'
    ].join('\n');
  }

  if (!/^\d+$/.test(text)) {
    return 'Age must be a whole number';
  }

  const age = parseInt(text, 10);

  if (age < 0 || age > 120) {
    return 'Please check age entered';
  }

  session.data.age = age;

  session.step = STEPS.GENDER;

  await context.sessionManager.saveSession(
    context.userId,
    session
  );

  return [
    'Select Gender',
    '',
    '1 Male',
    '',
    '2 Female',
    '',
    '3 Other',
    '',
    '4 Prefer Not To Say',
    'Type 1/2/3/4 or SKIP'
  ].join('\n');

case STEPS.GENDER:

  if (text.toUpperCase() === 'SKIP') {

    session.data.gender = null;

  } else {

    const genderMap = {
      '1': 'Male',
      '2': 'Female',
      '3': 'Other',
      '4': 'Prefer Not To Say'
    };

    if (!genderMap[text]) {
      return [
        'Invalid option',
        '',
        '1 Male',
        '',
        '2 Female',
        '',
        '3 Other',
        '',
        '4 Prefer Not To Say',
        'Or type SKIP'
      ].join('\n');
    }

    session.data.gender =
      genderMap[text];
  }

  session.step = STEPS.PATIENT_REVIEW;

  await context.sessionManager.saveSession(
    context.userId,
    session
  );

  return [
  'Review Patient',
  '',
  `Name: ${session.data.patientName}`,
`Phone: ${session.data.phone}`,
`Age: ${session.data.age ?? 'N/A'}`,
`Gender: ${session.data.gender ?? 'N/A'}`,
  '',
  '1 Save',
  '',
  '0 Cancel'
].join('\n');


case STEPS.PHONE:

  const phone = text.trim();

  if (!phone) {
    return 'Phone Number cannot be blank';
  }

  if (!/^\d+$/.test(phone)) {
    return 'Phone Number must contain numbers only';
  }

  if (phone.length !== 10) {
    return 'Phone Number must be exactly 10 digits';
  }

  session.data.phone = phone;

  session.step = STEPS.AGE;

  await context.sessionManager.saveSession(
    context.userId,
    session
  );

  return 'Enter Age (0 Skip)';


  case STEPS.PATIENT_REVIEW:

  if (text === '0') {

    await context.sessionManager.clearSession(
      context.userId
    );

    return menuFlow.renderMainMenu();
  }

  if (text !== '1') {
    return 'Select 1 Save or 0 Cancel';
  }


try {

  const patientId =
    await dispensingService.createPatient({
      name: session.data.patientName,
      age: session.data.age,
      gender: session.data.gender,
      phone: session.data.phone,
      facilityId: session.facilityId
    });

  session.data.patientId = patientId;

  session.step =
    STEPS.PROCEED_TO_PRESCRIPTION;

  await context.sessionManager.saveSession(
    context.userId,
    session
  );

  return [
    'Patient Saved',
    '',
    `Patient ID: ${patientId}`,
    '',
    'Proceed to Prescription?',
    '',
    '1 YES',
    '',
    '0 NO'
  ].join('\n');

} catch (err) {

  return err.message;
}


case STEPS.PROCEED_TO_PRESCRIPTION:

if (text === '1') {

   session.step = STEPS.PRESCRIPTION_UPLOAD;

   await context.sessionManager.saveSession(
      context.userId,
      session
   );

   return [
      'STEP 2 OF 2',
      '',
      'PRESCRIPTION',
      '',
      'Upload Prescription',
      '',
      '0 Skip'
   ].join('\n');
}

if (text === '0') {

   await context.sessionManager.clearSession(
      context.userId
   );

   return menuFlow.renderMainMenu();
}

return 'Select 1 or 0';
    


 

    case STEPS.LOAD_PATIENT_OR_RX:

 if (text === '1') {

  session.data.mode = 'RX';

  session.step = STEPS.RX_ID;

  await context.sessionManager.saveSession(
    context.userId,
    session
  );

  return 'Enter Rx ID:';
}

if (text === '2') {

  session.data.mode = 'WALK_IN';

  session.step = STEPS.PATIENT_ID;

  await context.sessionManager.saveSession(
    context.userId,
    session
  );

  return 'Enter Patient ID:';
}

  return 'Select 1 or 2';


case STEPS.PRESCRIPTION_REVIEW: {

  if (text === '1') {

    session.step = STEPS.CONFIRM_ENTRY;

    await context.sessionManager.saveSession(
      context.userId,
      session
    );

    const prescriptionLines =
      session.data.items.map(
        (item, index) =>
          `${index + 1}. ${item.medicineName}
Batch: ${item.batch}
Qty: ${item.quantity}`
      );

    return [
      'DISPENSING SUMMARY',
      '',
      `Patient: ${session.data.patientName}`,
      '',
      ...prescriptionLines.flatMap((line, index) => [
        line,
        ...(index < prescriptionLines.length - 1 ? [''] : [])
      ]),
      '',
      `Prescription: ${
        session.data.prescriptionUploaded
          ? 'Uploaded'
          : 'Skipped'
      }`,
      '',
      '1 Confirm Dispense',
      '',
      '2 Cancel'
    ].join('\n');
  }

  if (text === '2') {

    await context.sessionManager.clearSession(
      context.userId
    );

    return menuFlow.renderMainMenu();
  }

  return 'Select 1 or 2';
}

case STEPS.PRESCRIPTION_UPLOAD:

if (text === '0') {

  session.data.prescriptionUploaded =
    false;

  session.step =
    STEPS.MEDICINE_ENTRY;

  await context.sessionManager.saveSession(
    context.userId,
    session
  );

  return 'Search medicine:';
}

if (
  context.media &&
  context.media.length > 0
) {

  console.log('IMAGE DETECTED');
console.log(context.media);

  const imageDownloader = require('../services/imageDownloadService');

  const ocrService =
    require('../services/prescriptionOcrService');

  const parserService =
    require('../services/prescriptionParserService');

  const prescriptionMedia = context.media[0];
  let imagePath;

  try {
    traceTiming(context, 'image download start');
    if (!imageDownloader.isSupportedImageMimeType(prescriptionMedia.contentType)) {
      return 'Please upload a JPEG or PNG prescription image.';
    }

    if (prescriptionMedia.path) {
      imagePath = prescriptionMedia.path;
      await imageDownloader.validateImageFile(imagePath, prescriptionMedia.contentType);
    } else if (prescriptionMedia.url) {
      const extension = prescriptionMedia.contentType === 'image/png' ? 'png' : 'jpg';
      imagePath = `uploads/prescription-${Date.now()}.${extension}`;
      await imageDownloader.downloadImage(prescriptionMedia.url, imagePath, {
        contentType: prescriptionMedia.contentType
      });
    } else {
      return 'Please upload a JPEG or PNG prescription image.';
    }

  traceTiming(context, 'image download complete');
  console.log('STARTING OCR');
  traceTiming(context, 'OCR start');

  const recognition = typeof ocrService.recognize === 'function'
    ? await ocrService.recognize(imagePath)
    : { engine: 'legacy', text: await ocrService.extractText(imagePath), lines: [], confidence: null, warnings: [] };
  const text = recognition.text;
  traceTiming(context, 'OCR complete');

  console.log('[RX] OCR ENGINE:', recognition.engine);
  console.log('[RX] OCR RAW TEXT:', text);
  console.log('[RX] OCR LINES:', recognition.lines);

  console.log(
    'OCR RESULT:',
    text
  );

  const prescriptionName =
    parserService.extractPatientName(text);
  traceTiming(context, 'parser complete');

  const footerAnalysis = parserService.analyzeFooterGeometry ? parserService.analyzeFooterGeometry(recognition.lines) : null;
  const clusteredRows = parserService.clusterOcrLinesIntoRows ? parserService.clusterOcrLinesIntoRows(recognition.lines, footerAnalysis) : [];
  const footerRows = clusteredRows.filter(r => r.isFooter);

  const medicineCandidates = parserService.extractMedicineCandidates
    ? parserService.extractMedicineCandidates(text, recognition.lines)
    : parserService.extractMedicines(text, recognition.lines).map((medicineText) => ({
        rawText: medicineText,
        medicineText,
        prescribedQuantityText: null
      }));
  const medicines = medicineCandidates.map((candidate) => candidate.medicineText);

  let similarity = null;
  if (prescriptionName && session.data.patientName) {
    similarity = stringSimilarity.compareTwoStrings(
      prescriptionName.toLowerCase().trim(),
      session.data.patientName.toLowerCase().trim()
    );
  }

  console.log('=== PRESCRIPTION DEBUG START ===\n');
  console.log('OCR RAW TEXT:\n' + text + '\n');
  console.log('OCR STRUCTURED ITEMS:\n' + JSON.stringify(recognition.lines, null, 2) + '\n');
  console.log('CLUSTERED OCR ROWS:\n' + JSON.stringify(clusteredRows.map(r => ({ text: r.text, isFooter: r.isFooter })), null, 2) + '\n');
  console.log('FOOTER ANCHORS:\n' + JSON.stringify(footerAnalysis?.footerAnchors?.map(a => a.text) || [], null, 2) + '\n');
  console.log('FOOTER CUTOFF Y:\n' + (footerAnalysis?.footerCutoffY ?? 'null') + '\n');
  console.log('ROWS CLASSIFIED AS FOOTER:\n' + JSON.stringify(footerRows.map(r => r.text), null, 2) + '\n');
  console.log('DETECTED PRESCRIPTION PATIENT:\n' + (prescriptionName ?? 'null') + '\n');
  console.log('SELECTED PATIENT:\n' + (session.data.patientName ?? 'null') + '\n');
  console.log('PATIENT MATCH/MISMATCH RESULT:\n' + (similarity !== null ? `similarity: ${similarity}, mismatch: ${similarity < 0.7}` : 'no comparison performed') + '\n');
  console.log('EXTRACTED MEDICINE CANDIDATES:');
  medicineCandidates.forEach(c => {
    console.log(`\nrawText: ${c.rawText}`);
    console.log(`medicineText: ${c.medicineText}`);
    console.log(`dosePerAdministration: ${c.dosePerAdministration}`);
    console.log(`frequency: ${c.frequency}`);
    console.log(`duration: ${c.duration}`);
    console.log(`calculatedQuantity: ${c.calculatedQuantity}`);
    console.log(`numericQuantity: ${c.numericQuantity}`);
    console.log(`quantitySource: ${c.quantitySource}`);
  });
  console.log('\n=== PRESCRIPTION DEBUG END ===\n');

  console.log(
    'PRESCRIPTION NAME:',
    prescriptionName
  );

  console.log(
    'PATIENT NAME:',
    session.data.patientName
  );

  if (similarity !== null) {
    console.log(
      'NAME SIMILARITY:',
      similarity
    );
    traceTiming(context, 'patient comparison complete');

    if (similarity < 0.7) {
      console.log('FINAL FLOW DECISION: ❌ PATIENT NAME MISMATCH');
      console.log(`EXACT REASON: Detected patient name "${prescriptionName}" does not match selected patient "${session.data.patientName}" (similarity: ${similarity} < 0.7)`);
      session.data.prescriptionName = prescriptionName;
      session.data.ocrText = text;
      session.data.ocrLines = recognition.lines;
      session.step = STEPS.OCR_NAME_MISMATCH;

      await context.sessionManager.saveSession(
        context.userId,
        session
      );

      return [
        '❌ PATIENT NAME MISMATCH',
        '',
        `Entered Name: ${session.data.patientName}`,
        `Prescription Name: ${prescriptionName}`,
        '',
        '1 Upload Another Prescription',
        '',
        '2 Change Patient Name',
        '',
        '0 Cancel'
      ].join('\n');
    }
  }

  console.log('[RX] MEDICINE CANDIDATES:', medicineCandidates);
  console.log('MEDICINES EXTRACTED');
  console.log(medicines);

  if (!medicines.length) {
    console.log('FINAL FLOW DECISION: Unable to identify medicines from prescription');
    console.log('EXACT REASON: "Unable to identify medicines from prescription" (No medicine candidates were extracted from prescription text/OCR lines by parserService.extractMedicineCandidates)');
    clearOcrCandidateState(session);
    session.step = STEPS.OCR_SUGGESTION;
    await context.sessionManager.saveSession(context.userId, session);
    return [
      'Unable to identify medicines from prescription',
      '',
      '1 Upload Another Image',
      '',
      '2 Manual Entry',
      '',
      '0 Cancel'
    ].join('\n');
  }

session.data.items = [];
session.data.unmatchedMedicines = [];
session.data.ocrCandidates = medicineCandidates;
session.data.ocrCandidateIndex = 0;
session.data.pendingSuggestion = null;
return processOcrCandidates(context, session);  } catch (error) {
    console.error('PRESCRIPTION OCR FAILED:', error.message);
    return 'Unable to read that prescription image. Please upload a clear JPEG or PNG image.';
  } finally {
    await imageDownloader.cleanupTemporaryImage(imagePath);
  }
}


case STEPS.OCR_REVIEW: {

  if (text === '2') {

    await context.sessionManager.clearSession(
      context.userId
    );

    return menuFlow.renderMainMenu();
  }

  if (text !== '1') {
    return 'Select 1 or 2';
  }

  session.data.currentQuantityIndex = 0;

  const firstMedicine =
    session.data.items[0];

  const hasTrusted =
    typeof firstMedicine.quantity === 'number' && firstMedicine.quantity > 0;

  session.step =
    hasTrusted ? STEPS.OCR_QUANTITY_CONFIRMATION : STEPS.OCR_QUANTITY_OVERRIDE_ENTRY;

  await context.sessionManager.saveSession(
    context.userId,
    session
  );

  return renderQuantityPrompt(firstMedicine);
}


case STEPS.OCR_QUANTITY_CONFIRMATION: {

  const index =
    session.data.currentQuantityIndex;

  const item =
    session.data.items[index];

  const trimmed = (text || '').trim();

  const isKeep = trimmed === '1' || ['OK', 'YES', 'CONFIRM', 'KEEP'].includes(trimmed.toUpperCase());
  if (isKeep) {
    session.data.currentQuantityIndex++;

    if (
      session.data.currentQuantityIndex <
      session.data.items.length
    ) {
      const nextItem =
        session.data.items[
          session.data.currentQuantityIndex
        ];

      const nextHasTrusted =
        typeof nextItem.quantity === 'number' && nextItem.quantity > 0;

      session.step =
        nextHasTrusted ? STEPS.OCR_QUANTITY_CONFIRMATION : STEPS.OCR_QUANTITY_OVERRIDE_ENTRY;

      await context.sessionManager.saveSession(
        context.userId,
        session
      );

      return renderQuantityPrompt(nextItem, true);
    }

    session.step =
      STEPS.PRESCRIPTION_REVIEW;

    await context.sessionManager.saveSession(
      context.userId,
      session
    );

    return renderDispensingSummary(session);
  }

  if (trimmed === '2') {
    session.step =
      STEPS.OCR_QUANTITY_OVERRIDE_ENTRY;

    await context.sessionManager.saveSession(
      context.userId,
      session
    );

    return 'Enter quantity to dispense:';
  }

  return [
    'Please choose:',
    '',
    '1 Keep this quantity',
    '2 Enter a different quantity'
  ].join('\n');
}


case STEPS.OCR_QUANTITY_OVERRIDE_ENTRY:
case STEPS.OCR_QUANTITY_ENTRY: {

  const index =
    session.data.currentQuantityIndex;

  const item =
    session.data.items[index];

  const trimmed = (text || '').trim();

  let qty;
  if (session.step === STEPS.OCR_QUANTITY_ENTRY && typeof item.quantity === 'number' && item.quantity > 0) {
    if (['OK', 'YES', 'CONFIRM', 'KEEP'].includes(trimmed.toUpperCase())) {
      qty = item.quantity;
    }
  }

  if (qty === undefined) {
    if (!/^\d+$/.test(trimmed)) {
      return 'Enter a valid quantity';
    }
    qty = parseInt(trimmed, 10);
  }

  if (
    isNaN(qty) ||
    qty <= 0
  ) {
    return 'Enter a valid quantity';
  }

  if (
    qty > item.availableStock
  ) {
    return `Only ${item.availableStock} available`;
  }

  item.quantity = qty;

  session.data.currentQuantityIndex++;

  if (
    session.data.currentQuantityIndex <
    session.data.items.length
  ) {

    const nextItem =
      session.data.items[
        session.data.currentQuantityIndex
      ];

    const nextHasTrusted =
      typeof nextItem.quantity === 'number' && nextItem.quantity > 0;

    session.step =
      nextHasTrusted ? STEPS.OCR_QUANTITY_CONFIRMATION : STEPS.OCR_QUANTITY_OVERRIDE_ENTRY;

    await context.sessionManager.saveSession(
      context.userId,
      session
    );

    return renderQuantityPrompt(nextItem, true);
  }

  session.step =
    STEPS.PRESCRIPTION_REVIEW;

  await context.sessionManager.saveSession(
    context.userId,
    session
  );

  return renderDispensingSummary(session);
}



  case STEPS.DOCTOR_NAME:

  session.data.doctorName =
    text.toUpperCase() === 'SKIP'
      ? null
      : text;

  session.step =
    STEPS.DIAGNOSIS;

  await context.sessionManager
    .saveSession(
      context.userId,
      session
    );

  return 'Enter Diagnosis or SKIP';

case STEPS.DIAGNOSIS:

session.data.diagnosis =
  text.toUpperCase() === 'SKIP'
    ? null
    : text;

const hasControlledDrug =
  session.data.items.some(
    item => item.controlledDrug
  );

if (
  hasControlledDrug &&
  !session.data.prescriptionUploaded
) {
  return [
    '❌ Controlled Drug Detected',
    '',
    'Prescription Required'
  ].join('\n');
}

const lines =
  session.data.items.map(
    (item, index) =>
      `${index + 1}. ${item.medicineName}
Batch: ${item.batch}
Qty: ${item.quantity}`
  );

session.step =
  STEPS.CONFIRM_ENTRY;

await context.sessionManager.saveSession(
  context.userId,
  session
);

return [
  'Dispensing Summary',
  '',
  ...lines.flatMap((line, index) => [
    line,
    ...(index < lines.length - 1 ? [''] : [])
  ]),
  '',
  '1 Confirm',
  '',
  '2 Cancel'
].join('\n');

// case STEPS.FINAL_CHECK:

// const hasControlledDrug =
//   session.data.items.some(
//     item => item.controlledDrug
//   );

// if (
//   hasControlledDrug &&
//   !session.data.prescriptionUploaded
// ) {
//   return [
//     '❌ Controlled Drug Detected',
//     '',
//     'Prescription Required'
//   ].join('\n');
// }

// const lines =
//   session.data.items.map(
//     (item, index) =>
//       `${index + 1}. ${item.medicineName}
// Batch: ${item.batch}
// Qty: ${item.quantity}`
//   );

// session.step =
//   STEPS.CONFIRM_ENTRY;

// await context.sessionManager.saveSession(
//   context.userId,
//   session
// );

// return [
//   'Dispensing Summary',
//   '',
//   ...lines,
//   '',
//   '1 Confirm',
//   '2 Cancel'
// ].join('\n');

case STEPS.SEARCH_MEDICINE:

if (text === '0') {

  session.step =
    STEPS.PATIENT_TYPE;

  await context.sessionManager.saveSession(
    context.userId,
    session
  );

  return [
    'STEP 1 OF 3',
    'PATIENT',
    '',
    '1 Existing Patient',
    '',
    '2 New Patient',
    '',
    '3 Search Medicine',
    '',
    'Reply with 1, 2 or 3'
  ].join('\n');
}

try {

  const medicines =
    await dispensingService
      .searchMedicinesForLookup(
        text,
        session.facilityId
      );

  if (!medicines.length) {
    return [
      'Medicine not found',
      '',
      'Try another medicine',
      '',
      '0 Back'
    ].join('\n');
  }

  const response = [
    'MEDICINES FOUND',
    ''
  ];

  for (const med of medicines) {

    response.push(
      `${med.name}`
    );

    response.push(
      `Total Stock: ${med.stock}`
    );

    response.push('');

    for (const batch of med.batches) {

      response.push(
        `Batch: ${batch.batchNumber}`
      );

      response.push(
        `Stock: ${batch.stock}`
      );

      response.push(
        `Expiry: ${batch.expiryDate}`
      );

      response.push('');
    }

    if (med !== medicines[medicines.length - 1]) {
      response.push('');
    }
  }

  response.push(
    'Search another medicine'
  );

  response.push('');

  response.push(
    '0 Back'
  );

  return response.join('\n');

} catch (err) {

  console.log(err);

  return [
    'Medicine not found',
    '',
    'Try another medicine',
    '',
    '0 Back'
  ].join('\n');
}


case STEPS.SELECT_EXISTING_PATIENT: {

  const option = parseInt(text, 10);

  const patients =
    session.data.phoneMatches || [];

  if (
    option >= 1 &&
    option <= patients.length
  ) {

    const patient =
      patients[option - 1];

    session.data.patientId =
      patient.id;

    session.data.patientName =
      patient.firstName;

    session.data.patientPhone =
      patient.phoneNumber;

    session.step =
      STEPS.PROCEED_TO_PRESCRIPTION;

    await context.sessionManager.saveSession(
      context.userId,
      session
    );

   return [
  'Patient Selected',
  '',
  `Name: ${patient.firstName}`,
  `Age: ${patient.age ?? 'N/A'}`,
  `Gender: ${patient.gender ?? 'N/A'}`,
  `Phone: ${patient.phoneNumber ?? 'N/A'}`,
  '',
  'Proceed to Prescription?',
  '',
  '1 YES',
  '',
  '0 NO'
].join('\n');
  }

  

  return 'Select a valid option';
}

    case STEPS.MEDICINE_ENTRY:

try {

  const medicines =
    await dispensingService.searchMedicines(
      text,
      session.facilityId
    );

    console.log(
  'MEDICINES FOUND:',
  medicines.length
);

console.log(
  JSON.stringify(medicines, null, 2)
);

  if (!medicines.length) {
    return 'No medicines found';
  }

  if (medicines.length === 1) {

  const selectedMedicine =
    medicines[0];

  session.data.product =
    selectedMedicine;

  session.data.batch =
    selectedMedicine.batchNumber;

  session.data.batchId =
    selectedMedicine.batchId;

  session.step =
    STEPS.QUANTITY_ENTRY;

  await context.sessionManager.saveSession(
    context.userId,
    session
  );

  return [
    `Medicine Found`,
    '',
    `${selectedMedicine.name}`,
    `Batch: ${selectedMedicine.batchNumber}`,
    `Expiry: ${selectedMedicine.expiryDate}`,
    `Available Stock: ${selectedMedicine.stock}`,
    '',
    'Enter quantity dispensed:'
  ].join('\n');
}

  session.data.searchResults = medicines;

  session.step = STEPS.SELECT_MEDICINE;

  await context.sessionManager.saveSession(
    context.userId,
    session
  );

  const list = medicines.flatMap((m, index) => [
    `${index + 1}. ${m.name}
Batch: ${m.batchNumber}
Expiry: ${m.expiryDate}
Stock: ${m.stock}`,
    ...(index < medicines.length - 1 ? [''] : [])
  ]);

  return [
    'Select Medicine',
    '',
    ...list,
    '',
    'Reply with option number'
  ].join('\n');

} catch (err) {
  return err.message;
}

case STEPS.OCR_SUGGESTION:


console.log('ENTERED OCR_SUGGESTION');
console.log('PENDING SUGGESTION:', session.data.pendingSuggestion);

  // OCR FAILED - NO SUGGESTION AVAILABLE
if (!session.data.pendingSuggestion) {

  if (text === '1') {
    resetOcrState(session);

    session.step =
      STEPS.PRESCRIPTION_UPLOAD;

    await context.sessionManager.saveSession(
      context.userId,
      session
    );

    return [
      'Upload another prescription image',
      '',
      '0 Skip'
    ].join('\n');
  }

  if (text === '2') {

    resetOcrState(session);
    session.step =
      STEPS.MEDICINE_ENTRY;

    await context.sessionManager.saveSession(
      context.userId,
      session
    );

    return 'Enter medicine name manually';
  }

  

  if (text === '0') {

    await context.sessionManager.clearSession(
      context.userId
    );

    return menuFlow.renderMainMenu();
  }

  return 'Select 1, 2 or 0';
}

  if (session.data.pendingSuggestion.ambiguous) {
    if (text === '2') {
      resetOcrState(session);
      session.step = STEPS.PRESCRIPTION_UPLOAD;
      await context.sessionManager.saveSession(context.userId, session);
      return ['Upload another prescription image', '', '0 Skip'].join('\n');
    }

    if (text === '3') {
      resetOcrState(session);
      session.step = STEPS.MEDICINE_ENTRY;
      await context.sessionManager.saveSession(context.userId, session);
      return 'Enter medicine name manually';
    }

    if (text === '0') {
      await context.sessionManager.clearSession(context.userId);
      return menuFlow.renderMainMenu();
    }

    return 'Select 2, 3 or 0';
  }
  // OCR FOUND A POSSIBLE MATCH
  if (text === '1') {
    const suggestion = session.data.pendingSuggestion;
    const medicines = suggestion.suggestedMedicine
      ? await dispensingService.resolveSuggestedMedicine(
          suggestion,
          session.facilityId
        )
      : await dispensingService.searchMedicinesForLookup(
          suggestion.suggested,
          session.facilityId
        );
    const medicine = medicines[0];
    const firstBatch = medicine.batches?.[0];
    const candidate = Array.isArray(session.data.ocrCandidates)
      ? session.data.ocrCandidates[suggestion.candidateIndex]
      : null;
    const acceptedItem = toOcrItem({
      id: medicine.id,
      name: medicine.name,
      batchNumber: medicine.batchNumber || firstBatch?.batchNumber,
      expiryDate: medicine.expiryDate || firstBatch?.expiryDate,
      stock: medicine.stock ?? firstBatch?.stock
    }, candidate);

    if (Array.isArray(session.data.ocrCandidates)) {
      session.data.items = session.data.items || [];
      addOrMergeOcrItem(session, acceptedItem);
      session.data.pendingSuggestion = null;
      session.data.ocrCandidateIndex = suggestion.candidateIndex + 1;
      return processOcrCandidates(context, session);
    }

    session.data.items = [acceptedItem];
    session.data.pendingSuggestion = null;
    session.step = STEPS.OCR_REVIEW;
    await context.sessionManager.saveSession(context.userId, session);

    return [
      'Match Accepted',
      '',
      `${medicine.name}`,
      `Batch: ${firstBatch?.batchNumber || 'N/A'}`,
      `Expiry: ${firstBatch?.expiryDate || 'N/A'}`,
      `Stock: ${firstBatch?.stock || 0}`,
      '',
      '1 Continue',
      '',
      '2 Cancel'
    ].join('\n');
  }
  if (text === '2') {
    resetOcrState(session);

    session.step =
      STEPS.PRESCRIPTION_UPLOAD;

    await context.sessionManager.saveSession(
      context.userId,
      session
    );

    return [
      'Upload another prescription image',
      '',
      '0 Skip'
    ].join('\n');
  }

  if (text === '3') {

    resetOcrState(session);
    session.step =
      STEPS.MEDICINE_ENTRY;

    await context.sessionManager.saveSession(
      context.userId,
      session
    );

    return 'Enter medicine name manually';
  }

  if (text === '0') {

    await context.sessionManager.clearSession(
      context.userId
    );

    return menuFlow.renderMainMenu();
  }

  return 'Select 1, 2, 3 or 0';



case STEPS.SELECT_MEDICINE: {

  const index = parseInt(text) - 1;

  const medicines =
    session.data.searchResults || [];

  if (
    isNaN(index) ||
    index < 0 ||
    index >= medicines.length
  ) {
    return 'Select a valid medicine number';
  }

  const selectedMedicine =
    medicines[index];

  session.data.product =
    selectedMedicine;

  session.data.batch =
    selectedMedicine.batchNumber;

  session.data.batchId =
    selectedMedicine.batchId;

  session.step =
    STEPS.QUANTITY_ENTRY;

  await context.sessionManager.saveSession(
    context.userId,
    session
  );

  return [
    `Selected: ${selectedMedicine.name}`,
    '',
    `Batch: ${selectedMedicine.batchNumber}`,
    `Expiry: ${selectedMedicine.expiryDate}`,
    `Available Stock: ${selectedMedicine.stock}`,
    '',
    'Enter quantity dispensed:'
  ].join('\n');
}


    case STEPS.RX_ID:

session.data.rxId = text;

session.step =
  STEPS.PRESCRIPTION_UPLOAD;

await context.sessionManager.saveSession(
  context.userId,
  session
);

return 'Upload Prescription or type SKIP';

   case STEPS.QUANTITY_ENTRY:
  try {

    const qty = parseInt(text, 10);

    if (
      isNaN(qty) ||
      qty <= 0
    ) {
      return 'Quantity must be greater than 0';
    }

    await dispensingService.validateStock(
      session.data.product.id,
      session.facilityId,
      qty
    );

    session.data.items.push({
      productId:
        session.data.product.id,

      medicineName:
        session.data.product.name,

      quantity: qty,

      batch:
        session.data.batch,

      controlledDrug:
        session.data.product.controlledDrug
    });

    session.step =
      STEPS.ADD_MORE_MEDICINES;

    await context.sessionManager.saveSession(
      context.userId,
      session
    );

    return [
      'Medicine Added',
      '',
      `Medicine: ${session.data.product.name}`,
      `Quantity: ${qty}`,
      '',
      '1 Add Another Medicine',
      '',
      '2 Continue'
    ].join('\n');

  } catch (err) {
    return err.message;
  }


      case STEPS.POST_DISPENSE:

  if (text === '1') {

    return start(context);
  }

  if (text === '0') {

    await context.sessionManager.clearSession(
      context.userId
    );

    return menuFlow.renderMainMenu();
  }

  return 'Select 1 or 0';

      case STEPS.PATIENT_ID:

session.data.patientId = text;

session.step =
  STEPS.PRESCRIPTION_UPLOAD;

await context.sessionManager.saveSession(
  context.userId,
  session
);

return 'Upload Prescription or type SKIP';

      case STEPS.ADD_MORE_MEDICINES:

  if (text === '1') {

    session.step =
      STEPS.MEDICINE_ENTRY;

    await context.sessionManager
      .saveSession(
        context.userId,
        session
      );

    return 'Search next medicine:';
  }

  if (text === '2') {

  session.step =
    STEPS.CONFIRM_ENTRY;

await context.sessionManager.saveSession(
  context.userId,
  session
);

const prescriptionLines =
  session.data.items.map(
    (item,index)=>
      `${index+1}. ${item.medicineName}
Batch: ${item.batch}
Qty: ${item.quantity}`
  );

return [
  'DISPENSING SUMMARY',
  '',
  `Patient: ${session.data.patientName}`,
  '',
  ...prescriptionLines.flatMap((line, index) => [
        line,
        ...(index < prescriptionLines.length - 1 ? [''] : [])
      ]),
  '',
  `Prescription: ${
    session.data.prescriptionUploaded
      ? 'Uploaded'
      : 'Skipped'
  }`,
  '',
  '1 Confirm Dispense',
  '',
  '0 Cancel'
].join('\n');

}

  return [
    '1 Add Another Medicine',
    '',
    '2 Continue'
  ].join('\n');

   
  case STEPS.OCR_NAME_MISMATCH: {

  if (text === '1') {

    session.step =
      STEPS.PRESCRIPTION_UPLOAD;

    await context.sessionManager.saveSession(
      context.userId,
      session
    );

    return 'Upload another prescription image.';
  }

  if (text === '2') {

    console.log(
  'UPDATING PATIENT:',
  session.data.patientId,
  session.data.prescriptionName
);

 await dispensingService
  .updatePatientName(
    session.data.patientId,
    session.data.prescriptionName
  );

  session.data.patientName =
    session.data.prescriptionName;

  const parserService =
    require('../services/prescriptionParserService');

  const medicineCandidates = parserService.extractMedicineCandidates
    ? parserService.extractMedicineCandidates(session.data.ocrText, session.data.ocrLines)
    : parserService.extractMedicines(session.data.ocrText, session.data.ocrLines).map((medicineText) => ({
        rawText: medicineText,
        medicineText,
        prescribedQuantityText: null
      }));

  session.data.items = [];
  session.data.unmatchedMedicines = [];
  session.data.ocrCandidates = medicineCandidates;
  session.data.ocrCandidateIndex = 0;
  session.data.pendingSuggestion = null;
  return processOcrCandidates(context, session);

 const matched =
  session.data.items.map(
    (item, i) =>
      `${i + 1}. ${item.medicineName}
Batch: ${item.batch}
Expiry: ${item.expiryDate}
Stock: ${item.availableStock}`
  );

const unmatched =
  session.data.unmatchedMedicines.length
    ? session.data.unmatchedMedicines.map(
        m => `• ${m}`
      )
    : ['None'];

return [
  '✅ Patient Name Updated',
  '',
  `New Name: ${session.data.patientName}`,
  '',
  'PRESCRIPTION ANALYSIS',
  '',
  '✅ MEDICINES IN STOCK',
  '',
  ...matched.flatMap((line, index) => [
    line,
    ...(index < matched.length - 1 ? [''] : [])
  ]),
  '',
  '❌ MEDICINES OUT OF STOCK',
  '',
  ...unmatched,
  '',
  '1 Continue',
  '',
  '2 Cancel'
].join('\n');
}

  if (text === '0') {

    await context.sessionManager.clearSession(
      context.userId
    );

    return menuFlow.renderMainMenu();
  }

  return [
    '1 Upload Another Prescription',
    '',
    '2 Use Prescription Name',
    '',
    '0 Cancel'
  ].join('\n');
}

    case STEPS.CONFIRM_ENTRY:
      
    if (text === '1') {

  for (const item of session.data.items) {

  await dispensingService.dispense({
    facilityId: session.facilityId,
    userId: session.userDbId,
    productId: item.productId,
    quantity: item.quantity,
    patientName: session.data.patientName,
    patientId: session.data.patientId
  });

}

try {

  const patientPhone =
    session.data.patientPhone ||
    session.data.phone;

  if (patientPhone) {

    const medicines =
      session.data.items
        .map(
          item =>
            `• ${item.medicineName} - Qty ${item.quantity}`
        )
        .join('\n');

    const message = `
🏥 ${session.actor.facilityName}

Hello ${session.data.patientName},

Your medicines have been dispensed successfully.

${medicines}

Date:
${new Date().toLocaleString()}

Thank you.
`;

    await patientNotificationService
      .notifyPatient(
        patientPhone,
        message
      );

    console.log(
      'PATIENT NOTIFICATION SENT'
    );
  }

} catch (err) {

  console.error(
    'PATIENT NOTIFICATION FAILED',
    err
  );

}

  session.step = STEPS.POST_DISPENSE;

  await context.sessionManager.saveSession(
    context.userId,
    session
  );

 return [
  `✅ Medicine Dispensed Successfully To: ${session.data.patientName}`,
  '',
  '1 New Dispensing',
  '',
  '0 Main Menu'
].join('\n');
}

      if (text === '0')  {

  await context.sessionManager.clearSession(
    context.userId
  );

  return menuFlow.renderMainMenu();
}

return 'Select 1 or 0';

     

    default:
      await context.sessionManager.clearSession(
        context.userId
      );
      return menuFlow.renderMainMenu();
  }
}

module.exports = {
  start,
  handle,
  _testing: {
    mergeOcrItems,
    addOrMergeOcrItem,
    formatQuantityToDispense,
    renderQuantityPrompt,
    renderDispensingSummary,
    STEPS
  }
};
