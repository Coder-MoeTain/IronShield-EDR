#!/usr/bin/env node
const http = require('http');

const port = process.env.PORT || 3000;

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
          ...(payload && { 'Content-Length': Buffer.byteLength(payload) }),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => resolve({ status: res.statusCode, raw }));
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  const login = await request('POST', '/api/v1/auth/login', {
    username: 'admin',
    password: 'ChangeMe123!00',
  });
  const lj = JSON.parse(login.raw);
  const token = lj.data?.token || lj.token;
  if (!token) {
    console.log('login failed', login);
    process.exit(1);
  }
  const paths = [
    '/api/v1/auth/me',
    '/api/v1/admin/tenants',
    '/api/v1/console/overview',
    '/api/v1/software/summary',
    '/api/v1/admin/dashboard/summary',
    '/api/v1/admin/soc/readiness',
    '/api/v1/admin/platform/production-readiness',
    '/api/v1/auth/mfa/status',
  ];
  for (const p of paths) {
    const r = await request('GET', p, null, token);
    console.log('\n===', p, r.status, '===');
    console.log(r.raw.slice(0, 2000));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
