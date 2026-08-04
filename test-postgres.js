const db = require('./postdb');

async function test() {
  const rows = await db.query(
    'SELECT current_database() AS db'
  );

  console.log(rows);
}

test().catch(console.error);