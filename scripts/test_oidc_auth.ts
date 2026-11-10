import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';

// 1. Setup isolated test environment
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hugremote-oidc-test-'));
const oidcConfigFile = path.join(tempDir, 'oidc.json');
const authPasswordFile = path.join(tempDir, 'auth.json');

process.env.DATA_DIR = tempDir;
process.env.AUTH_OIDC_FILE = oidcConfigFile;
process.env.AUTH_PASSWORD_FILE = authPasswordFile;
process.env.AUTH_MODE = 'both';
process.env.SESSION_SECRET = 'test_secret_for_oidc_testing_32_bytes_123';
process.env.BASE_PATH = '';
process.env.APP_URL = 'http://localhost:8099';

// 2. Spin up a lightweight mock OIDC IdP server
let mockTokenIssued = false;
let mockUserinfoQueried = false;
const mockIdpServer = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');

  if (url.pathname === '/.well-known/openid-configuration') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      issuer: `http://127.0.0.1:${(mockIdpServer.address() as any).port}`,
      authorization_endpoint: `http://127.0.0.1:${(mockIdpServer.address() as any).port}/oauth/authorize`,
      token_endpoint: `http://127.0.0.1:${(mockIdpServer.address() as any).port}/oauth/token`,
      userinfo_endpoint: `http://127.0.0.1:${(mockIdpServer.address() as any).port}/oauth/userinfo`,
    }));
    return;
  }

  if (url.pathname === '/oauth/token' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      mockTokenIssued = true;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        access_token: 'mock_access_token_123',
        token_type: 'Bearer',
        expires_in: 3600,
        id_token: 'header.' + Buffer.from(JSON.stringify({
          sub: 'user-001',
          email: 'admin@company.com',
          name: 'Admin Developer',
        })).toString('base64url') + '.signature',
      }));
    });
    return;
  }

  if (url.pathname === '/oauth/userinfo') {
    mockUserinfoQueried = true;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      sub: 'user-001',
      email: 'admin@company.com',
      name: 'Admin Developer',
      picture: 'https://example.com/avatar.png',
    }));
    return;
  }

  res.writeHead(404);
  res.end();
});

await new Promise<void>((resolve) => {
  mockIdpServer.listen(0, '127.0.0.1', () => resolve());
});
const mockPort = (mockIdpServer.address() as any).port;
const mockIssuerUrl = `http://127.0.0.1:${mockPort}`;

process.env.OIDC_ISSUER_URL = mockIssuerUrl;
process.env.OIDC_CLIENT_ID = 'test-client-id';
process.env.OIDC_CLIENT_SECRET = 'test-client-secret';
process.env.OIDC_ALLOWED_EMAILS = 'admin@company.com,dev@company.com';

const { createApp } = await import('../apps/api/src/app.js');
const { oidcStore } = await import('../apps/api/src/auth/oidcStore.js');
const { authConfig } = await import('../apps/api/src/auth/config.js');

oidcStore.reload();

const app = await createApp();
await app.ready();

console.log('--- TEST 1: Initial AUTH_MODE=both state ---');
const meRes1 = await app.inject({
  method: 'GET',
  url: '/api/auth/me',
});
assert.equal(meRes1.statusCode, 200);
const meData1 = meRes1.json();
assert.equal(meData1.mode, 'both');
assert.equal(meData1.authenticated, false);
assert.equal(meData1.oidcConfigured, true);
assert.equal(meData1.oidcCallbackUrl, 'http://localhost:8099/auth/oidc/callback');
console.log('✓ /api/auth/me accurately reports AUTH_MODE=both, oidcConfigured and callback URL');

console.log('--- TEST 2: Password login works in AUTH_MODE=both ---');
const passLoginRes = await app.inject({
  method: 'POST',
  url: '/api/auth/password',
  payload: { password: '123456' },
});
assert.equal(passLoginRes.statusCode, 200);
assert.equal(passLoginRes.json().success, true);
console.log('✓ Password login operates normally in AUTH_MODE=both');

console.log('--- TEST 3: OIDC Discovery API ---');
const discoverRes = await app.inject({
  method: 'POST',
  url: '/api/auth/oidc/discover',
  payload: { issuerUrl: mockIssuerUrl },
});
assert.equal(discoverRes.statusCode, 200);
const discData = discoverRes.json();
assert.equal(discData.valid, true);
assert.equal(discData.authorizationEndpoint, `${mockIssuerUrl}/oauth/authorize`);
assert.equal(discData.tokenEndpoint, `${mockIssuerUrl}/oauth/token`);
assert.equal(discData.userinfoEndpoint, `${mockIssuerUrl}/oauth/userinfo`);
console.log('✓ /api/auth/oidc/discover successfully queries and parses IdP configuration');

console.log('--- TEST 4: Get & Save OIDC Config from Settings ---');
const cfgRes = await app.inject({
  method: 'GET',
  url: '/api/auth/oidc/config',
});
assert.equal(cfgRes.statusCode, 200);
const curCfg = cfgRes.json();
assert.equal(curCfg.mode, 'both');
assert.equal(curCfg.callbackUrl, 'http://localhost:8099/auth/oidc/callback');

const saveRes = await app.inject({
  method: 'POST',
  url: '/api/auth/oidc/config',
  payload: {
    mode: 'both',
    issuerUrl: mockIssuerUrl,
    clientId: 'updated-client-id',
    clientSecret: 'updated-client-secret',
    allowedEmails: 'admin@company.com, ceo@company.com',
    buttonLabel: 'Đăng nhập với Corp SSO',
  },
});
assert.equal(saveRes.statusCode, 200);
const savedData = saveRes.json();
assert.equal(savedData.success, true);
assert.equal(savedData.config.clientId, 'updated-client-id');
assert.equal(savedData.config.buttonLabel, 'Đăng nhập với Corp SSO');
assert.equal(savedData.config.callbackUrl, 'http://localhost:8099/auth/oidc/callback');
console.log('✓ /api/auth/oidc/config saves configuration and updates runtime config');

console.log('--- TEST 5: OIDC Redirect initiates PKCE & State cookies ---');
const redirectRes = await app.inject({
  method: 'GET',
  url: '/auth/oidc',
});
assert.equal(redirectRes.statusCode, 302);
const redirectLocation = redirectRes.headers.location as string;
assert.ok(redirectLocation.startsWith(`${mockIssuerUrl}/oauth/authorize`));

const setCookies = redirectRes.headers['set-cookie'] as string[];
assert.ok(Array.isArray(setCookies) && setCookies.length >= 2, 'State and PKCE cookies must be set');

const stateCookie = setCookies.find(c => c.startsWith('hugremote_oauth_state='));
const pkceCookie = setCookies.find(c => c.startsWith('hugremote_oidc_pkce='));
assert.ok(stateCookie, 'State cookie must exist');
assert.ok(pkceCookie, 'PKCE cookie must exist');

const parsedUrl = new URL(redirectLocation);
const reqState = parsedUrl.searchParams.get('state');
const reqCodeChallenge = parsedUrl.searchParams.get('code_challenge');
assert.ok(reqState, 'State param must be present in authorization redirect');
assert.ok(reqCodeChallenge, 'code_challenge must be present');
assert.equal(parsedUrl.searchParams.get('redirect_uri'), 'http://localhost:8099/auth/oidc/callback');
console.log('✓ /auth/oidc correctly constructs authorization redirect with PKCE & state');

console.log('--- TEST 6: OIDC Callback completes token exchange & establishes session ---');
const cookieHeaderForCallback = `${stateCookie!.split(';')[0]}; ${pkceCookie!.split(';')[0]}`;

const callbackRes = await app.inject({
  method: 'GET',
  url: `/auth/oidc/callback?code=mock_auth_code_999&state=${reqState}`,
  headers: {
    cookie: cookieHeaderForCallback,
  },
});
assert.equal(callbackRes.statusCode, 302);
assert.equal(callbackRes.headers.location, '/');
assert.equal(mockTokenIssued, true, 'Token endpoint must have been called');
assert.equal(mockUserinfoQueried, true, 'Userinfo endpoint must have been queried');

const callbackCookies = callbackRes.headers['set-cookie'] as string[];
const sessionCookie = callbackCookies.find(c => c.startsWith('hugremote_session='));
assert.ok(sessionCookie, 'Session cookie must be established upon successful OIDC login');

// Verify session is active and user info is populated
const meResAfterOidc = await app.inject({
  method: 'GET',
  url: '/api/auth/me',
  headers: {
    cookie: sessionCookie!.split(';')[0],
  },
});
assert.equal(meResAfterOidc.statusCode, 200);
const authedUser = meResAfterOidc.json();
assert.equal(authedUser.authenticated, true);
assert.equal(authedUser.user.provider, 'oidc');
assert.equal(authedUser.user.email, 'admin@company.com');
assert.equal(authedUser.user.name, 'Admin Developer');
console.log('✓ OIDC callback exchanges token, fetches userinfo, and sets valid session cookie');

console.log('--- TEST 7: OIDC Mode rejects password login ---');
oidcStore.saveConfig({ mode: 'oidc' });
const passInOidcOnly = await app.inject({
  method: 'POST',
  url: '/api/auth/password',
  payload: { password: '123456' },
});
assert.equal(passInOidcOnly.statusCode, 400);
assert.equal(passInOidcOnly.json().error, 'password_auth_disabled');
console.log('✓ In AUTH_MODE=oidc, password login is properly rejected');

// Clean up mock server and temp files
await new Promise<void>((resolve) => mockIdpServer.close(() => resolve()));
fs.rmSync(tempDir, { recursive: true, force: true });

console.log('\n=== ALL OIDC AUTH & SETTINGS TESTS PASSED SUCCESSFULLY ===');
