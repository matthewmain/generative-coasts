const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let tableReady = false;

async function ensureTable() {
  if (tableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS coast_events (
      id          SERIAL PRIMARY KEY,
      seed        INTEGER,
      tide_level  INTEGER,
      action      TEXT,
      event_time  TIMESTAMPTZ DEFAULT NOW(),
      location    TEXT
    )
  `);
  tableReady = true;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { seed, tide_level, action } = req.body;

    const city    = req.headers['x-vercel-ip-city'];
    const country = req.headers['x-vercel-ip-country'];
    const location = city && country
      ? `${decodeURIComponent(city)}, ${country}`
      : null;

    await ensureTable();

    await pool.query(
      `INSERT INTO coast_events (seed, tide_level, action, location) VALUES ($1, $2, $3, $4)`,
      [seed, tide_level, action, location]
    );

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('log-event error:', err);
    res.status(500).json({ error: 'internal error' });
  }
};
