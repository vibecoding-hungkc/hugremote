import assert from 'node:assert/strict';

process.env.AUTH_MODE = 'none';
process.env.BASE_PATH = '/remote';

const { createApp } = await import('../apps/api/src/app.js');
const app = await createApp();

try {
  await app.ready();

  for (const url of ['/', '/remote/', '/login', '/remote/login']) {
    const response = await app.inject({ method: 'GET', url });
    assert.equal(response.statusCode, 200, `${url} must remain a valid SPA shell`);
    assert.match(response.headers['content-type'] || '', /^text\/html/);
    const csp = String(response.headers['content-security-policy'] || '');
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /script-src 'self'/);
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /frame-ancestors 'self'/);
    assert.doesNotMatch(csp, /unsafe-eval|script-src[^;]*unsafe-inline/);
    assert.doesNotMatch(response.body, /<script>\s*window\.__BASE_PATH__/);
    assert.match(response.body, /<meta name="hugremote-base-path" content="\/remote">/);
  }

  const blocked = [
    '/@vite/client',
    '/__webpack_hmr',
    '/_next/webpack-hmr',
    '/@fs/etc/passwd',
    '/.env',
    '/%2eenv',
    '/.env.production',
    '/.git/config',
    '/package.json',
    '/package-lock.json',
    '/src/main.ts',
    '/vite.config.ts',
    '/tsconfig.json',
    '/node_modules/fastify/package.json',
  ];

  for (const path of blocked) {
    for (const prefix of ['', '/remote']) {
      const url = `${prefix}${path}`;
      const response = await app.inject({ method: 'GET', url });
      assert.equal(response.statusCode, 404, `${url} must fail closed`);
      assert.match(response.headers['content-type'] || '', /^application\/json/);
      assert.equal(response.json().error, 'Endpoint or asset not found');
      assert.doesNotMatch(response.body, /<!DOCTYPE html>|window\.__BASE_PATH__/i);
    }
  }

  for (const url of ['/unknown-server-path', '/remote/unknown-server-path']) {
    const response = await app.inject({ method: 'GET', url });
    assert.equal(response.statusCode, 404, `${url} must not receive the SPA shell`);
  }

  console.log('PASS HTTP security headers and static fallback fail closed');
} finally {
  await app.close();
}
