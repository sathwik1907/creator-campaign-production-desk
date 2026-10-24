import test from 'node:test';
import assert from 'node:assert/strict';
process.env.NODE_ENV = 'test';
const { default: app } = await import('../server.js');
import { csrfProtection, getOrCreateCsrfToken } from '../middlewares/csrf.middleware.js';

// These smoke tests do not need MongoDB or Ollama; they validate HTTP wiring,
// session bootstrapping and permission boundaries under offline conditions.

test('Offline HTTP and security smoke checks', async (t) => {
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1');
    listening.once('listening', () => resolve(listening));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await t.test('health check accurately reports disconnected database', async () => {
      const r = await fetch(`${base}/api/health`);
      const json = await r.json();
      assert.equal(r.status, 503);
      assert.equal(json.status, 'DEGRADED');
      assert.equal(json.database.status, 'DISCONNECTED');
    });
    await t.test('CSRF bootstrap issues a per-session token', async () => {
      const r = await fetch(`${base}/api/auth/csrf-token`);
      const json = await r.json();
      assert.equal(r.status, 200);
      assert.equal(json.success, true);
      assert.match(json.csrfToken, /^[a-f0-9]{64}$/);
      assert.match(r.headers.get('set-cookie') || '', /creator_desk_sid=/);
    });
    await t.test('unauthenticated session details are not exposed', async () => {
      const r = await fetch(`${base}/api/auth/me`);
      assert.equal(r.status, 401);
    });
    await t.test('unauthenticated campaign list is denied', async () => {
      const r = await fetch(`${base}/api/campaigns`);
      assert.equal(r.status, 401);
    });
    await t.test('nonexistent auth path cannot bypass CSRF by prefix match', () => {
      let status, forwarded = false;
      const req = {
        method: 'POST', path: '/api/auth/login/evil',
        session: { userId: 'user', csrfToken: 'expected' },
        headers: {}, body: {},
      };
      const res = { status(code) { status = code; return this; }, json() {} };
      csrfProtection(req, res, () => { forwarded = true; });
      assert.equal(status, 403);
      assert.equal(forwarded, false);
    });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
