/**
 * Integration provider interface (Phase 8).
 */
const https = require('https');
const http = require('http');
const { URL } = require('url');

async function sendWebhook(config, payload) {
  const url = new URL(config.url);
  const body = JSON.stringify(payload);
  const lib = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          ...(config.secret ? { 'X-IronShield-Secret': config.secret } : {}),
        },
      },
      (res) => {
        res.on('data', () => {});
        res.on('end', () => resolve({ statusCode: res.statusCode }));
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function sendSplunkHec(config, payload) {
  const url = new URL(`${config.hec_url.replace(/\/$/, '')}/services/collector/event`);
  const body = JSON.stringify({
    event: payload,
    sourcetype: config.sourcetype || 'ironshield:alert',
    index: config.index,
  });
  const lib = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: {
          Authorization: `Splunk ${config.token}`,
          'Content-Type': 'application/json',
        },
      },
      (res) => {
        res.on('data', () => {});
        res.on('end', () => resolve({ statusCode: res.statusCode }));
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function dispatch(type, config, payload) {
  switch (type) {
    case 'webhook':
      return sendWebhook(config, payload);
    case 'splunk_hec':
      return sendSplunkHec(config, payload);
    case 'elastic':
    case 'sentinel':
      return sendWebhook({ ...config, url: config.url }, { ...payload, _format: type });
    default:
      throw new Error(`Unsupported integration type: ${type}`);
  }
}

module.exports = { dispatch, sendWebhook, sendSplunkHec };
