#!/usr/bin/env node
/* CLI hugremote (ARCHITECTURE §5 CLI): doctor [--fix] · reset-password · --version · restart · import-v1 · update.
   Không import code app ngoài bản build (ARCHITECTURE §8). */
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const home = (p) => (p === '~' ? os.homedir() : p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : p);
const DATA_DIR = home(process.env.DATA_DIR || '~/.config/hugremote');
const PORT = process.env.PORT || '8099';
const HOST = process.env.HOST || '127.0.0.1';
const BASE = (process.env.BASE_PATH || '').replace(/\/+$/, '');

function has(cmd, args = ['--version']) {
  try {
    return execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).toString().split('\n')[0].trim() || 'có';
  } catch {
    return null;
  }
}

function mode(p) {
  try {
    return fs.statSync(p).mode & 0o777;
  } catch {
    return null;
  }
}

async function doctor(fix) {
  const rows = [];
  const add = (ok, name, detail, hint) => rows.push({ ok, name, detail, hint });
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  add(nodeMajor >= 22, 'Node.js', process.versions.node, 'Cần Node 22 trở lên');
  for (const [cmd, name, need] of [['git', 'git', true], ['ssh', 'OpenSSH', true], ['python3', 'python3 (nén zip)', false], ['rg', 'ripgrep (tìm trong dự án)', false]]) {
    const v = has(cmd, cmd === 'ssh' ? ['-V'] : ['--version']);
    add(!!v || !need, name, v || 'không có', need ? `Cài ${cmd}` : `Nên cài ${cmd} — có thì nhanh hơn`);
  }
  const claude = has(process.env.CLAUDE_BIN_PATH || 'claude', ['--version']);
  add(true, 'Claude Code CLI (máy này)', claude || 'chưa cài — phiên Claude trên máy này sẽ báo cài', '');
  if (fix) {
    fs.mkdirSync(path.join(DATA_DIR, 'logs'), { recursive: true, mode: 0o700 });
    for (const [p, m] of [[DATA_DIR, 0o700], [path.join(DATA_DIR, 'logs'), 0o700], ...['hugremote.db', 'hugremote.db-wal', 'hugremote.db-shm', 'secret.key', 'known_hosts'].map((f) => [path.join(DATA_DIR, f), 0o600])]) {
      if (fs.existsSync(p) && mode(p) !== m) fs.chmodSync(p, m);
    }
  }
  const dm = mode(DATA_DIR);
  add(dm === 0o700, `Thư mục dữ liệu ${DATA_DIR}`, dm === null ? 'chưa có' : '0' + dm.toString(8), 'Chạy `hugremote doctor --fix`');
  for (const f of ['hugremote.db', 'secret.key']) {
    const m = mode(path.join(DATA_DIR, f));
    if (m !== null) add(m === 0o600, f, '0' + m.toString(8), 'Chạy `hugremote doctor --fix`');
  }
  const appUrl = process.env.APP_URL || '';
  if (appUrl.startsWith('http://') && !['127.0.0.1', 'localhost', '::1'].includes(HOST)) {
    add(false, 'HTTPS', appUrl, 'Đang mở ra ngoài mà không HTTPS — đặt sau reverse proxy/Cloudflare Tunnel và đặt APP_URL https://…');
  }
  try {
    const r = await fetch(`http://${HOST === '0.0.0.0' ? '127.0.0.1' : HOST}:${PORT}${BASE}/api/health`, { signal: AbortSignal.timeout(3000) });
    add(r.ok, 'Dịch vụ HugRemote', `${r.status} ${JSON.stringify(await r.json())}`, 'Khởi động lại: `hugremote restart`');
  } catch {
    add(false, 'Dịch vụ HugRemote', `không trả lời ở cổng ${PORT}`, 'Khởi động: `make dev` (dev) hoặc `hugremote restart`');
  }
  let bad = 0;
  for (const r of rows) {
    if (!r.ok) bad++;
    console.log(`${r.ok ? '✓' : '✗'} ${r.name}: ${r.detail}${r.ok || !r.hint ? '' : `\n    → ${r.hint}`}`);
  }
  console.log(bad ? `\n${bad} mục cần xử lý.` : '\nMọi thứ ổn.');
  process.exitCode = bad ? 1 : 0;
}

/** AC-47: đặt mật khẩu tạm, bắt đổi, đăng xuất mọi thiết bị, giữ 2FA. Ghi thẳng SQLite (WAL nên dịch vụ đang chạy vẫn được). */
function resetPassword() {
  const db = path.join(DATA_DIR, 'hugremote.db');
  if (!fs.existsSync(db)) {
    console.error(`Chưa có dữ liệu ở ${db} — HugRemote chưa từng chạy với DATA_DIR này.`);
    process.exit(1);
  }
  const Database = require(require.resolve('better-sqlite3', { paths: [path.join(ROOT, 'apps', 'api')] }));
  const conn = new Database(db);
  conn.pragma('busy_timeout = 5000');
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const pw = Array.from(crypto.randomBytes(16), (b) => alphabet[b % alphabet.length]).join('');
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(pw, salt, 100000, 64, 'sha512').toString('hex');
  const now = new Date().toISOString();
  const owner = conn.prepare(`SELECT id FROM users WHERE role='owner'`).get();
  if (!owner) {
    console.error('Chưa có tài khoản owner.');
    process.exit(1);
  }
  conn.transaction(() => {
    conn.prepare(`UPDATE users SET password_hash=?, password_salt=?, must_change_password=1 WHERE id=?`).run(hash, salt, owner.id);
    conn.prepare(`UPDATE refresh_tokens SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL`).run(now, owner.id);
    conn.prepare(`DELETE FROM login_attempts`).run();
  })();
  conn.close();
  console.log(`Mật khẩu tạm: ${pw}\nMọi thiết bị đã bị đăng xuất. Lần đăng nhập tới sẽ bắt đặt mật khẩu mới. 2FA (nếu bật) giữ nguyên.`);
}

const [cmd, ...rest] = process.argv.slice(2);
switch (cmd) {
  case '--version':
  case '-v':
  case 'version':
    console.log(pkg.version);
    break;
  case 'doctor':
    void doctor(rest.includes('--fix'));
    break;
  case 'reset-password':
    resetPassword();
    break;
  case 'import-v1': {
    const opt = (n) => (rest.includes(n) ? rest[rest.indexOf(n) + 1] : undefined);
    require('./lib/import-v1.cjs').importV1({ dataDir: DATA_DIR, root: ROOT, from: opt('--from'), sshDir: opt('--ssh-dir'), dryRun: rest.includes('--dry-run') });
    break;
  }
  default:
    console.log(`hugremote ${pkg.version}\n\nLệnh:\n  hugremote doctor [--fix]   kiểm môi trường, quyền file, dịch vụ\n  hugremote reset-password   đặt mật khẩu tạm khi quên mật khẩu\n  hugremote import-v1 [--from <thư mục v1>] [--ssh-dir <~/.ssh>] [--dry-run]   nhập dữ liệu HugRemote v1\n  hugremote --version`);
    if (cmd && cmd !== 'help' && cmd !== '--help') process.exitCode = 1;
}
