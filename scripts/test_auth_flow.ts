import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Setup isolated temp config dir BEFORE importing app modules
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hugremote-auth-test-'));
process.env.AUTH_MODE = 'password';
process.env.AUTH_PASSWORD_FILE = path.join(tempDir, 'auth.json');
process.env.SESSION_SECRET = 'test_secret_for_auth_testing_32_bytes_long_123';
process.env.BASE_PATH = '/remote';

const { createApp } = await import('../apps/api/src/app.js');
const { passwordStore } = await import('../apps/api/src/auth/passwordStore.js');

passwordStore.reload();

const app = await createApp();
await app.ready();

console.log('--- TEST 1: Initial unauthenticated state ---');
const meRes1 = await app.inject({
  method: 'GET',
  url: '/remote/api/auth/me',
});
assert.equal(meRes1.statusCode, 200);
const meData1 = meRes1.json();
assert.equal(meData1.mode, 'password');
assert.equal(meData1.authenticated, false);
assert.equal(meData1.mustChangePassword, false);
assert.equal(meData1.isDefaultPassword, true);

// Protected routes must reject unauthenticated requests with 401
const fsRes1 = await app.inject({
  method: 'GET',
  url: '/remote/api/fs',
});
assert.equal(fsRes1.statusCode, 401);
console.log('✓ Initial unauthenticated state correctly enforced');

console.log('--- TEST 2: Wrong password attempt ---');
const badLogin = await app.inject({
  method: 'POST',
  url: '/remote/api/auth/password',
  payload: { password: 'wrongpassword' },
});
assert.equal(badLogin.statusCode, 401);
assert.equal(badLogin.json().error, 'wrong_password');
console.log('✓ Bad password rejected with 401 wrong_password');

console.log('--- TEST 3: Login with default password 123456 ---');
const loginRes = await app.inject({
  method: 'POST',
  url: '/remote/api/auth/password',
  payload: { password: '123456' },
});
assert.equal(loginRes.statusCode, 200);
const loginData = loginRes.json();
assert.equal(loginData.success, true);
assert.equal(loginData.mustChangePassword, true);

const cookieHeader = loginRes.headers['set-cookie'];
assert.ok(cookieHeader, 'Session cookie must be set');
const sessionCookie = String(cookieHeader).split(';')[0];
console.log('✓ Default password 123456 accepted with mustChangePassword: true');

console.log('--- TEST 4: /api/auth/me with session cookie reports mustChangePassword: true ---');
const meRes2 = await app.inject({
  method: 'GET',
  url: '/remote/api/auth/me',
  headers: { cookie: sessionCookie },
});
assert.equal(meRes2.statusCode, 200);
const meData2 = meRes2.json();
assert.equal(meData2.authenticated, true);
assert.equal(meData2.mustChangePassword, true);
assert.equal(meData2.isDefaultPassword, true);

// Protected API must return 403 password_change_required while mustChangePassword is true
const fsRes2 = await app.inject({
  method: 'GET',
  url: '/remote/api/fs',
  headers: { cookie: sessionCookie },
});
assert.equal(fsRes2.statusCode, 403);
assert.equal(fsRes2.json().error, 'password_change_required');
console.log('✓ Workspace access blocked (403 password_change_required) until password is changed');

console.log('--- TEST 5: Password change validation rules ---');
// Short password < 6 chars
const shortRes = await app.inject({
  method: 'POST',
  url: '/remote/api/auth/change-password',
  headers: { cookie: sessionCookie },
  payload: { newPassword: '123' },
});
assert.equal(shortRes.statusCode, 400);
assert.equal(shortRes.json().error, 'password_too_short');

// Reuse of default password 123456
const reuseRes = await app.inject({
  method: 'POST',
  url: '/remote/api/auth/change-password',
  headers: { cookie: sessionCookie },
  payload: { newPassword: '123456' },
});
assert.equal(reuseRes.statusCode, 400);
assert.equal(reuseRes.json().error, 'cannot_use_default_password');
console.log('✓ Validation correctly rejects < 6 chars and reusing 123456');

console.log('--- TEST 6: Successful password change ---');
const changeRes = await app.inject({
  method: 'POST',
  url: '/remote/api/auth/change-password',
  headers: { cookie: sessionCookie },
  payload: { newPassword: 'MySecurePassword2026!' },
});
assert.equal(changeRes.statusCode, 200);
assert.equal(changeRes.json().success, true);

// Now /api/auth/me reports mustChangePassword: false
const meRes3 = await app.inject({
  method: 'GET',
  url: '/remote/api/auth/me',
  headers: { cookie: sessionCookie },
});
assert.equal(meRes3.statusCode, 200);
const meData3 = meRes3.json();
assert.equal(meData3.authenticated, true);
assert.equal(meData3.mustChangePassword, false);
assert.equal(meData3.isDefaultPassword, false);

// Protected API now succeeds!
const fsRes3 = await app.inject({
  method: 'GET',
  url: '/remote/api/fs',
  headers: { cookie: sessionCookie },
});
assert.equal(fsRes3.statusCode, 200);
console.log('✓ Password changed successfully, mustChangePassword cleared, protected APIs unlocked');

console.log('--- TEST 7: Login with new password vs old password ---');
// Old 123456 must now fail
const oldLogin = await app.inject({
  method: 'POST',
  url: '/remote/api/auth/password',
  payload: { password: '123456' },
});
assert.equal(oldLogin.statusCode, 401);

// New password succeeds with mustChangePassword: false
const newLogin = await app.inject({
  method: 'POST',
  url: '/remote/api/auth/password',
  payload: { password: 'MySecurePassword2026!' },
});
assert.equal(newLogin.statusCode, 200);
assert.equal(newLogin.json().mustChangePassword, false);
console.log('✓ New password works for subsequent logins without requiring password change');

// Cleanup
await app.close();
fs.rmSync(tempDir, { recursive: true, force: true });
console.log('\nAll Auth & Mandatory Password Change tests PASSED! ✔');
