const db = require('../../postdb');
const inventoryService = require('./inventoryService');

const stringSimilarity =
  require('string-similarity');

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

async function getMedicineBatches(
  productId,
  facilityId
) {
  return inventoryService.getAvailableBatches(
    productId,
    facilityId
  );
}


async function resolveMedicineAvailability(medicine, facilityId) {
  console.log(
    'USER FACILITY:',
    facilityId
  );
  console.log(
    'MEDICINE ID:',
    medicine.id
  );

  const stock = await inventoryService.getAvailableStock(
    medicine.id,
    facilityId
  );

  if (stock <= 0) {
    console.log('MEDICINE FOUND BUT NO STOCK');
    throw new Error('Medicine out of stock.');
  }

  const batches = await inventoryService.getAvailableBatches(
    medicine.id,
    facilityId
  );
  const batch = batches[0];

  return [{
    ...medicine,
    stock,
    batchId: batch?.id || null,
    batchNumber: batch?.batchNumber || 'N/A',
    expiryDate: batch?.expiryDate || 'N/A'
  }];
}

async function resolveSuggestedMedicine(suggestion, facilityId) {
  if (!suggestion?.suggestedMedicine?.id) {
    throw new Error('Suggested medicine is unavailable.');
  }

  return resolveMedicineAvailability(
    suggestion.suggestedMedicine,
    facilityId
  );
}
async function searchMedicines(
  query,
  facilityId
) {
  const structured = await inventoryService.findStructuredMedicine(query);

  if (structured.status === 'matched') {
    console.log('STRUCTURED MATCH FOUND:', structured.medicine.name);
    return resolveMedicineAvailability(structured.medicine, facilityId);
  }

  if (structured.status === 'ambiguous') {
    return [{
      detected: query,
      suggested: null,
      confidence: 0,
      ambiguous: true,
      alternatives: structured.matches.map((medicine) => ({
        name: medicine.medicineName,
        strength: medicine.strength,
        formulation: medicine.dosageForm
      }))
    }];
  }

  if (!structured.identity.strength) {
    try {
      const results = await inventoryService.lookupAvailableInventory(
        query,
        facilityId,
        20
      );

      if (results.length) {
        console.log('DIRECT MATCH FOUND:', results[0].name);
        return results;
      }
    } catch (err) {
      console.log('DIRECT MATCH FAILED:', err.message);
    }
  }

  console.log('NO DIRECT MATCH. TRYING FUZZY:', query);

  const fuzzy = await inventoryService.findMedicineFuzzy(query, {
    requiredStrength: structured.identity.strength || undefined
  });

  if (!fuzzy) {
    throw new Error('Medicine not found.');
  }

  const medicine = fuzzy.medicine;
  const confidence = fuzzy.confidence;

  if (!medicine) {
    return [{
      detected: query,
      suggested: null,
      confidence: 0
    }];
  }

  console.log('FUZZY MATCH FOUND:', medicine.name);

  if (confidence >= 40 && confidence < 80) {
    return [{
      detected: fuzzy.detected,
      suggested: medicine.name,
      suggestedMedicine: medicine,
      confidence
    }];
  }

  return resolveMedicineAvailability(medicine, facilityId);
}
async function updatePatientName(
  patientId,
  patientName
) {

  await db.query(
    `
    UPDATE "Patient"
    SET
      "firstName" = $1,
      "updatedAt" = NOW()
    WHERE id = $2
    `,
    [
      patientName,
      patientId
    ]
  );
}


async function searchMedicinesForLookup(
  query,
  facilityId
) {

  const medicines =
    await inventoryService
      .lookupAvailableInventory(
        query,
        facilityId,
        50
      );

  const results = [];

  for (const medicine of medicines) {

    const stock =
      await inventoryService
        .getAvailableStock(
          medicine.id,
          facilityId
        );

    const batches =
      await inventoryService
        .getAvailableBatches(
          medicine.id,
          facilityId
        );

    results.push({
      ...medicine,
      stock,
      batches
    });
  }

  return results;
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

async function dispense(input) {
  return inventoryService.consumeStock({
    facilityId: input.facilityId,
    userId: input.userId,
    patientId: input.patientId,
    product: {
      id: input.productId
    },
    quantity: input.quantity
  });
}

async function findPatientByPhone(phone) {

  const rows = await db.query(
    `
    SELECT
      id,
      "patientId",
      "firstName",
      "lastName",
       age,
       gender,
      "phoneNumber"
    FROM "Patient"
    WHERE "phoneNumber" = $1
    `,
    [phone]
  );

  console.log(
    'PATIENTS FOUND:',
    JSON.stringify(rows, null, 2)
  );

  return rows;
}


async function createPatient(input) {



  const id =
    'PATIENT-' + Date.now();

  const patientId =
    'PAT-' + Date.now();

  await db.query(
    `
    INSERT INTO "Patient" (
      id,
      "patientId",
      "firstName",
      "lastName",
      gender,
      age,
      "phoneNumber",
      "facilityId",
      "registrationDate",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,
      NOW(),NOW(),NOW()
    )
    `,
    [
      id,
      patientId,
      input.name,
      '',
      input.gender,
      input.age ?? null,
      input.phone,
      input.facilityId
    ]
  );

  return id;
}


async function searchMedicinesFromText(
  extractedText,
  facilityId
) {

  const medicines = [];

  const lines =
    extractedText
      .split('\n')
      .map(x => x.trim())
      .filter(Boolean);

 for (let line of lines) {

  line = line

    .replace(/^Rx\s+/i, '')
    .replace(/^\d+\.\s*/, '')
    .replace(/#\d+/g, '')

    .replace(/\bTake\b.*$/i, '')
    .replace(/\bSig\b.*$/i, '')
    .replace(/\bDirections\b.*$/i, '')

    .replace(/\btablet(s)?\b.*$/i, '')
    .replace(/\bcapsule(s)?\b.*$/i, '')

    .replace(/\bpo\b.*$/i, '')
    .replace(/\bbid\b.*$/i, '')
    .replace(/\btid\b.*$/i, '')
    .replace(/\bqid\b.*$/i, '')

    .replace(/\(.*?\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (line.length < 3) {
    continue;
  }

  if (
    /patient|address|date|doctor|dea|refill|signature/i
      .test(line)
  ) {
    continue;
  }

  try {

    const results =
      await searchMedicines(
        line,
        facilityId
      );

    for (const medicine of results) {

  if (medicine.suggested) {

    medicines.push({
      type: 'suggestion',
      detected: medicine.detected,
      suggested: medicine.suggested,
      confidence: medicine.confidence
    });

    continue;
  }

  const exists =
    medicines.some(
      x => x.id === medicine.id
    );

  if (!exists) {
    medicines.push(medicine);
  }
}

  } catch (err) {

    console.log(
      'MATCH FAILED:',
      line
    );
  }
}


if (!medicines.length) {

  throw new Error(
    'No medicines detected'
  );
}

  return medicines;
}

module.exports = {
  lookupMedicine,
  searchMedicines,
  resolveSuggestedMedicine,
  updatePatientName,
  searchMedicinesForLookup,
  searchMedicinesFromText,
  getMedicineBatches,
  validateStock,
  dispense,
  findPatientByPhone,
  createPatient
};