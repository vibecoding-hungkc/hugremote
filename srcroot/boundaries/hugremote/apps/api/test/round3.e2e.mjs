// Vòng 3 — AC-54/55 (tmux bền qua restart), AC-56 (mở lại tại chỗ, giữ id). Instance production thật, dữ liệu tạm,
// có restart API giữa chừng. Ca SSH cần container demo-sshd (:2222, image có tmux) — không có thì tự bỏ qua.
//   pnpm --filter @app/api build && pnpm --filter @app/api test:round3
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import * as crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');

const API = path.resolve(import.meta.dirname, '..');
const REPO_ROOT = path.resolve(API, '../../../../..');
const DEV_KEY = path.join(REPO_ROOT, 'deployment/local/ssh/dev_ed25519');
const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'hr-r3-')));
const work = path.join(tmp, 'work');
fs.mkdirSync(path.join(work, 'proj'), { recursive: true });
fs.writeFileSync(path.join(tmp, 'ssh_config'), `Host demo-sshd\n  HostName 127.0.0.1\n  Port 2222\n  User dev\n  IdentityFile ${DEV_KEY}\n`);

const PW = 'matkhau-khoi-tao-ban-dau';
let port, srv, B, tok;

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
  JWT_SECRET: 'bi-mat-chi-dung-cho-test-vong-3',
});
const freePort = () => new Promise((r) => { const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
async function start() {
  srv = spawn('node', ['dist/main.js'], { cwd: API, env: env(), stdio: 'ignore' });
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(`${B}/health`)).ok) return; } catch { /* chờ */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('api thử không lên');
}
async function restart() {
  await new Promise((r) => { srv.once('exit', r); srv.kill(); });
  await start();
}
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t); } catch { return t; } };
const call = (m, p, body) => fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: `Bearer ${tok}` }, body: body === undefined ? undefined : JSON.stringify(body) });
async function login() {
  const r = await j(await call('POST', '/auth/login', { password: 'matkhau-moi-rat-dai' }));
  tok = r.accessToken;
}
/** Mở WS terminal, gửi `cmd`, chờ thấy `expect` trong output. */
async function run(id, cmd, expect) {
  const ticket = (await j(await call('POST', '/auth/stream-ticket'))).ticket;
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/terminal?sessionId=${id}&ticket=${ticket}&cols=100&rows=30`, { headers: { origin: `http://127.0.0.1:${port}` } });
    let buf = '';
    const timer = setTimeout(() => { ws.close(); reject(new Error(`không thấy "${expect}": ${buf.slice(-400)}`)); }, 15_000);
    ws.on('open', () => setTimeout(() => ws.send(cmd + '\r'), 600));
    ws.on('message', (d) => { buf += d.toString('utf8'); if (buf.includes(expect)) { clearTimeout(timer); ws.close(); resolve(buf); } });
    ws.on('close', (code) => { if (code === 4404) { clearTimeout(timer); reject(new Error('gone')); } });
    ws.on('error', reject);
  });
}
const sshUp = () => new Promise((res) => { const s = net.connect(2222, '127.0.0.1', () => { s.end(); res(true); }); s.on('error', () => res(false)); });

let localProj;
before(async () => {
  port = await freePort();
  B = `http://127.0.0.1:${port}/api`;
  await start();
  let r = await j(await call('POST', '/auth/login', { password: PW }));
  tok = r.accessToken;
  r = await j(await call('POST', '/auth/password', { currentPassword: PW, newPassword: 'matkhau-moi-rat-dai' }));
  tok = r.accessToken;
  localProj = (await j(await call('POST', '/projects', { hostId: 'local', rootPath: path.join(work, 'proj') }))).id;
});
after(() => { srv?.kill(); fs.rmSync(tmp, { recursive: true, force: true }); });

test('AC-54: tmux trên "Máy này" bị chặn, tên ngoài whitelist bị chặn (G-17)', async () => {
  const a = await j(await call('POST', `/projects/${localProj}/terminals`, { tmux: 'abc' }));
  assert.equal(a.code, 'TMUX_LOCAL_NOT_SUPPORTED', JSON.stringify(a));
  const b = await call('POST', `/projects/${localProj}/terminals`, { tmux: 'a;id' });
  assert.equal(b.status, 400);
});

test('AC-56: terminal thường sau restart → exited; mở lại giữ nguyên id, chạy được lệnh; mở lại lần nữa → 409', async () => {
  const t1 = await j(await call('POST', `/projects/${localProj}/terminals`, { name: 'zsh-a' }));
  await run(t1.id, 'echo truoc-restart', 'truoc-restart');
  await restart();
  await login();
  let list = await j(await call('GET', `/projects/${localProj}/terminals`));
  assert.equal(list.find((x) => x.id === t1.id)?.status, 'exited');
  const re = await j(await call('POST', `/terminals/${t1.id}/reopen`));
  assert.equal(re.id, t1.id);
  assert.equal(re.name, 'zsh-a');
  assert.equal(re.status, 'running');
  list = await j(await call('GET', `/projects/${localProj}/terminals`));
  assert.equal(list.filter((x) => x.name === 'zsh-a').length, 1, 'mở lại không được đẻ thêm phiên');
  await run(t1.id, 'echo sau-mo-lai', 'sau-mo-lai');
  const again = await call('POST', `/terminals/${t1.id}/reopen`);
  assert.equal(again.status, 409);
  await call('DELETE', `/terminals/${t1.id}`);
});

test('AC-54/55: tmux trên máy SSH — tạo, liệt kê, sống qua restart API (cùng shell), × tắt hẳn session', async (t) => {
  if (!(await sshUp())) return t.skip('demo-sshd :2222 chưa chạy');
  await call('GET', '/hosts');
  const first = await j(await call('POST', '/hosts/demo-sshd/test', {}));
  if (first.code === 'HOST_KEY_UNKNOWN') await call('POST', '/hosts/demo-sshd/trust-key', { fingerprint: first.details.fingerprint, keyType: first.details.keyType });
  const proj = await j(await call('POST', '/projects', { hostId: 'demo-sshd', rootPath: '~/projects/demo-api' }));
  const name = `r3-${crypto.randomBytes(3).toString('hex')}`;
  const tm = await j(await call('POST', `/projects/${proj.id}/terminals`, { tmux: name }));
  assert.equal(tm.tmuxName, name, JSON.stringify(tm));
  assert.equal(tm.name, name, 'tên tab = tên session tmux, không tiền tố');
  const mark = `v${crypto.randomBytes(3).toString('hex')}`;
  await run(tm.id, `export HRMARK=${mark}; echo set-$HRMARK`, `set-${mark}`);
  let ls = await j(await call('GET', `/projects/${proj.id}/tmux-sessions`));
  assert.ok(ls.some((x) => x.name === name && x.sessionId === tm.id), JSON.stringify(ls));

  await restart();
  await login();
  const after1 = (await j(await call('GET', `/projects/${proj.id}/terminals`))).find((x) => x.id === tm.id);
  assert.equal(after1?.status, 'running', 'phiên tmux phải giữ running qua restart (AC-55)');
  await run(tm.id, 'echo got-$HRMARK', `got-${mark}`); // cùng shell trong tmux → biến còn

  assert.equal((await call('DELETE', `/terminals/${tm.id}`)).status, 204);
  ls = await j(await call('GET', `/projects/${proj.id}/tmux-sessions`));
  assert.ok(!ls.some((x) => x.name === name), 'đóng tab tmux phải tắt hẳn session (Q-4)');
});

// ---------------- AC-57/58: chuyển tiếp cổng hai chiều ----------------
const http = require('node:http');
const Database = require('better-sqlite3');
function memberToken() {
  const b64 = (b) => b.toString('base64url');
  const db = new Database(path.join(tmp, 'data', 'hugremote.db'));
  const id = crypto.randomUUID(), fam = crypto.randomUUID(), iso = new Date().toISOString();
  db.prepare(`INSERT INTO users (id, role, email, must_change_password, preferences, created_at) VALUES (?, 'member', ?, 0, '{}', ?)`).run(id, `m-${id.slice(0, 6)}@dogfood.local`, iso);
  db.prepare(`INSERT INTO refresh_tokens (id, user_id, family_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)`).run(crypto.randomUUID(), id, fam, crypto.randomBytes(16).toString('hex'), iso, new Date(Date.now() + 86_400_000).toISOString());
  db.close();
  const h = b64(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const now = Math.floor(Date.now() / 1000);
  const p = b64(Buffer.from(JSON.stringify({ sub: id, role: 'member', fam, mcp: false, stage: 'full', iat: now, exp: now + 3600 })));
  return `${h}.${p}.${b64(crypto.createHmac('sha256', env().JWT_SECRET).update(`${h}.${p}`).digest())}`;
}
const get = (port) => fetch(`http://127.0.0.1:${port}/`).then((r) => r.text());

test('AC-57/58: -L và -R thật qua SSH, trùng cổng 409, sửa cổng, tắt, member 403, tự bật lại sau restart', async (t) => {
  if (!(await sshUp())) return t.skip('demo-sshd :2222 chưa chạy');
  const proj = await j(await call('POST', '/projects', { hostId: 'demo-sshd', rootPath: '~/projects/demo-api' }));
  const sh = await j(await call('POST', `/projects/${proj.id}/terminals`, { name: 'fw' }));
  await run(sh.id, 'cd /tmp && echo hr-fw-ok > index.html && (nohup python3 -m http.server 18765 --bind 127.0.0.1 >/dev/null 2>&1 &) ; sleep 1; echo server-$((40+2))', 'server-42');

  const ports = await j(await call('GET', '/hosts/demo-sshd/listening-ports'));
  assert.ok(ports.some((p) => p.port === 18765), JSON.stringify(ports));
  assert.ok(!ports.some((p) => p.port === 22), 'cổng 22 không được liệt kê');

  // -L
  const L1 = await freePort();
  const fl = await j(await call('POST', '/port-forwards', { direction: 'L', hostId: 'demo-sshd', remotePort: 18765, localPort: L1, label: 'py', autoStart: true }));
  assert.equal(fl.status, 'on', JSON.stringify(fl));
  assert.match(await get(L1), /hr-fw-ok/);
  const dup = await j(await call('POST', '/port-forwards', { direction: 'L', hostId: 'demo-sshd', remotePort: 18765, localPort: L1 }));
  assert.equal(dup.code, 'LOCAL_PORT_IN_USE', JSON.stringify(dup));
  const L2 = await freePort();
  const moved = await j(await call('PATCH', `/port-forwards/${fl.id}`, { localPort: L2 }));
  assert.equal(moved.localPort, L2);
  assert.match(await get(L2), /hr-fw-ok/);
  await assert.rejects(get(L1), 'cổng cũ phải đóng sau khi sửa');

  // -R: service trên "Mac" (tiến trình test) → máy SSH gọi về
  const mac = http.createServer((_q, s) => s.end('tu-mac-len')).listen(0, '127.0.0.1');
  await new Promise((r) => mac.once('listening', r));
  const fr = await j(await call('POST', '/port-forwards', { direction: 'R', hostId: 'demo-sshd', remotePort: 18766, localPort: mac.address().port, autoStart: false }));
  assert.equal(fr.status, 'on', JSON.stringify(fr));
  await run(sh.id, `python3 -c "import urllib.request as u;print('R='+u.urlopen('http://127.0.0.1:18766').read().decode())"`, 'R=tu-mac-len');

  // owner-only (G-17)
  const mt = memberToken();
  const mr = await fetch(B + '/port-forwards', { headers: { authorization: `Bearer ${mt}` } });
  assert.equal(mr.status, 403);

  // restart: -L (autoStart) bật lại, -R (không autoStart) thành off
  await restart();
  await login();
  await new Promise((r) => setTimeout(r, 1500));
  const list = await j(await call('GET', '/port-forwards'));
  assert.equal(list.find((x) => x.id === fl.id)?.status, 'on', JSON.stringify(list));
  assert.equal(list.find((x) => x.id === fr.id)?.status, 'off', JSON.stringify(list));
  assert.match(await get(L2), /hr-fw-ok/);

  // tắt → cổng đóng; xoá
  const off = await j(await call('PATCH', `/port-forwards/${fl.id}`, { enabled: false }));
  assert.equal(off.status, 'off');
  await assert.rejects(get(L2));
  for (const f of list) assert.equal((await call('DELETE', `/port-forwards/${f.id}`)).status, 204);
  mac.close();
  await call('POST', `/terminals/${sh.id}/reopen`); // shell thường đã exited sau restart (AC-56)
  await run(sh.id, 'pkill -f "http.server 18765"; echo done-$((1+1))', 'done-2');
  await call('DELETE', `/terminals/${sh.id}`);
});
