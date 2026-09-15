// const db = require('../config/db');
const db = require('../../postdb');
const env = require('../config/env');
const Fuse = require('fuse.js');
const AppError = require('../utils/appError');
const { searchProducts } = require('../utils/fuzzySearch');
const stringSimilarity =
  require('string-similarity');

const TX = {
  CONSUMPTION: '2',
  ADJUSTMENT: '3',
  EXPIRED: '4',
  TRANSFER_IN: '8',
  TRANSFER_OUT: '9'
};

function makeId() {
  return 'REC-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
}

function normalizeProduct(row = {}) {
  return {
    id: row.id,
    code: row.product_code || row.code,
    name: row.name,
    generic_name: null,
    strength: null,
    formulation: null,
    description: row.description || null,
    unit: row.unit_of_measure || null
  };
}

function normalizeMedicineName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normalizeStrength(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function normalizeDosageForm(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/s$/, '');
}

function parseMedicineIdentity(query) {
  const text = String(query || '').trim().replace(/\s+/g, ' ');
  const formMatch = text.match(/\s+(tablet|capsule|syrup|suspension|injection|drops?|ointment|cream|gel|inhaler|vial|ampoule)s?$/i);
  const dosageForm = formMatch ? formMatch[1] : null;
  const withoutForm = formMatch ? text.slice(0, formMatch.index).trim() : text;
  const strengthMatch = withoutForm.match(/^(.*?)\s+(\d+(?:\.\d+)?\s*(?:mcg|mg|g|ml|iu|units?)(?:\s*\/\s*\d+(?:\.\d+)?\s*(?:mcg|mg|g|ml|iu|units?))?)$/i);

  return {
    name: normalizeMedicineName(strengthMatch ? strengthMatch[1] : withoutForm),
    strength: strengthMatch ? normalizeStrength(strengthMatch[2]) : null,
    dosageForm: dosageForm ? normalizeDosageForm(dosageForm) : null
  };
}

async function findStructuredMedicine(query) {
  const identity = parseMedicineIdentity(query);

  if (!identity.name || !identity.strength) {
    return { status: 'not_found', identity };
  }

  const rows = await db.query(`
    SELECT
      id,
      "medicineName",
      "genericName",
      strength,
      "dosageForm",
      "isActive"
    FROM "Medicine"
    WHERE "isActive" = true
  `);

  let matches = rows.filter((medicine) => {
    if (medicine.isActive === false) {
      return false;
    }

    const nameMatches = normalizeMedicineName(medicine.medicineName) === identity.name;
    const genericMatches = normalizeMedicineName(medicine.genericName) === identity.name;

    return (nameMatches || genericMatches)
      && normalizeStrength(medicine.strength) === identity.strength;
  });

  if (matches.length > 1 && identity.dosageForm) {
    matches = matches.filter((medicine) =>
      normalizeDosageForm(medicine.dosageForm) === identity.dosageForm
    );
  }

  if (matches.length !== 1) {
    return {
      status: matches.length ? 'ambiguous' : 'not_found',
      identity,
      matches
    };
  }

  const medicine = matches[0];
  return {
    status: 'matched',
    identity,
    medicine: {
      id: medicine.id,
      name: medicine.medicineName,
      generic_name: medicine.genericName,
      strength: medicine.strength,
      formulation: medicine.dosageForm
    }
  };
}
function productIdFrom(input) {
  return input.productId || input.product_id || input.product?.id;
}

async function loadActiveProducts(limit = 1500) {
  const rows = await db.query(
    `
    SELECT id, product_code, name, description, unit_of_measure
    FROM product
    WHERE active = 1 OR active IS NULL
    ORDER BY name
    LIMIT ?
    `,
    [limit]
  );

  return rows.map(normalizeProduct);
}

async function searchProductsByQuery(query) {

  const rows = await db.query(
    `
    SELECT
      id,
      "medicineName",
      "genericName",
      strength,
      "dosageForm"
    FROM "Medicine"
    WHERE LOWER("medicineName")
      LIKE LOWER($1)
      AND "isActive" = true
    ORDER BY "medicineName"
    `,
    [`${query}%`]
  );

  return rows.map(row => ({
    id: row.id,
    name: row.medicineName,
    generic_name: row.genericName,
    strength: row.strength,
    formulation: row.dosageForm
  }));
}


async function findMedicineFuzzy(query, options = {}) {

  const rows = await db.query(`
    SELECT
      id,
      "medicineName",
      "genericName",
      strength,
      "dosageForm"
    FROM "Medicine"
    WHERE "isActive" = true
  `);

  const compatibleRows = options.requiredStrength
    ? rows.filter((medicine) =>
        normalizeStrength(medicine.strength) === options.requiredStrength
      )
    : rows;

  if (!compatibleRows.length) {
    return null;
  }

  const fuse = new Fuse(compatibleRows, {
    keys: [
      "medicineName",
      "genericName",
      "strength"
    ],
    includeScore: true,
    threshold: 0.4
  });

  const matches = fuse.search(query);

  if (!matches.length) {
    return null;
  }

  const best = matches[0];

  const medicine = best.item;

  const confidence =
    Math.round(
      (1 - (best.score || 0)) * 100
    );

  console.log(
    'FUSE MATCH:',
    medicine.medicineName,
    confidence + '%'
  );

  if (confidence < 40) {
    return null;
  }

  return {
    medicine: {
      id: medicine.id,
      name: medicine.medicineName,
      generic_name: medicine.genericName,
      strength: medicine.strength,
      formulation: medicine.dosageForm
    },
    confidence,
    detected: query,
    alternatives: matches
      .slice(0, 3)
      .map(x => ({
        name: x.item.medicineName,
        confidence:
          Math.round(
            (1 - (x.score || 0)) * 100
          )
      }))
  };
}


async function findBestProduct(query) {
  const [product] = await searchProductsByQuery(query, 1);
  return product || null;
}

async function getProductById(productId) {
  const rows = await db.query(
    `
    SELECT id, product_code, name, description, unit_of_measure
    FROM product
    WHERE id = ?
    LIMIT 1
    `,
    [productId]
  );

  return rows[0] ? normalizeProduct(rows[0]) : null;
}

async function getAvailableStock(
  medicineId,
  facilityId
) {

  const rows = await db.query(
    `
    SELECT
      COALESCE(
        SUM(quantity),
        0
      ) AS stock
    FROM "StockBatch"
    WHERE "medicineId" = $1
      AND "facilityId" = $2
      AND quantity > 0
      AND (
        "expiryDate" IS NULL
        OR "expiryDate" >= CURRENT_DATE
      )
    `,
    [medicineId, facilityId]
  );

  return Number(rows[0]?.stock || 0);
}

async function getOpeningStock(
  productId,
  facilityId
) {
  return getAvailableStock(
    productId,
    facilityId
  );
}


async function createPendingApproval(input) {

  await db.query(
    `
    INSERT INTO consumption_approval
    (
      id,
      facility_id,
      product_id,
      requested_quantity,
      opening_stock,
      status,
      requested_by
    )
    VALUES
    (?, ?, ?, ?, ?, 'PENDING', ?)
    `,
    [
      makeId(),
      input.facilityId,
      input.productId,
      input.quantity,
      input.openingStock,
      input.userId
    ]
  );

  return true;
}

async function resetNonReportingAlert(
  facilityId
) {

  await db.query(
    `
    UPDATE notification_jobs
    SET status = 'cancelled'
    WHERE facility_id = ?
      AND type = 'NON_REPORTING'
      AND status = 'pending'
    `,
    [facilityId]
  );

  return true;
}

async function lookupAvailableInventory(
  query,
  facilityId,
  limit = 20
) {

  const products =
    await searchProductsByQuery(
      query,
      50
    );

  const results = [];

  for (const product of products) {

    const stock =
      await getAvailableStock(
        product.id,
        facilityId
      );

    if (stock <= 0) {
      continue;
    }

    const batches =
      await getAvailableBatches(
        product.id,
        facilityId
      );

    const firstBatch =
      batches[0];

    results.push({
      ...product,
      stock,

      batchId:
        firstBatch?.id || null,

      batchNumber:
        firstBatch?.batchNumber || 'N/A',

      expiryDate:
        firstBatch?.expiryDate || 'N/A'
    });

    if (
      results.length >= limit
    ) {
      break;
    }
  }

  return results;
}

async function resolveActor(phoneNumber) {

  const cleanPhone = String(phoneNumber)
    .replace('whatsapp:', '')
    .trim();

  const rows = await db.query(
    `
    SELECT
      u.id,
      u."firstName",
      u."lastName",
      u.role,
      u.phone,
      u."facilityId",
      f.name AS "facilityName"
    FROM "User" u
    JOIN "Facility" f
      ON f.id = u."facilityId"
    WHERE u.phone = $1
      AND u."isActive" = true
    `,
    [cleanPhone]
  );

  if (!rows.length) {
    throw new AppError(
      `User not found for phone ${cleanPhone}`,
      403
    );
  }

  const user = rows[0];

  return {
    userId: user.id,
    userName:
      `${user.firstName} ${user.lastName}`,
    role: user.role,
    facilityId: user.facilityId,
    facilityName: user.facilityName,
    pinCode: null,
    failedAttempts: 0,
    lockedUntil: null
  };
}

async function createTransaction(
  connection,
  transactionTypeId,
  facilityId,
  userId,
  comment
) {
  const id = makeId();

  await connection.execute(
    `
    INSERT INTO transaction
    (
      id,
      version,
      date_created,
      last_updated,
      transaction_date,
      transaction_type_id,
      destination_id,
      created_by_id,
      comment,
      confirmed
    )
    VALUES
    (?,0,UTC_TIMESTAMP(),UTC_TIMESTAMP(),UTC_TIMESTAMP(),?,?,?,?,1)
    `,
    [
      id,
      transactionTypeId,
      facilityId,
      userId,
      comment
    ]
  );

  return id;
}

async function receiveStock(input) {
  const facilityId = input.facilityId;

  if (!facilityId) {
    throw new AppError('Facility mapping missing for user.', 400);
  }

  const productId = productIdFrom(input);

  if (!productId) {
    throw new AppError('Product is required.', 400);
  }

  return db.transaction(async (connection) => {
    let inventoryItemId;

    const [existingBatch] = await connection.execute(
      `
      SELECT id
      FROM inventory_item
      WHERE product_id = ?
        AND lot_number = ?
      LIMIT 1
      `,
      [
        productId,
        input.batchNumber || null
      ]
    );

    if (existingBatch.length > 0) {
      inventoryItemId = existingBatch[0].id;
    } else {
      inventoryItemId = makeId();

      await connection.execute(
        `
        INSERT INTO inventory_item
        (
          id,
          version,
          date_created,
          last_updated,
          lot_number,
          product_id,
          expiration_date,
          comments,
          lot_status
        )
        VALUES
        (?,0,UTC_TIMESTAMP(),UTC_TIMESTAMP(),?,?,?,?,'ACTIVE')
        `,
        [
          inventoryItemId,
          input.batchNumber || null,
          productId,
          input.expiryDate || null,
          'Received via WhatsApp'
        ]
      );
    }

    const deliveryStatus =
      input.deliveryStatus === 'PARTIAL'
        ? 'Partial Delivery'
        : 'Full Delivery';

    const txId = await createTransaction(
      connection,
      TX.TRANSFER_IN,
      facilityId,
      input.userId || null,
      `Receipt via WhatsApp - ${deliveryStatus}`
    );

    await connection.execute(
      `
      INSERT INTO transaction_entry
      (
        id,
        version,
        inventory_item_id,
        quantity,
        transaction_id,
        product_id,
        comments
      )
      VALUES
      (?,0,?,?,?,?,?)
      `,
      [
        makeId(),
        inventoryItemId,
        input.quantity,
        txId,
        productId,
        'Receipt'
      ]
    );

    const [productRows] = await connection.execute(
      `
      SELECT id, product_code, name, description, unit_of_measure
      FROM product
      WHERE id = ?
      LIMIT 1
      `,
      [productId]
    );

    const product = productRows[0]
      ? normalizeProduct(productRows[0])
      : null;

    return {
      transactionId: txId,
      batchId: inventoryItemId,
      quantity: input.quantity,
      batchNumber: input.batchNumber,
      expiryDate: input.expiryDate,
      product,
      deliveryStatus,
      facilityId
    };
  });
}

async function consumeStock(input) {

  const facilityId = input.facilityId;
  const medicineId = input.product.id;

  const available =
    await getAvailableStock(
      medicineId,
      facilityId
    );

  if (available < input.quantity) {
    throw new AppError(
      `Insufficient stock. Available ${available}`,
      409
    );
  }

  const batches =
    await getAvailableBatches(
      medicineId,
      facilityId
    );

  const batch = batches[0];

  if (!batch) {
    throw new AppError(
      'No batch available.',
      400
    );
  }

  return db.transaction(
    async (client) => {

      const txId =
        'TX-' + Date.now();

      const dispenseId =
        'DSP-' + Date.now();

      const balanceBefore =
        available;

      const balanceAfter =
        available - input.quantity;

      await client.query(
        `
        INSERT INTO "StockTransaction" (
          id,
          "facilityId",
          "medicineId",
          "batchId",
          type,
          quantity,
          "balanceBefore",
          "balanceAfter",
          "performedById",
          "patientId",
          "createdAt"
        )
        VALUES (
          $1,$2,$3,$4,
          'DISPENSING',
          $5,$6,$7,$8,$9,NOW()
        )
        `,
        [
          txId,
          facilityId,
          medicineId,
          batch.id,
          input.quantity,
          balanceBefore,
          balanceAfter,
          input.userId,
          input.patientId || null
        ]
      );

      await client.query(
        `
        UPDATE "StockBatch"
        SET quantity = quantity - $1
        WHERE id = $2
        `,
        [
          input.quantity,
          batch.id
        ]
      );

      await client.query(
        `
        INSERT INTO "DispensingRecord" (
          id,
          "facilityId",
          "patientId",
          "medicineId",
          "batchId",
          "batchNumber",
          "expiryDate",
          quantity,
          "dispensedById",
          "dispensedAt",
          "recipientType"
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,
          $8,$9,NOW(),
          'PATIENT'
        )
        `,
        [
          dispenseId,
          facilityId,
          input.patientId || null,
          medicineId,
          batch.id,
          batch.batchNumber,
          batch.expiryDate,
          input.quantity,
          input.userId
        ]
      );

      return {
        transactionId: txId,
        dispensingId: dispenseId
      };
    }
  );
}

async function transferOut(input) {
  const facilityId = input.facilityId;

  if (!facilityId) {
    throw new AppError('Facility mapping missing for user.', 400);
  }

  const productId = productIdFrom(input);

  const available = await getAvailableStock(productId, facilityId);

  if (available < input.quantity) {
    throw new AppError(
      `Insufficient stock. Available ${available}`,
      409
    );
  }

  return db.transaction(async (connection) => {
    const txId = await createTransaction(
      connection,
      TX.TRANSFER_OUT,
      input.destinationFacilityId,
      input.userId || null,
      `Transfer Out via WhatsApp - ${input.transferCode}`
    );

    await connection.execute(
      `
      UPDATE transaction
      SET source_id = ?
      WHERE id = ?
      `,
      [facilityId, txId]
    );

    await connection.execute(
      `
      INSERT INTO transaction_entry
      (
        id,
        version,
        quantity,
        transaction_id,
        product_id,
        comments
      )
      VALUES
      (?,0,?,?,?,?)
      `,
      [
        makeId(),
        -Math.abs(input.quantity),
        txId,
        productId,
        'Transfer Out'
      ]
    );

    return {
      transactionId: txId
    };
  });
}

async function findFacilityByNumber(locationNumber) {
  const rows = await db.query(
    `
    SELECT id, name, location_number
    FROM location
    WHERE active = 1
      AND location_number = ?
    LIMIT 1
    `,
    [locationNumber]
  );

  return rows[0] || null;
}

async function createLocalTransfer(sourceTxId) {
  const id = makeId();

  await db.query(
    `
    INSERT INTO local_transfer
    (
      id,
      source_transaction_id,
      destination_transaction_id,
      version,
      date_created,
      last_updated
    )
    VALUES
    (?, ?, NULL, 0, UTC_TIMESTAMP(), UTC_TIMESTAMP())
    `,
    [id, sourceTxId]
  );

  return id;
}

async function getExpiringBatches(
  facilityId,
  thresholdDays = env.expiryAlertDays
) {
  return db.query(
    `
    SELECT
      ii.id AS batchId,
      ii.lot_number AS batchNumber,
      DATE_FORMAT(ii.expiration_date, '%Y-%m-%d') AS expiryDate,
      COALESCE(SUM(te.quantity), 0) AS availableQuantity,
      p.id AS productId,
      p.product_code AS code,
      p.name
    FROM inventory_item ii
    JOIN product p ON p.id = ii.product_id
    LEFT JOIN transaction_entry te ON te.inventory_item_id = ii.id
    JOIN transaction t ON t.id = te.transaction_id
    WHERE ii.expiration_date IS NOT NULL
      AND ii.expiration_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
      AND t.destination_id = ?
    GROUP BY ii.id, p.id
    HAVING COALESCE(SUM(te.quantity), 0) > 0
    ORDER BY ii.expiration_date ASC
    `,
    [thresholdDays, facilityId]
  );
}

async function acknowledgeExpiryBatch() {
  return true;
}

async function disposeBatch(input) {
  const facilityId = input.facilityId;

  if (!facilityId) {
  throw new AppError('Facility mapping missing for user.', 400);
}

  return db.transaction(async (connection) => {
    const txId = await createTransaction(
      connection,
      TX.EXPIRED,
      facilityId,
      input.userId || null,
      'Expiry disposal via WhatsApp'
    );

    await connection.execute(
      `
      INSERT INTO transaction_entry
      (
        id,
        version,
        inventory_item_id,
        quantity,
        transaction_id,
        product_id,
        comments
      )
      VALUES
      (?,0,?,?,?,?,?)
      `,
      [
        makeId(),
        input.batchId,
        -Math.abs(input.quantity),
        txId,
        input.product?.id || null,
        'Disposed'
      ]
    );

    return {
      transactionId: txId
    };
  });
}


async function getAvailableBatches(
  medicineId,
  facilityId
) {

  const rows = await db.query(
    `
    SELECT
      id,
      "batchNumber",
      TO_CHAR(
        "expiryDate",
        'YYYY-MM-DD'
      ) AS "expiryDate",
      quantity AS stock
    FROM "StockBatch"
    WHERE "medicineId" = $1
      AND "facilityId" = $2
      AND quantity > 0
      AND (
        "expiryDate" IS NULL
        OR "expiryDate" >= CURRENT_DATE
      )
    ORDER BY
      "expiryDate" ASC
    `,
    [medicineId, facilityId]
  );

  return rows.map(batch => ({
    id: batch.id,
    batchNumber: batch.batchNumber,
    expiryDate: batch.expiryDate,
    stock: Number(batch.stock)
  }));
}

async function recordAudit(input) {
  const facilityId = input.facilityId;

  if (!facilityId) {
  throw new AppError('Facility mapping missing for user.', 400);
}

  return db.transaction(async (connection) => {
    const variance =
      input.physicalQuantity - input.systemQuantity;

    const txId = await createTransaction(
      connection,
      TX.ADJUSTMENT,
      facilityId,
      input.userId || null,
      input.reason || 'Audit adjustment'
    );

    await connection.execute(
      `
      INSERT INTO transaction_entry
      (
        id,
        version,
        quantity,
        transaction_id,
        product_id,
        comments
      )
      VALUES
      (?,0,?,?,?,?)
      `,
      [
        makeId(),
        variance,
        txId,
        productIdFrom(input),
        input.reason || 'Audit'
      ]
    );

    return {
      auditId: txId,
      variance
    };
  });
}

async function listActiveUsersForFacility() {
  return [];
}

async function setUserPin(userId, pin) {
  await db.query(
    `
    UPDATE bot_user_links
    SET pin_code = ?, failed_attempts = 0, locked_until = NULL
    WHERE id = ?
    `,
    [pin, userId]
  );
}

async function incrementFailedAttempts(userId) {
  await db.query(
    `
    UPDATE bot_user_links
    SET failed_attempts = failed_attempts + 1
    WHERE id = ?
    `,
    [userId]
  );

  const rows = await db.query(
    `
    SELECT failed_attempts
    FROM bot_user_links
    WHERE id = ?
    LIMIT 1
    `,
    [userId]
  );

  return rows[0]?.failed_attempts || 0;
}

async function resetFailedAttempts(userId) {
  await db.query(
    `
    UPDATE bot_user_links
    SET failed_attempts = 0,
        locked_until = NULL,
        last_login = UTC_TIMESTAMP()
    WHERE id = ?
    `,
    [userId]
  );
}

async function lockUser(userId) {
  await db.query(
    `
    UPDATE bot_user_links
    SET locked_until = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE)
    WHERE id = ?
    `,
    [userId]
  );
}

async function findBatchByMedicineAndBatch(productId, batchNumber, facilityId) {
  let sql = `
    SELECT
      ii.id,
      ii.lot_number AS batchNumber,
      DATE_FORMAT(ii.expiration_date, '%Y-%m-%d') AS expiryDate,
      COALESCE(SUM(te.quantity), 0) AS stock
    FROM inventory_item ii
    LEFT JOIN transaction_entry te
      ON te.inventory_item_id = ii.id
    JOIN transaction t
      ON t.id = te.transaction_id
    WHERE ii.product_id = ?
      AND t.destination_id = ?
  `;

  const params = [productId, facilityId];

  if (batchNumber) {
    sql += ` AND ii.lot_number = ?`;
    params.push(batchNumber);
  }

  sql += `
    GROUP BY ii.id
    HAVING COALESCE(SUM(te.quantity), 0) > 0
    ORDER BY ii.expiration_date ASC
    LIMIT 1
  `;

  const rows = await db.query(sql, params);
  return rows;
}

async function createExpiryReminder(input) {
  if (!input.batchId) {
    throw new AppError('Batch is required for expiry alert.', 400);
  }

  const id = makeId();

  await db.query(
    `
    INSERT INTO expiry_alerts
    (
      id,
      inventory_item_id,
      facility_id,
      alert_days,
      expiry_date,
      created_by,
      active,
      created_at
    )
    VALUES
    (?, ?, ?, ?, ?, ?, 1, UTC_TIMESTAMP())
    `,
    [
      id,
      input.batchId,
      input.facilityId,
      input.alertDays,
      input.expiryDate,
      input.userId
    ]
  );

  return {
    id
  };
}

async function findTransferByCode(transferCode) {
  const rows = await db.query(
    `
    SELECT
      lt.id AS localTransferId,
      lt.source_transaction_id,
      lt.destination_transaction_id,
      t.transaction_number,
      t.source_id,
      t.destination_id,
      te.product_id,
      ABS(te.quantity) AS quantity,
      p.name AS product_name
    FROM local_transfer lt
    JOIN transaction t
      ON t.id = lt.source_transaction_id
    JOIN transaction_entry te
      ON te.transaction_id = t.id
    JOIN product p
      ON p.id = te.product_id
    WHERE t.transaction_number = ?
    LIMIT 1
    `,
    [transferCode]
  );

  return rows[0] || null;
}

async function completeTransfer(localTransferId, destinationTransactionId) {
  await db.query(
    `
    UPDATE local_transfer
    SET destination_transaction_id = ?
    WHERE id = ?
    `,
    [destinationTransactionId, localTransferId]
  );
}

async function getStockInsight(productId, facilityId) {
  const balanceRows = await db.query(
    `
    SELECT COALESCE(SUM(te.quantity), 0) AS balance
    FROM transaction_entry te
    JOIN transaction t
      ON t.id = te.transaction_id
    WHERE te.product_id = ?
      AND t.destination_id = ?
    `,
    [productId, facilityId]
  );

  const consumptionRows = await db.query(
    `
    SELECT COALESCE(SUM(ABS(te.quantity)), 0) / 30 AS avgDailyConsumption
    FROM transaction_entry te
    JOIN transaction t
      ON t.id = te.transaction_id
    WHERE te.product_id = ?
      AND t.destination_id = ?
      AND t.transaction_type_id = 2
      AND t.transaction_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    `,
    [productId, facilityId]
  );

  const expiryRows = await db.query(
    `
    SELECT
      ii.lot_number AS batchNumber,
      DATE_FORMAT(ii.expiration_date, '%d/%m/%Y') AS expiryDate
    FROM inventory_item ii
    LEFT JOIN transaction_entry te
      ON te.inventory_item_id = ii.id
    JOIN transaction t
      ON t.id = te.transaction_id
    WHERE ii.product_id = ?
      AND t.destination_id = ?
      AND ii.expiration_date IS NOT NULL
    GROUP BY ii.id
    HAVING COALESCE(SUM(te.quantity), 0) > 0
    ORDER BY ii.expiration_date ASC
    LIMIT 1
    `,
    [productId, facilityId]
  );

  const balance = Number(balanceRows[0]?.balance || 0);
  const avgDailyConsumption = Number(
    consumptionRows[0]?.avgDailyConsumption || 0
  );

  const thresholdRows = await db.query(
  `
  SELECT low_stock_threshold
  FROM product
  WHERE id = ?
  LIMIT 1
  `,
  [productId]
);

const lowStockThreshold =
  thresholdRows[0]?.low_stock_threshold ?? 'Not configured';


  const daysLeft =
    avgDailyConsumption > 0
      ? Math.floor(balance / avgDailyConsumption)
      : 'N/A';

  return {
    balance,
    avgDailyConsumption,
    daysLeft,
    earliestExpiry: expiryRows[0] || null,
    lowStockThreshold
  };
}

module.exports = {
  normalizeProduct,
  normalizeMedicineName,
  normalizeStrength,
  normalizeDosageForm,
  parseMedicineIdentity,
  findStructuredMedicine,
  loadActiveProducts,
  searchProductsByQuery,
  findBestProduct,
  getProductById,
  getAvailableStock,
  getOpeningStock,
  createPendingApproval,
  resetNonReportingAlert,
  lookupAvailableInventory,
  resolveActor,
  receiveStock,
  consumeStock,
  getExpiringBatches,
  acknowledgeExpiryBatch,
  disposeBatch,
  recordAudit,
  listActiveUsersForFacility,
  setUserPin,
  incrementFailedAttempts,
  resetFailedAttempts,
  findBatchByMedicineAndBatch,
  createExpiryReminder,
  getStockInsight,
  lockUser,
  transferOut,
  findFacilityByNumber,
  createLocalTransfer,
  findTransferByCode,
completeTransfer,
getAvailableBatches,
findMedicineFuzzy
};