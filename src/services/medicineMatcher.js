const Fuse = require("fuse.js");
const db = require("../../postdb");

async function matchMedicines(extractedMedicines) {

  const result = await db.query(`
    SELECT
      id,
      "medicineName",
      "genericName",
      strength
    FROM "Medicine"
    WHERE "isActive" = true
  `);

  const medicines = result.rows;

  const fuse = new Fuse(
    medicines,
    {
      keys: [
        "medicineName",
        "genericName"
      ],
      threshold: 0.35,
      includeScore: true
    }
  );

  const matches = [];

  for (const med of extractedMedicines) {

    const found = fuse.search(med);

    if (found.length > 0) {

      matches.push({
        original: med,
        match: found[0].item,
        confidence:
          (1 - found[0].score) * 100
      });

    }

  }

  return matches;
}

module.exports = {
  matchMedicines
};