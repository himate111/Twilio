const db = require('../config/db');

async function listCategories() {

  return db.query(
    `
    SELECT
      id,
      name,
      description,
      cold_storage_required,
      controlled_drug,
      requires_prescription
    FROM category
    ORDER BY name
    `
  );
}

async function createCategory(input) {

  let parentCategoryId = null;

  if (input.parentName) {

    const parents = await db.query(
      `
      SELECT id
      FROM category
      WHERE name = ?
      LIMIT 1
      `,
      [input.parentName]
    );

    if (parents.length) {
      parentCategoryId = parents[0].id;
    }
  }

  // ADD THIS BLOCK HERE
  const existing = await db.query(
    `
    SELECT id
    FROM category
    WHERE LOWER(name) = LOWER(?)
    `,
    [input.name]
  );

  if (existing.length) {
    throw new Error('Category already exists');
  }

  const categoryId =
    'CAT-' + Date.now();

  await db.query(
  `
  INSERT INTO category (
    id,
    version,
    date_created,
    last_updated,
    name,
    description,
    parent_category_id,
    cold_storage_required,
    controlled_drug,
    requires_prescription
  )
  VALUES (
    ?, 0, NOW(), NOW(),
    ?, ?, ?,
    ?, ?, ?
  )
  `,
  [
    categoryId,
    input.name,
    input.description,
    parentCategoryId,

    input.coldStorageRequired ? 1 : 0,
    input.controlledDrug ? 1 : 0,
    input.requiresPrescription ? 1 : 0
  ]
);

  return categoryId;
}


async function getCategoryById(id) {

  const rows = await db.query(
    `
    SELECT
      id,
      name,
      description
    FROM category
    WHERE id = ?
    `,
    [id]
  );

  return rows[0] || null;
}

async function updateCategory(input) {

  const existing = await db.query(
    `
    SELECT id
    FROM category
    WHERE LOWER(name) = LOWER(?)
      AND id <> ?
    `,
    [
      input.name,
      input.id
    ]
  );

  if (existing.length) {
    throw new Error(
      'Category already exists'
    );
  }

  await db.query(
    `
    UPDATE category
SET
  name = ?,
  description = ?,
  cold_storage_required = ?,
  controlled_drug = ?,
  requires_prescription = ?,
  last_updated = NOW()
WHERE id = ?
    `,
    [
  input.name,
  input.description,

  input.coldStorageRequired ? 1 : 0,
  input.controlledDrug ? 1 : 0,
  input.requiresPrescription ? 1 : 0,

  input.id
]
  );
}

module.exports = {
  listCategories,
  createCategory,
  getCategoryById,
  updateCategory
};