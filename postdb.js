const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE
});

// ADD THIS TEMPORARILY
pool.query('SELECT COUNT(*) FROM "User"')
  .then(res => console.log('User Count:', res.rows[0].count))
  .catch(err => console.error('DB Error:', err.message));

async function query(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

async function transaction(callback) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await callback(client);

    await client.query('COMMIT');

    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  query,
  transaction,
  pool
};