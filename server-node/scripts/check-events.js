const db = require('../src/utils/db');

async function main() {
  const [proc] = await db.query("SELECT COUNT(*) as c FROM normalized_events WHERE event_type = 'process_create'");
  console.log('process_create in normalized_events:', proc?.c);
  const sample = await db.query("SELECT process_name, hostname FROM normalized_events WHERE event_type = 'process_create' LIMIT 3");
  console.log('Sample:', sample);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
