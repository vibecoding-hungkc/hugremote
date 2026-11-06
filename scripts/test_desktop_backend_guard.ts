import assert from 'node:assert/strict';
import { createApp } from '../apps/api/src/app.js';

const secret = 'a'.repeat(64);
process.env.HUGREMOTE_DESKTOP_SECRET = secret;
const app = await createApp();
try {
  const rejected = await app.inject({ method: 'GET', url: '/' });
  assert.equal(rejected.statusCode, 403, 'desktop backend must reject requests without a launch cookie');
  const accepted = await app.inject({ method: 'GET', url: '/', headers: { cookie: `hugremote_desktop_session=${secret}` } });
  assert.equal(accepted.statusCode, 200, 'desktop backend accepts launch cookie');
  const wrongOrigin = await app.inject({ method: 'GET', url: '/api/servers', headers: { cookie: `hugremote_desktop_session=${secret}`, origin: 'http://127.0.0.1:9999', host: '127.0.0.1:8099' } });
  assert.equal(wrongOrigin.statusCode, 403, 'desktop backend must reject foreign origins even with a cookie');
  const sameOrigin = await app.inject({ method: 'GET', url: '/api/servers', headers: { cookie: `hugremote_desktop_session=${secret}`, origin: 'http://127.0.0.1:8099', host: '127.0.0.1:8099' } });
  assert.equal(sameOrigin.statusCode, 200);
  console.log('PASS optional desktop cookie/origin guard');
} finally {
  delete process.env.HUGREMOTE_DESKTOP_SECRET;
  await app.close();
}
