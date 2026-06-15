require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS shares (
        code VARCHAR(50) PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS share_events (
        id SERIAL PRIMARY KEY,
        share_code VARCHAR(50) REFERENCES shares(code),
        type VARCHAR(20) NOT NULL,
        item_id VARCHAR(255) NOT NULL,
        status VARCHAR(50),
        metadata JSONB,
        nickname VARCHAR(255),
        updated_at BIGINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Create an index for faster querying by share_code
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_share_events_share_code ON share_events(share_code);
    `);

    // Safely add nickname column if it doesn't exist (for migration)
    await client.query(`
      ALTER TABLE share_events ADD COLUMN IF NOT EXISTS nickname VARCHAR(255);
    `);
    
    console.log('Database initialized.');
  } finally {
    client.release();
  }
}

async function createShareCode(code) {
  await pool.query('INSERT INTO shares(code) VALUES($1) ON CONFLICT DO NOTHING', [code]);
  return code;
}

async function getShareEvents(shareCode) {
  const result = await pool.query(
    'SELECT type, item_id, status, metadata, nickname, updated_at FROM share_events WHERE share_code = $1 ORDER BY updated_at ASC',
    [shareCode]
  );
  return result.rows;
}

async function addShareEvent(shareCode, event, nickname) {
  const { type, id: itemId, status, metadata, updated_at } = event;
  await pool.query(
    'INSERT INTO share_events(share_code, type, item_id, status, metadata, nickname, updated_at) VALUES($1, $2, $3, $4, $5, $6, $7)',
    [shareCode, type, itemId, status, metadata ? JSON.stringify(metadata) : null, nickname, updated_at]
  );
}

module.exports = {
  pool,
  initDb,
  createShareCode,
  getShareEvents,
  addShareEvent
};
