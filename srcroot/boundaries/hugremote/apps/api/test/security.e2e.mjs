// AC-34 — bộ pentest tự động: các ca của v1 (truy cập chưa xác thực, rate limit, cookie, CSWSH, CORS, path traversal,
// prototype pollution, body quá lớn, fuzz WS) + 4 ca mới (cấu hình OIDC khi chưa đăng nhập, SSRF qua discover,
// rò mật khẩu ở API danh sách máy, host key đổi). Dựng một instance production với dữ liệu tạm trên cổng ngẫu nhiên.
// Chạy: pnpm --filter @app/api test:security   (cần `nest build` trước; ca host key cần máy thử demo-sshd :2222)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const Database = require('better-sqlite3');
const API = path.resolve(import.meta.dirname, '..');
const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'hr-sec-')));
const work = path.join(tmp, 'work');
fs.mkdirSync(path.join(work, 'proj'), { recursive: true });
fs.writeFileSync(path.join(work, 'proj', 'a.txt'), 'ok');
fs.writeFileSync(path.join(tmp, 'secret-outside.txt'), 'BÍ MẬT');
fs.symlinkSync(tmp, path.join(work, 'proj', 'escape'));
fs.writeFileSync(
  path.join(tmp, 'ssh_config'),
  'Host demo-sshd\n  HostName 127.0.0.1\n  Port 2222\n  User dev\n\nHost pw-host\n  HostName 127.0.0.1\n  Port 2222\n  User dev\n',
);
const PW = 'matkhau-thu-bao-mat';
let port;
let srv;
let B;
let token;
let projectId;
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
  AUTH_MAX_ATTEMPTS: '5',
});
async function startServer() {
  srv = spawn('node', ['dist/main.js'], { cwd: API, env: env(), stdio: 'ignore' });
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(`${B}/health`)).ok) return;
    } catch {
      /* chờ */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('api thử không lên');
}
async function restartServer() {
  const old = srv;
  await new Promise((r) => {
    old.once('exit', r);
    old.kill();
  });
  await startServer();
}

const freePort = () =>
  new Promise((r) => {
    const s = net.createServer().listen(0, () => {
      const p = s.address().port;
      s.close(() => r(p));
    });
  });
const j = async (r) => {
  const t = await r.text();
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
};
const call = (m, p, { body, tok = token, headers = {} } = {}) =>
  fetch(B + p, {
    method: m,
    headers: { 'content-type': 'application/json', ...(tok ? { authorization: `Bearer ${tok}` } : {}), ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });

before(async () => {
  port = await freePort();
  B = `http://127.0.0.1:${port}/api`;
  await startServer();
  let r = await j(await call('POST', '/auth/login', { body: { password: PW }, tok: null }));
  r = await j(await call('POST', '/auth/password', { body: { currentPassword: PW, newPassword: 'matkhau-moi-bao-mat' }, tok: r.accessToken }));
  token = r.accessToken;
  const p = await j(await call('POST', '/projects', { body: { hostId: 'local', rootPath: path.join(work, 'proj') } }));
  projectId = p.id;
  assert.ok(projectId, `không tạo được dự án thử: ${JSON.stringify(p)}`);
});
after(() => {
  srv?.kill();
  fs.rmSync(tmp, { recursive: true, force: true });
});

// ---------------- truy cập chưa xác thực / token giả ----------------
test('API không token → 401 ở mọi nhóm route', async () => {
  for (const p of ['/hosts', '/terminals', '/claude/sessions', `/projects/${projectId}/fs?path=`, '/system/info', '/auth/devices', '/me/preferences', '/sso/config'])
    assert.equal((await call('GET', p, { tok: null })).status, 401, p);
});
test('JWT giả (alg none, chữ ký sai) → 401', async () => {
  const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from('{"sub":"x","role":"owner","stage":"full"}').toString('base64url')}.`;
  assert.equal((await call('GET', '/hosts', { tok: none })).status, 401);
  assert.equal((await call('GET', '/hosts', { tok: token.slice(0, -4) + 'AAAA' })).status, 401);
});
test('refresh cookie giả → 401', async () => {
  assert.equal((await fetch(`${B}/auth/refresh`, { method: 'POST', headers: { cookie: 'hr_refresh=sai' } })).status, 401);
});
test('vé SSE dùng một lần, thiếu vé → 401', async () => {
  const { ticket } = await j(await call('POST', '/auth/stream-ticket'));
  const a = await fetch(`${B}/events/stream?ticket=${ticket}`);
  assert.equal(a.status, 200);
  await a.body.cancel();
  assert.equal((await fetch(`${B}/events/stream?ticket=${ticket}`)).status, 401);
  assert.equal((await fetch(`${B}/events/stream`)).status, 401);
});

// ---------------- cookie, CORS, header ----------------
test('cookie refresh: HttpOnly, SameSite=Strict, Path=/api/auth', async () => {
  const r = await fetch(`${B}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'matkhau-moi-bao-mat' }) });
  const c = r.headers.get('set-cookie') ?? '';
  assert.match(c, /hr_refresh=/);
  assert.match(c, /HttpOnly/i);
  assert.match(c, /SameSite=Strict/i);
  assert.match(c, /Path=\/api\/auth/);
});
test('CORS: origin lạ không được phép', async () => {
  const r = await fetch(`${B}/hosts`, { method: 'OPTIONS', headers: { origin: 'https://evil.example', 'access-control-request-method': 'GET' } });
  assert.equal(r.headers.get('access-control-allow-origin'), null);
  const g = await call('GET', '/hosts', { headers: { origin: 'https://evil.example' } });
  assert.equal(g.headers.get('access-control-allow-origin'), null);
});
test('header bảo mật, không lộ x-powered-by, tắt swagger ở production', async () => {
  const r = await fetch(`${B}/health`);
  assert.equal(r.headers.get('x-powered-by'), null);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
  assert.equal((await fetch(`${B}/docs-json`)).status, 404);
});

// ---------------- path traversal ----------------
test('path traversal: .., mã hoá, tuyệt đối ngoài gốc, null byte, symlink ra ngoài → chặn', async () => {
  const bad = ['../secret-outside.txt', '../../etc/passwd', '%2e%2e/secret-outside.txt', path.join(tmp, 'secret-outside.txt'), '/etc/passwd', 'a.txt\u0000.png', 'escape/secret-outside.txt'];
  for (const p of bad) {
    const r = await call('GET', `/projects/${projectId}/fs/read?path=${encodeURIComponent(p)}`);
    const body = await r.text();
    assert.ok(r.status >= 400 && r.status < 500, `${p} → ${r.status}`);
    assert.ok(!body.includes('BÍ MẬT') && !body.includes('root:'), `${p} lộ nội dung`);
  }
  const w = await call('PUT', `/projects/${projectId}/fs/file`, { body: { path: '../pwned.txt', content: 'x' } });
  assert.ok(w.status >= 400);
  assert.ok(!fs.existsSync(path.join(work, 'pwned.txt')));
  assert.equal((await call('GET', `/projects/${projectId}/fs/read?path=a.txt`)).status, 200);
});
test('tạo dự án ngoài ALLOWED_ROOT → chặn', async () => {
  const r = await call('POST', '/projects', { body: { hostId: 'local', rootPath: '/etc' } });
  assert.ok(r.status >= 400 && r.status < 500, String(r.status));
});

// ---------------- prototype pollution, body ----------------
test('prototype pollution qua JSON không ảnh hưởng server', async () => {
  for (const body of ['{"__proto__":{"polluted":true}}', '{"constructor":{"prototype":{"polluted":true}}}', '{"theme":"dark","__proto__":{"isAdmin":true}}']) {
    const r = await call('PATCH', '/me/preferences', { body });
    assert.ok(r.status === 400 || r.status === 200, String(r.status));
  }
  const me = await j(await call('GET', '/auth/me'));
  assert.equal(me.role, 'owner');
  assert.equal(me.preferences.polluted, undefined);
  assert.equal(me.preferences.isAdmin, undefined);
  assert.equal({}.polluted, undefined);
  assert.equal((await fetch(`${B}/health`)).status, 200);
});
test('body quá lớn → 413, server vẫn sống', async () => {
  const r = await call('POST', '/auth/login', { body: JSON.stringify({ password: 'x'.repeat(2 * 1024 * 1024) }), tok: null });
  assert.equal(r.status, 413);
  assert.equal((await fetch(`${B}/health`)).status, 200);
});

// ---------------- WebSocket: CSWSH + fuzz ----------------
const wsOpen = (url, origin) =>
  new Promise((resolve) => {
    const ws = new WebSocket(url, { headers: origin ? { origin } : {} });
    ws.on('close', (code) => resolve({ ws, code }));
    ws.on('error', () => resolve({ ws, code: -1 }));
    ws.on('open', () => setTimeout(() => resolve({ ws, code: 0 }), 400));
  });
test('CSWSH: WS terminal không vé / vé giả / Origin lạ → đóng', async () => {
  const t = await j(await call('POST', `/projects/${projectId}/terminals`, { body: {} }));
  assert.ok(t.id, JSON.stringify(t));
  const base = `ws://127.0.0.1:${port}/ws/terminal?sessionId=${t.id}`;
  for (const url of [base, `${base}&ticket=gia`]) {
    const { code } = await wsOpen(url, `http://127.0.0.1:${port}`);
    assert.notEqual(code, 0, url);
  }
  const { ticket } = await j(await call('POST', '/auth/stream-ticket'));
  const { code } = await wsOpen(`${base}&ticket=${ticket}`, 'https://evil.example');
  assert.notEqual(code, 0, 'Origin lạ phải bị từ chối');
  await call('DELETE', `/terminals/${t.id}`);
});
test('fuzz WS: gửi rác vào terminal không làm sập server', async () => {
  const t = await j(await call('POST', `/projects/${projectId}/terminals`, { body: {} }));
  const { ticket } = await j(await call('POST', '/auth/stream-ticket'));
  const { ws, code } = await wsOpen(`ws://127.0.0.1:${port}/ws/terminal?sessionId=${t.id}&ticket=${ticket}`, `http://127.0.0.1:${port}`);
  assert.equal(code, 0);
  const junk = ['{', '{"type":"resize","cols":-1,"rows":1e9}', '{"type":"__proto__"}', 'null', '[]', Buffer.alloc(70_000, 0xff), '{"type":"input","data":12345}'];
  for (const m of junk) ws.send(m);
  await new Promise((r) => setTimeout(r, 500));
  ws.close();
  assert.equal((await fetch(`${B}/health`)).status, 200);
  await call('DELETE', `/terminals/${t.id}`);
});

// ---------------- 4 ca mới ----------------
test('mới 1 — cấu hình OIDC khi chưa đăng nhập → 401 (đọc lẫn ghi)', async () => {
  assert.equal((await call('GET', '/sso/config', { tok: null })).status, 401);
  assert.equal((await call('PUT', '/sso/config', { tok: null, body: { provider: 'oidc', clientId: 'x', allowedEmails: [], enabled: false } })).status, 401);
  assert.equal((await call('POST', '/sso/discover', { tok: null, body: { provider: 'oidc', issuerUrl: 'https://x' } })).status, 401);
});
test('mới 2 — SSRF qua discover: http, IP nội bộ, metadata cloud → từ chối', async () => {
  for (const u of ['http://example.com', 'https://127.0.0.1', 'https://localhost', 'https://169.254.169.254/latest', 'https://10.0.0.5', 'https://192.168.1.1', 'https://[::1]', 'file:///etc/passwd']) {
    const r = await call('POST', '/sso/discover', { body: { provider: 'oidc', issuerUrl: u } });
    assert.equal(r.status, 400, u);
  }
});
test('mới 3 — API danh sách máy không trả mật khẩu/bí mật', async () => {
  const pr = await call('PATCH', '/hosts/pw-host', { body: { authType: 'password', password: 'mat-khau-ssh-rat-bi-mat' } });
  assert.ok(pr.status < 500, String(pr.status));
  const raw = await (await call('GET', '/hosts')).text();
  assert.ok(!raw.includes('mat-khau-ssh-rat-bi-mat'));
  assert.ok(!/"(password|secret|secretEnc|passphrase)"\s*:/i.test(raw), raw.slice(0, 300));
});
test('mới 4 — host key đổi → chặn kết nối (HOST_KEY_CHANGED)', async (t) => {
  const up = await new Promise((r) => {
    const s = net.connect(2222, '127.0.0.1', () => {
      s.end();
      r(true);
    });
    s.on('error', () => r(false));
  });
  if (!up) return t.skip('demo-sshd :2222 chưa chạy (make dev)');
  const first = await j(await call('POST', '/hosts/demo-sshd/test', { body: {} }));
  assert.equal(first.code, 'HOST_KEY_UNKNOWN', JSON.stringify(first));
  const db = new Database(path.join(tmp, 'data', 'hugremote.db'));
  db.prepare(
    `INSERT OR REPLACE INTO known_hosts (host_id, host, port, key_type, fingerprint_sha256, trusted_at) VALUES ('demo-sshd','127.0.0.1',2222,?,?,?)`,
  ).run(first.details.keyType, 'SHA256:' + Buffer.alloc(32, 7).toString('base64').replace(/=+$/, ''), new Date().toISOString());
  db.close();
  await restartServer(); // kho khoá nạp lúc khởi động (và token vẫn dùng được sau khởi động lại — AC-2)
  const b = await j(await call('POST', '/hosts/demo-sshd/test', { body: {} }));
  assert.equal(b.code, 'HOST_KEY_CHANGED', JSON.stringify(b));
});

// ---------------- khoá đăng nhập (để cuối: khoá cả IP thử) ----------------
test('đăng nhập sai liên tục → khoá (429 + retryAfter)', async () => {
  let last;
  for (let i = 0; i < 7; i++) last = await call('POST', '/auth/login', { body: { password: 'sai-' + i }, tok: null });
  assert.equal(last.status, 429);
  const b = await j(last);
  assert.ok(b.code === 'LOCKED' || b.code === 'RATE_LIMITED', b.code);
});
