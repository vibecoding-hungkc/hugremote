import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const API = path.resolve(import.meta.dirname, '..');
const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'hr-desktop-')));
const work = path.join(tmp, 'work');
fs.mkdirSync(work, { recursive: true });

const PW = 'matkhau-khoi-tao-ban-dau';
const DESKTOP_SECRET = 'super-secret-token-for-desktop-test-12345';
let port;
let srv;
let B;

const env = () => ({
  ...process.env,
  APP_ENV: 'production',
  PORT: String(port),
  HOST: '127.0.0.1',
  APP_URL: `http://127.0.0.1:${port}`,
  DATA_DIR: path.join(tmp, 'data'),
  AUTH_PASSWORD: PW,
  ALLOWED_ROOT: work,
  WORKSPACE_ROOT: work,
  SSH_CONFIG_PATH: path.join(tmp, 'ssh_config'),
  HUGREMOTE_DESKTOP_SECRET: DESKTOP_SECRET,
});

before(async () => {
  port = await new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
  B = `http://127.0.0.1:${port}/api`;
  srv = spawn('node', ['dist/main.js'], { cwd: API, env: env(), stdio: ['ignore', 'pipe', 'pipe'] });
  srv.stderr.on('data', (d) => process.stderr.write(d));
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`${B}/health`);
      if (r.ok) return;
    } catch {}
    await new Promise((res) => setTimeout(res, 200));
  }
  throw new Error('Server không lên kịp');
});

after(() => {
  srv?.kill('SIGKILL');
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {}
});

test('desktop loopback: POST /api/auth/desktop-session cấp session owner khi có secret hợp lệ', async () => {
  const r = await fetch(`${B}/auth/desktop-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: DESKTOP_SECRET }),
  });
  assert.equal(r.status, 200);
  const data = await r.json();
  assert.ok(data.accessToken, 'Phải có accessToken');
  assert.equal(data.needs2fa, false);

  // Dùng accessToken gọi /api/hosts
  const rHosts = await fetch(`${B}/hosts`, {
    headers: { Authorization: `Bearer ${data.accessToken}` },
  });
  assert.equal(rHosts.status, 200);
});

test('desktop loopback: header x-hugremote-desktop-secret tự động authenticate các route API', async () => {
  const r = await fetch(`${B}/hosts`, {
    headers: { 'x-hugremote-desktop-secret': DESKTOP_SECRET },
  });
  assert.equal(r.status, 200);
  const data = await r.json();
  assert.ok(Array.isArray(data.hosts));
});

test('desktop loopback: cookie hugremote_desktop_token trong /auth/refresh cấp session tự động', async () => {
  const r = await fetch(`${B}/auth/refresh`, {
    method: 'POST',
    headers: {
      Cookie: `hugremote_desktop_token=${DESKTOP_SECRET}`,
    },
  });
  assert.equal(r.status, 200);
  const data = await r.json();
  assert.ok(data.accessToken);
});

test('desktop loopback: secret sai hoặc thiếu bị từ chối 401', async () => {
  const r1 = await fetch(`${B}/auth/desktop-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: 'sai-mat-roi' }),
  });
  assert.equal(r1.status, 401);

  const r2 = await fetch(`${B}/hosts`, {
    headers: { 'x-hugremote-desktop-secret': 'sai-mat-roi' },
  });
  assert.equal(r2.status, 401);
});
