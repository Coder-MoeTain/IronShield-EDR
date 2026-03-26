/**
 * SIEM push sinks (optional):
 * - Webhook: SIEM_WEBHOOK_URL (+ optional SIEM_WEBHOOK_SECRET header)
 * - File (NDJSON): SIEM_NDJSON_PATH
 *
 * Best-effort: failures do not break core workflows.
 */
const fs = require('fs/promises');

function isEnabled() {
  return !!(process.env.SIEM_WEBHOOK_URL || process.env.SIEM_NDJSON_PATH);
}

async function emit(eventType, payload) {
  if (!isEnabled()) return;
  const msg = {
    type: eventType,
    exported_at: new Date().toISOString(),
    ...payload,
  };
  const line = `${JSON.stringify(msg)}\n`;

  const filePath = process.env.SIEM_NDJSON_PATH;
  if (filePath) {
    try {
      await fs.appendFile(filePath, line, { encoding: 'utf8' });
    } catch {
      /* ignore */
    }
  }

  const url = process.env.SIEM_WEBHOOK_URL;
  if (url) {
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 4000);
      const headers = { 'content-type': 'application/json' };
      if (process.env.SIEM_WEBHOOK_SECRET) headers['x-siem-secret'] = String(process.env.SIEM_WEBHOOK_SECRET);
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(msg), signal: ac.signal });
      clearTimeout(t);
      if (!res.ok) {
        throw new Error(`SIEM webhook HTTP ${res.status}`);
      }
    } catch {
      const failedPath = process.env.SIEM_FAILED_NDJSON_PATH;
      if (failedPath) {
        try {
          await fs.appendFile(failedPath, line, { encoding: 'utf8' });
        } catch {
          /* ignore */
        }
      }
    }
  }
}

module.exports = { emit, isEnabled };

