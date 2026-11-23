// Luồng lõi (ARCHITECTURE §7) + luồng tiền/dữ liệu + ca biên đã quyết (SOLUTION §B1) + phân quyền (AC-33).
// Dựng một instance production thật trên cổng ngẫu nhiên, dữ liệu tạm. Chạy:
//   pnpm --filter @app/api build && pnpm --filter @app/api test:core
// Ca SSH (smoke luồng lõi) cần container demo-sshd của `make dev` (deployment/local/docker-compose.yml) —
// không có thì tự bỏ qua (t.skip), các ca khác (tiền/dữ liệu/phân quyền) chạy trên máy "local", không cần container.
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
const Database = require('better-sqlite3');

const API = path.resolve(import.meta.dirname, '..');
const REPO_ROOT = path.resolve(API, '../../../../..');
const FAKE_CLAUDE = path.join(REPO_ROOT, 'deployment/local/fake-claude/claude');
const DEV_KEY = path.join(REPO_ROOT, 'deployment/local/ssh/dev_ed25519');
const { totp } = require(path.join(API, 'dist/common/totp.js'));

const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'hr-core-')));
const work = path.join(tmp, 'work');
fs.mkdirSync(path.join(work, 'proj'), { recursive: true });
fs.writeFileSync(path.join(work, 'proj', 'a.txt'), 'ok');

const PW = 'matkhau-khoi-tao-ban-dau';
const JWT_SECRET = 'bi-mat-chi-dung-cho-test-core-flow';
let port;
let srv;
let B;
let dbPath;

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
  JWT_SECRET,
  CLAUDE_BIN_PATH: FAKE_CLAUDE,
});

const freePort = () =>
  new Promise((r) => {
    const s = net.createServer().listen(0, () => {
      const p = s.address().port;
      s.close(() => r(p));
    });
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

const j = async (r) => {
  const t = await r.text();
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
};
const call = (m, p, { body, tok, headers = {} } = {}) =>
  fetch(B + p, {
    method: m,
    headers: { 'content-type': 'application/json', ...(tok ? { authorization: `Bearer ${tok}` } : {}), ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });

/** Chờ `cond(await got())` đúng, hoặc hết giờ. */
async function waitFor(got, cond, { timeoutMs = 10_000, stepMs = 150 } = {}) {
  const t0 = Date.now();
  for (;;) {
    const v = await got();
    if (cond(v)) return v;
    if (Date.now() - t0 > timeoutMs) throw new Error(`waitFor hết giờ: ${JSON.stringify(v)}`);
    await new Promise((r) => setTimeout(r, stepMs));
  }
}

// ---------------- JWT thủ công cho tài khoản member (AC-33) — ký cùng JWT_SECRET của instance thử ----------------
const b64url = (buf) => buf.toString('base64url');
function signAccessToken(claims, secret, ttlSec = 3600) {
  const header = b64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(Buffer.from(JSON.stringify({ ...claims, iat: now, exp: now + ttlSec })));
  const sig = b64url(crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${sig}`;
}

/** Tạo thẳng một tài khoản `member` + family refresh còn hiệu lực trong DB, rồi tự ký access token (AC-33 — không
 * cần dựng cả luồng SSO chỉ để kiểm member không đụng được dữ liệu của người khác). */
function makeMemberToken() {
  const db = new Database(dbPath);
  const id = crypto.randomUUID();
  const fam = crypto.randomUUID();
  const iso = new Date().toISOString();
  db.prepare(
    `INSERT INTO users (id, role, email, must_change_password, preferences, created_at) VALUES (?, 'member', ?, 0, '{}', ?)`,
  ).run(id, 'member@dogfood.local', iso);
  db.prepare(
    `INSERT INTO refresh_tokens (id, user_id, family_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(crypto.randomUUID(), id, fam, crypto.randomBytes(16).toString('hex'), iso, new Date(Date.now() + 86_400_000).toISOString());
  db.close();
  return { userId: id, token: signAccessToken({ sub: id, role: 'member', fam, mcp: false, stage: 'full' }, JWT_SECRET) };
}

let ownerToken;
let localProjectId;

before(async () => {
  port = await freePort();
  B = `http://127.0.0.1:${port}/api`;
  dbPath = path.join(tmp, 'data', 'hugremote.db');
  await startServer();

  // AC-1: mật khẩu khởi tạo bắt đổi ngay
  let r = await j(await call('POST', '/auth/login', { body: { password: PW } }));
  assert.equal(r.mustChangePassword, true);
  r = await j(await call('POST', '/auth/password', { body: { currentPassword: PW, newPassword: 'matkhau-moi-rat-dai' }, tok: r.accessToken }));
  ownerToken = r.accessToken;

  // AC-3: bật 2FA, rồi đăng xuất/đăng nhập lại đúng vòng mật khẩu → mã TOTP (khép luồng Truy cập của §7)
  const setup = await j(await call('POST', '/auth/2fa/setup', { tok: ownerToken }));
  const code0 = totp(setup.secret);
  await j(await call('POST', '/auth/2fa/enable', { body: { code: code0 }, tok: ownerToken }));
  let login = await j(await call('POST', '/auth/login', { body: { password: 'matkhau-moi-rat-dai' } }));
  assert.equal(login.needs2fa, true, JSON.stringify(login));
  const code1 = totp(setup.secret);
  const verified = await j(await call('POST', '/auth/2fa/verify', { body: { pendingToken: login.pendingToken, code: code1 } }));
  assert.ok(verified.accessToken, JSON.stringify(verified));
  ownerToken = verified.accessToken;

  // Dự án "local" dùng cho các ca tiền/dữ liệu/phân quyền — không cần container SSH
  const p = await j(await call('POST', '/projects', { body: { hostId: 'local', rootPath: path.join(work, 'proj') }, tok: ownerToken }));
  assert.ok(p.id, JSON.stringify(p));
  localProjectId = p.id;
});

after(() => {
  srv?.kill();
  fs.rmSync(tmp, { recursive: true, force: true });
});

// ================================================================================================
// 1) SMOKE — luồng lõi ARCHITECTURE §7 trọn vẹn trên máy SSH thật: Claude trong dự án trên máy SSH
//    → duyệt quyền → file Claude vừa ghi đọc được qua Files → commit qua Git.
// ================================================================================================
test('luồng lõi: máy SSH → tạo dự án → terminal → Claude xin quyền ghi file → Files thấy file mới → Git commit', async (t) => {
  const up = await new Promise((res) => {
    const s = net.connect(2222, '127.0.0.1', () => {
      s.end();
      res(true);
    });
    s.on('error', () => res(false));
  });
  if (!up) return t.skip('demo-sshd :2222 chưa chạy (cần `make dev` dựng container trước)');

  fs.writeFileSync(
    path.join(tmp, 'ssh_config'),
    `Host demo-sshd\n  HostName 127.0.0.1\n  Port 2222\n  User dev\n  IdentityFile ${DEV_KEY}\n`,
  );
  // Reload cấu hình máy: cache theo mtime, buộc server đọc lại ngay bằng cách gọi GET /hosts (đọc lazy theo mtime)
  await call('GET', '/hosts', { tok: ownerToken });

  // AC-6: lần đầu phải tin host key
  const first = await j(await call('POST', '/hosts/demo-sshd/test', { body: {}, tok: ownerToken }));
  assert.equal(first.code, 'HOST_KEY_UNKNOWN', JSON.stringify(first));
  await call('POST', '/hosts/demo-sshd/trust-key', {
    body: { fingerprint: first.details.fingerprint, keyType: first.details.keyType },
    tok: ownerToken,
  });
  const ok = await j(await call('POST', '/hosts/demo-sshd/test', { body: {}, tok: ownerToken }));
  assert.equal(ok.ok, true, JSON.stringify(ok));

  // AC-7: dự án trên máy SSH, thư mục gieo sẵn (deployment/local/docker/sshd/seed-projects.sh)
  const proj = await j(await call('POST', '/projects', { body: { hostId: 'demo-sshd', rootPath: '~/projects/demo-api' }, tok: ownerToken }));
  assert.ok(proj.id, JSON.stringify(proj));

  // E. Terminal: mở PTY thật qua SSH, chạy một lệnh, đọc đúng output (AC-9)
  const term = await j(await call('POST', `/projects/${proj.id}/terminals`, { body: {}, tok: ownerToken }));
  const ticket1 = (await j(await call('POST', '/auth/stream-ticket', { tok: ownerToken }))).ticket;
  const marker = `smoke-ssh-${crypto.randomBytes(4).toString('hex')}`;
  const out = await new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/terminal?sessionId=${term.id}&ticket=${ticket1}&cols=80&rows=24`, {
      headers: { origin: `http://127.0.0.1:${port}` },
    });
    let buf = '';
    const timer = setTimeout(() => reject(new Error(`terminal SSH không thấy output: ${buf}`)), 15_000);
    ws.on('open', () => ws.send(`echo ${marker}\n`));
    ws.on('message', (d) => {
      buf += d.toString('utf8');
      if (buf.includes(marker)) {
        clearTimeout(timer);
        ws.close();
        resolve(buf);
      }
    });
    ws.on('error', reject);
  });
  assert.ok(out.includes(marker), 'không thấy output lệnh chạy trên PTY qua SSH');
  await call('DELETE', `/terminals/${term.id}`, { tok: ownerToken });

  // C. Claude (luồng lõi): gửi việc trên máy SSH, CLI giả (fake-claude, cài sẵn trong image sshd) xin quyền ghi file
  const cs = await j(await call('POST', `/projects/${proj.id}/claude/sessions`, { body: {}, tok: ownerToken }));
  const sendR = await call('POST', `/claude/sessions/${cs.id}/messages`, { body: { text: 'hãy ghi lại ghi chú vào NOTES-claude.md' }, tok: ownerToken });
  assert.equal(sendR.status, 200);

  const listOne = async () => {
    const all = await j(await call('GET', `/projects/${proj.id}/claude/sessions`, { tok: ownerToken }));
    return all.find((x) => x.id === cs.id);
  };
  const awaiting = await waitFor(listOne, (s) => s?.status === 'awaiting_input' && s.pending.length > 0, { timeoutMs: 20_000 });
  assert.equal(awaiting.pending[0].tool, 'Write');
  await call('POST', `/claude/sessions/${cs.id}/interactions/${awaiting.pending[0].id}`, { body: { decision: 'allow' }, tok: ownerToken });
  await waitFor(listOne, (s) => s?.status === 'done', { timeoutMs: 20_000 });

  // D. Files: file Claude vừa ghi trên máy SSH đọc được qua Files API
  const file = await j(await call('GET', `/projects/${proj.id}/fs/read?path=NOTES-claude.md`, { tok: ownerToken }));
  assert.match(file.content, /Ghi chú từ Claude/);

  // D. Git: Files mới (chưa track) → stage tất cả → commit
  const before1 = await j(await call('GET', `/projects/${proj.id}/git/status`, { tok: ownerToken }));
  assert.ok(before1.changes.some((c) => c.path === 'NOTES-claude.md'), JSON.stringify(before1.changes));
  await call('POST', `/projects/${proj.id}/git/stage`, { body: { paths: ['*'] }, tok: ownerToken });
  const committed = await j(await call('POST', `/projects/${proj.id}/git/commit`, { body: { message: 'ghi chú từ smoke test' }, tok: ownerToken }));
  assert.equal(committed.changes.length, 0, 'còn thay đổi chưa commit sau khi commit');
});

// ================================================================================================
// 2) TIỀN/DỮ LIỆU — gửi hai lần không tạo bản ghi trùng (idempotent theo khoá tự nhiên, ARCHITECTURE §6)
// ================================================================================================
test('tạo dự án hai lần với cùng (máy, đường dẫn) → trả lại đúng một bản ghi, không nhân bản', async () => {
  const a = await j(await call('POST', '/projects', { body: { hostId: 'local', rootPath: path.join(work, 'proj') }, tok: ownerToken }));
  const b = await j(await call('POST', '/projects', { body: { hostId: 'local', rootPath: path.join(work, 'proj') }, tok: ownerToken }));
  assert.equal(a.id, localProjectId);
  assert.equal(b.id, localProjectId);
  const db = new Database(dbPath, { readonly: true });
  const n = db.prepare(`SELECT COUNT(*) AS n FROM projects WHERE host_id = 'local' AND root_path = ?`).get(path.join(work, 'proj'));
  db.close();
  assert.equal(n.n, 1, 'có nhiều hơn một bản ghi dự án cho cùng một đường dẫn');
});

// ================================================================================================
// 3) TIỀN/DỮ LIỆU — sửa file đồng thời: baseMtime cũ không được ghi đè bản mới hơn (G-15)
// ================================================================================================
test('sửa file đồng thời: baseMtime cũ → 409 FILE_CHANGED, không mất bản đã lưu', async () => {
  const read0 = await j(await call('GET', `/projects/${localProjectId}/fs/read?path=a.txt`, { tok: ownerToken }));
  assert.equal(read0.content, 'ok');
  const w1 = await j(
    await call('PUT', `/projects/${localProjectId}/fs/file`, { body: { path: 'a.txt', content: 'v1-da-luu', baseMtime: read0.mtime }, tok: ownerToken }),
  );
  assert.ok(w1.mtime);
  const stale = await call('PUT', `/projects/${localProjectId}/fs/file`, {
    body: { path: 'a.txt', content: 'v2-se-bi-tu-choi', baseMtime: read0.mtime },
    tok: ownerToken,
  });
  assert.equal(stale.status, 409);
  const staleBody = await j(stale);
  assert.equal(staleBody.code, 'FILE_CHANGED');
  const after1 = await j(await call('GET', `/projects/${localProjectId}/fs/read?path=a.txt`, { tok: ownerToken }));
  assert.equal(after1.content, 'v1-da-luu', 'bản ghi trước bị đè mất dù server trả 409');
});

// ================================================================================================
// 4) CA BIÊN ĐÃ QUYẾT — duyệt quyền hai lần trên cùng một yêu cầu → lần sau 409 (không chạy quyền hai lần)
// ================================================================================================
test('duyệt quyền Claude hai lần trên cùng một yêu cầu → lần hai bị chặn (409 INTERACTION_ALREADY_ANSWERED)', async () => {
  const cs = await j(await call('POST', `/projects/${localProjectId}/claude/sessions`, { body: {}, tok: ownerToken }));
  await call('POST', `/claude/sessions/${cs.id}/messages`, { body: { text: 'xin quyền ghi file ghi chú' }, tok: ownerToken });
  const listOne = async () => {
    const all = await j(await call('GET', `/projects/${localProjectId}/claude/sessions`, { tok: ownerToken }));
    return all.find((x) => x.id === cs.id);
  };
  const awaiting = await waitFor(listOne, (s) => s?.status === 'awaiting_input' && s.pending.length > 0);
  const iid = awaiting.pending[0].id;
  const first = await call('POST', `/claude/sessions/${cs.id}/interactions/${iid}`, { body: { decision: 'allow' }, tok: ownerToken });
  assert.equal(first.status, 204);
  const second = await call('POST', `/claude/sessions/${cs.id}/interactions/${iid}`, { body: { decision: 'allow' }, tok: ownerToken });
  assert.equal(second.status, 409);
  assert.equal((await j(second)).code, 'INTERACTION_ALREADY_ANSWERED');
  await waitFor(listOne, (s) => s?.status === 'done');
});

// ================================================================================================
// 5) TIỀN/DỮ LIỆU — xếp hàng tin nhắn khi Claude đang chạy: không mất tin, không vượt quá 10, tự gửi tin kế
//    khi lượt xong, và Dừng không xoá hàng chờ (ARCHITECTURE §6 "Hai thiết bị cùng gửi prompt…", AC-40)
// ================================================================================================
test('gửi tin khi Claude đang chạy: vào hàng chờ, đầy thì từ chối, lượt xong tự gửi tin kế mà không xoá phần còn lại', async () => {
  const cs = await j(await call('POST', `/projects/${localProjectId}/claude/sessions`, { body: {}, tok: ownerToken }));
  const first = await j(await call('POST', `/claude/sessions/${cs.id}/messages`, { body: { text: 'việc đầu tiên, xin quyền ghi file' }, tok: ownerToken }));
  assert.equal(first.queued, false);

  // Lượt đầu đang chạy (chờ duyệt quyền) → 10 tin tiếp theo vào hàng chờ, tin thứ 11 bị từ chối (QUEUE_FULL)
  for (let i = 1; i <= 10; i++) {
    const r = await call('POST', `/claude/sessions/${cs.id}/messages`, { body: { text: `việc xếp hàng #${i}` }, tok: ownerToken });
    assert.equal(r.status, 202, `tin #${i} phải được xếp hàng`);
    assert.equal((await j(r)).queued, true);
  }
  const overflow = await call('POST', `/claude/sessions/${cs.id}/messages`, { body: { text: 'tin vượt quá 10' }, tok: ownerToken });
  assert.equal(overflow.status, 409);
  assert.equal((await j(overflow)).code, 'QUEUE_FULL');

  const queueBefore = await j(await call('GET', `/claude/sessions/${cs.id}/queue`, { tok: ownerToken }));
  assert.equal(queueBefore.length, 10);

  // Duyệt quyền của lượt đầu → lượt xong → server tự rút tin cũ nhất trong hàng chờ, không cần trình duyệt gửi lại
  const listOne = async () => {
    const all = await j(await call('GET', `/projects/${localProjectId}/claude/sessions`, { tok: ownerToken }));
    return all.find((x) => x.id === cs.id);
  };
  const awaiting = await waitFor(listOne, (s) => s?.status === 'awaiting_input' && s.pending.length > 0);
  await call('POST', `/claude/sessions/${cs.id}/interactions/${awaiting.pending[0].id}`, { body: { decision: 'allow' }, tok: ownerToken });
  // lượt kế tiếp (tin xếp hàng #1) tự chạy và tới lượt xin quyền của chính nó
  await waitFor(listOne, (s) => s?.status === 'awaiting_input' && s.pending.length > 0, { timeoutMs: 15_000 });
  const queueAfter = await j(await call('GET', `/claude/sessions/${cs.id}/queue`, { tok: ownerToken }));
  assert.equal(queueAfter.length, 9, 'hàng chờ phải giảm đúng một tin khi lượt kế tự chạy');
  assert.ok(!queueAfter.some((q) => q.id === queueBefore[0].id), 'tin đã rút khỏi hàng chờ vẫn còn trong danh sách');

  // Dừng lượt đang chạy → hàng chờ còn nguyên 9 tin (không bị xoá theo, ARCHITECTURE §6)
  await call('POST', `/claude/sessions/${cs.id}/cancel`, { tok: ownerToken });
  await waitFor(listOne, (s) => s?.status === 'cancelled', { timeoutMs: 10_000 });
  const queueAfterCancel = await j(await call('GET', `/claude/sessions/${cs.id}/queue`, { tok: ownerToken }));
  assert.equal(queueAfterCancel.length, 9, 'Dừng không được xoá hàng chờ');
});

// ================================================================================================
// 6) PHÂN QUYỀN (AC-33) — member không đọc/điều khiển được phiên terminal/Claude của owner, không ghi được máy
// ================================================================================================
test('member không thấy và không điều khiển được phiên của owner; không thêm/sửa được máy', async () => {
  const { token: memberToken } = makeMemberToken();

  const ownerTerm = await j(await call('POST', `/projects/${localProjectId}/terminals`, { body: {}, tok: ownerToken }));
  const ownerClaude = await j(await call('POST', `/projects/${localProjectId}/claude/sessions`, { body: {}, tok: ownerToken }));

  // Danh sách toàn cục của member không được lộ phiên của owner
  const memberTerms = await j(await call('GET', '/terminals', { tok: memberToken }));
  assert.ok(!memberTerms.some((t) => t.id === ownerTerm.id), 'member thấy terminal của owner trong danh sách của mình');
  const memberClaudeSessions = await j(await call('GET', '/claude/sessions', { tok: memberToken }));
  assert.ok(!memberClaudeSessions.some((s) => s.id === ownerClaude.id), 'member thấy phiên Claude của owner trong danh sách của mình');

  // Gọi thẳng theo id (URL gõ tay) → 403, không phải 404 (không được dùng 404 để lộ "có tồn tại")
  const t1 = await call('DELETE', `/terminals/${ownerTerm.id}`, { tok: memberToken });
  assert.equal(t1.status, 403);
  assert.equal((await j(t1)).code, 'NOT_SESSION_OWNER');
  const t2 = await call('POST', `/claude/sessions/${ownerClaude.id}/messages`, { body: { text: 'chen ngang' }, tok: memberToken });
  assert.equal(t2.status, 403);
  assert.equal((await j(t2)).code, 'NOT_SESSION_OWNER');

  // Máy: member xem được danh sách nhưng không ghi được, không có keyPath/configFile, không duyệt được cây thư mục
  const memberHosts = await j(await call('GET', '/hosts', { tok: memberToken }));
  assert.ok(memberHosts.hosts.every((h) => h.keyPath === undefined && h.configFile === undefined), 'member thấy keyPath/configFile của máy');
  const createHost = await call('POST', '/hosts', {
    body: { alias: 'm-khong-duoc-tao', hostName: '127.0.0.1', user: 'dev', authType: 'agent' },
    tok: memberToken,
  });
  assert.equal(createHost.status, 403);
  assert.equal((await call('GET', '/hosts/local/browse', { tok: memberToken })).status, 403, 'member duyệt được cây thư mục máy (recon)');
  // Và owner xác nhận vẫn không bị ảnh hưởng (phiên của owner vẫn còn)
  const stillThere = await j(await call('GET', '/terminals', { tok: ownerToken }));
  assert.ok(stillThere.some((t) => t.id === ownerTerm.id));
  await call('DELETE', `/terminals/${ownerTerm.id}`, { tok: ownerToken });
});
