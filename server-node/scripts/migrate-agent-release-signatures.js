/**
 * Migration: add signature field to agent_releases for signed updates.
 */
require('dotenv').config();
const db = require('../src/utils/db');

async function run() {
  try {
    await db.execute('ALTER TABLE agent_releases ADD COLUMN signature_base64 TEXT NULL');
  } catch (e) {
    // ignore if already exists
    if (e?.code !== 'ER_DUP_FIELDNAME') throw e;
  }
  // eslint-disable-next-line no-console
  console.log('OK: agent_releases.signature_base64');
  process.exit(0);
}

run().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

