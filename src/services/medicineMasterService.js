const db = require('../config/db');

async function listMedicines() {

  return db.query(`
    SELECT
      p.id,
      p.name,
      p.generic_name,
      p.dosage_form,
      p.strength,
      c.name AS category_name,
      p.product_code
    FROM product p
    LEFT JOIN category c
      ON c.id = p.category_id
    ORDER BY p.name
  `);
}

async function searchMedicines(text) {

  return db.query(
    `
    SELECT
      id,
      name,
      generic_name,
      dosage_form,
      strength,
      product_code
    FROM product
    WHERE
      LOWER(name) LIKE LOWER(?)
      OR LOWER(generic_name) LIKE LOWER(?)
    ORDER BY name
    `,
    [
      `%${text}%`,
      `%${text}%`
    ]
  );
}

async function listCategories() {

  return db.query(`
    SELECT
      id,
      name
    FROM category
    ORDER BY name
  `);
}

async function createMedicine(input) {

  const existing = await db.query(
    `
    SELECT id
    FROM product
    WHERE LOWER(name) = LOWER(?)
    `,
    [input.medicineName]
  );

  if (existing.length) {
    throw new Error(
      'Medicine already exists'
    );
  }

  const productId =
    'MED-' + Date.now();

  const productCode =
    'MED-' + Date.now();

  await db.query(
  `
  INSERT INTO product (
    id,
    version,
    date_created,
    last_updated,
    name,
    generic_name,
    dosage_form,
    strength,
    lead_days,
    minimum_order_level,
    product_code,
    product_type_id,
    active,
    category_id,
    low_stock_threshold
  )
  VALUES (
    ?,0,NOW(),NOW(),
    ?, ?, ?, ?, ?, ?,
    ?,
    'DEFAULT',
    b'1',
    ?,
    ?
  )
  `,
  [
    productId,

    input.medicineName,
    input.genericName,
    input.dosageForm,
    input.strength,
    input.leadDays,
    input.minimumOrderLevel,

    productCode,

    input.categoryId,

    input.stockThreshold
  ]
);

  return productId;
}

async function updateMedicine(input) {

  await db.query(
    `
    UPDATE product
    SET
      name = ?,
      generic_name = ?,
      dosage_form = ?,
      strength = ?,
      low_stock_threshold = ?,
      lead_days = ?,
      minimum_order_level = ?,
      category_id = ?,
      last_updated = NOW()
    WHERE id = ?
    `,
    [
      input.medicineName,
      input.genericName,
      input.dosageForm,
      input.strength,
      input.stockThreshold,
      input.leadDays,
      input.minimumOrderLevel,
      input.categoryId,
      input.id
    ]
  );
}

module.exports = {
  listMedicines,
  searchMedicines,
  listCategories,
  createMedicine,
  updateMedicine
};