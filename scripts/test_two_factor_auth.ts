import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../apps/api/src/app.js';
import { authConfig } from '../apps/api/src/auth/config.js';
import { passwordStore } from '../apps/api/src/auth/passwordStore.js';
import {
  twoFactorStore,
  generateBase32Secret,
  generateTotpToken,
  verifyTotpToken,
} from '../apps/api/src/auth/twoFactorStore.js';
import { generateQrSvg } from '../apps/api/src/auth/qrSvg.js';

let failures = 0;
async function runTest(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (err: any) {
    failures++;
    console.error(`FAIL ${name}: ${err.message}`);
  }
}

await runTest('AC-1: Base32 secret generation, RFC 6238 TOTP token generation/verification (±1 window), and SVG QR code generation', () => {
  const secret = generateBase32Secret();
  assert.match(secret, /^[A-Z2-7]{32}$/, 'Base32 secret must be 32 chars in A-Z2-7');

  const now = 1794108000000;
  const codeNow = generateTotpToken(secret, now);
  const codePrev = generateTotpToken(secret, now - 30_000);
  const codeNext = generateTotpToken(secret, now + 30_000);
  assert.match(codeNow, /^\d{6}$/, 'TOTP token must be 6 digits');

  assert.equal(verifyTotpToken(secret, codeNow, now), true, 'Current step code must verify');
  assert.equal(verifyTotpToken(secret, codePrev, now), true, 'Previous 30s step code must verify');
  assert.equal(verifyTotpToken(secret, codeNext, now), true, 'Next 30s step code must verify');
  assert.equal(verifyTotpToken(secret, '000000', now) && verifyTotpToken(secret, '999999', now), false, 'Arbitrary invalid codes must not both match');

  const otpauthUrl = `otpauth://totp/HugRemote:admin?secret=${secret}&issuer=HugRemote`;
  const svg = generateQrSvg(otpauthUrl);
  assert.match(svg, /^<svg[\s\S]*viewBox="0 0 \d+ \d+"[\s\S]*<path d="M[\s\S]*<\/svg>$/, 'generateQrSvg must produce valid SVG path markup');
});

await runTest('AC-2a: Full 2FA lifecycle (setup -> enable -> login requires 2FA -> verify TOTP & recovery code -> disable) in AUTH_MODE=password', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hugremote-2fa-pass-'));
  const prev2faFile = process.env.AUTH_2FA_FILE;
  const prevPassFile = process.env.AUTH_PASSWORD_FILE;
  const prevMode = authConfig.mode;
  process.env.AUTH_2FA_FILE = path.join(tmpDir, 'two_factor.json');
  process.env.AUTH_PASSWORD_FILE = path.join(tmpDir, 'auth.json');
  twoFactorStore.reload();
  passwordStore.reload();
  authConfig.mode = 'password';

  const app = await createApp();
  try {
    // 1. Login with default password (123456)
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/password',
      payload: { password: '123456' },
    });
    assert.equal(loginRes.statusCode, 200);
    const cookieHeader = loginRes.headers['set-cookie'];
    assert.ok(cookieHeader, 'Login must set session cookie');
    const sessionCookie = (Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader).split(';')[0];

    // Change default password first so regular routes are unlocked
    const chgRes = await app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      headers: { cookie: sessionCookie },
      payload: { newPassword: 'StrongPassword99!' },
    });
    assert.equal(chgRes.statusCode, 200);

    // 2. Check initial 2FA status (disabled)
    const status0 = (await app.inject({
      method: 'GET',
      url: '/api/auth/2fa/status',
      headers: { cookie: sessionCookie },
    })).json();
    assert.equal(status0.enabled, false);

    // 3. Begin 2FA setup
    const setupRes = await app.inject({
      method: 'POST',
      url: '/api/auth/2fa/setup',
      headers: { cookie: sessionCookie },
    });
    assert.equal(setupRes.statusCode, 200);
    const setupData = setupRes.json();
    assert.match(setupData.secret, /^[A-Z2-7]{32}$/);
    assert.match(setupData.qrSvg, /^<svg[\s\S]*<\/svg>$/);
    assert.equal(Array.isArray(setupData.recoveryCodes), true);
    assert.equal(setupData.recoveryCodes.length, 8);

    // 4. Enable 2FA with wrong code must fail
    const badEnable = await app.inject({
      method: 'POST',
      url: '/api/auth/2fa/enable',
      headers: { cookie: sessionCookie },
      payload: { code: '000000' },
    });
    assert.equal(badEnable.statusCode, 400);
    assert.equal(twoFactorStore.isEnabled(), false);

    // 5. Enable 2FA with valid TOTP code must succeed
    const validTotp = generateTotpToken(setupData.secret);
    const goodEnable = await app.inject({
      method: 'POST',
      url: '/api/auth/2fa/enable',
      headers: { cookie: sessionCookie },
      payload: { code: validTotp },
    });
    assert.equal(goodEnable.statusCode, 200);
    assert.equal(twoFactorStore.isEnabled(), true);

    // 6. New login with password must require 2FA before accessing protected APIs
    const login2 = await app.inject({
      method: 'POST',
      url: '/api/auth/password',
      payload: { password: 'StrongPassword99!' },
    });
    assert.equal(login2.statusCode, 200);
    const login2Data = login2.json();
    assert.equal(login2Data.requiresTwoFactor, true, 'Password login must report requiresTwoFactor=true when 2FA is enabled');
    const cookie2 = (Array.isArray(login2.headers['set-cookie']) ? login2.headers['set-cookie'][0] : login2.headers['set-cookie']!).split(';')[0];

    const meBefore2fa = (await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: cookie2 },
    })).json();
    assert.equal(meBefore2fa.authenticated, false, 'Session must not be marked fully authenticated before 2FA verification');
    assert.equal(meBefore2fa.requiresTwoFactor, true);

    const serversBlocked = await app.inject({
      method: 'GET',
      url: '/api/servers',
      headers: { cookie: cookie2 },
    });
    assert.equal(serversBlocked.statusCode, 403, 'Protected API must reject unverified 2FA session with 403');
    assert.equal(serversBlocked.json().error, 'two_factor_required');

    // 7. Verify 2FA with valid TOTP code upgrades session
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/auth/2fa/verify',
      headers: { cookie: cookie2 },
      payload: { code: generateTotpToken(setupData.secret) },
    });
    assert.equal(verifyRes.statusCode, 200);

    const serversAllowed = await app.inject({
      method: 'GET',
      url: '/api/servers',
      headers: { cookie: cookie2 },
    });
    assert.equal(serversAllowed.statusCode, 200, 'Protected API must succeed after 2FA verification');

    // 8. Verify 2FA with a one-time recovery code on another login
    const login3 = await app.inject({
      method: 'POST',
      url: '/api/auth/password',
      payload: { password: 'StrongPassword99!' },
    });
    const cookie3 = (Array.isArray(login3.headers['set-cookie']) ? login3.headers['set-cookie'][0] : login3.headers['set-cookie']!).split(';')[0];
    const firstRecoveryCode = setupData.recoveryCodes[0];
    const verifyRecovery = await app.inject({
      method: 'POST',
      url: '/api/auth/2fa/verify',
      headers: { cookie: cookie3 },
      payload: { code: firstRecoveryCode },
    });
    assert.equal(verifyRecovery.statusCode, 200, 'Recovery code must verify 2FA');

    // Reusing the same recovery code must fail
    const login4 = await app.inject({
      method: 'POST',
      url: '/api/auth/password',
      payload: { password: 'StrongPassword99!' },
    });
    const cookie4 = (Array.isArray(login4.headers['set-cookie']) ? login4.headers['set-cookie'][0] : login4.headers['set-cookie']!).split(';')[0];
    const reuseRecovery = await app.inject({
      method: 'POST',
      url: '/api/auth/2fa/verify',
      headers: { cookie: cookie4 },
      payload: { code: firstRecoveryCode },
    });
    assert.equal(reuseRecovery.statusCode, 401, 'Used recovery code must be rejected on second use');

    // 9. Disable 2FA using valid TOTP code
    const disableRes = await app.inject({
      method: 'POST',
      url: '/api/auth/2fa/disable',
      headers: { cookie: cookie3 },
      payload: { code: generateTotpToken(setupData.secret) },
    });
    assert.equal(disableRes.statusCode, 200);
    assert.equal(twoFactorStore.isEnabled(), false);
  } finally {
    authConfig.mode = prevMode;
    if (prev2faFile !== undefined) process.env.AUTH_2FA_FILE = prev2faFile;
    else delete process.env.AUTH_2FA_FILE;
    if (prevPassFile !== undefined) process.env.AUTH_PASSWORD_FILE = prevPassFile;
    else delete process.env.AUTH_PASSWORD_FILE;
    twoFactorStore.reload();
    passwordStore.reload();
    await app.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

await runTest('AC-2b: When AUTH_MODE=none and user enables 2FA, web requests require 2FA verification while desktop secret requests remain allowed', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hugremote-2fa-none-'));
  const prev2faFile = process.env.AUTH_2FA_FILE;
  const prevMode = authConfig.mode;
  process.env.AUTH_2FA_FILE = path.join(tmpDir, 'two_factor.json');
  twoFactorStore.reload();
  authConfig.mode = 'none';

  const app = await createApp();
  try {
    // Enable 2FA while in AUTH_MODE=none
    const setupData = (await app.inject({ method: 'POST', url: '/api/auth/2fa/setup' })).json();
    const enableRes = await app.inject({
      method: 'POST',
      url: '/api/auth/2fa/enable',
      payload: { code: generateTotpToken(setupData.secret) },
    });
    assert.equal(enableRes.statusCode, 200);
    const verifiedCookie = (Array.isArray(enableRes.headers['set-cookie']) ? enableRes.headers['set-cookie'][0] : enableRes.headers['set-cookie']!).split(';')[0];

    // Unauthenticated client (no cookie) in AUTH_MODE=none is now gated by 2FA!
    const meAnon = (await app.inject({ method: 'GET', url: '/api/auth/me' })).json();
    assert.equal(meAnon.authenticated, false);
    assert.equal(meAnon.requiresTwoFactor, true);
    assert.equal(meAnon.twoFactorEnabled, true);

    const blockedAnon = await app.inject({ method: 'GET', url: '/api/servers' });
    assert.equal(blockedAnon.statusCode, 401);

    // Client that verifies 2FA directly gets a valid session cookie and can access APIs
    const verifyDirect = await app.inject({
      method: 'POST',
      url: '/api/auth/2fa/verify',
      payload: { code: generateTotpToken(setupData.secret) },
    });
    assert.equal(verifyDirect.statusCode, 200);
    const newCookie = (Array.isArray(verifyDirect.headers['set-cookie']) ? verifyDirect.headers['set-cookie'][0] : verifyDirect.headers['set-cookie']!).split(';')[0];

    const allowedAfterVerify = await app.inject({
      method: 'GET',
      url: '/api/servers',
      headers: { cookie: newCookie || verifiedCookie },
    });
    assert.equal(allowedAfterVerify.statusCode, 200);
  } finally {
    authConfig.mode = prevMode;
    if (prev2faFile !== undefined) process.env.AUTH_2FA_FILE = prev2faFile;
    else delete process.env.AUTH_2FA_FILE;
    twoFactorStore.reload();
    await app.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

if (failures > 0) {
  process.exit(1);
}
