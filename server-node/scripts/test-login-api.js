#!/usr/bin/env node
/** Quick login smoke test against local API */
const http = require('http');

const port = process.env.PORT || 3000;
const body = JSON.stringify({ username: 'admin', password: 'ChangeMe123!00' });

const req = http.request(
  {
    hostname: '127.0.0.1',
    port,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  },
  (res) => {
    let raw = '';
    res.on('data', (c) => (raw += c));
    res.on('end', () => {
      console.log('status:', res.statusCode);
      try {
        const j = JSON.parse(raw);
        console.log(JSON.stringify(j, null, 2));
        if (j.success && j.data?.token) console.log('\nOK — token received');
        else if (j.token) console.log('\nOK — legacy token');
        else console.log('\nFAIL — no token in response');
      } catch {
        console.log(raw);
      }
    });
  }
);
req.on('error', (e) => console.error('Cannot reach API on port', port, '-', e.message));
req.write(body);
req.end();
