'use strict';
/**
 * `hugremote import-v1` (AC-30): sao lưu rồi CHỈ ĐỌC dữ liệu HugRemote v1, ghi vào SQLite của bản mới.
 * Định dạng v1 không có tài liệu trong intake → đọc khoan dung nhiều dạng khoá (DECISIONS 2026-11-22). Chạy lại
 * thì bỏ qua bản ghi đã có (khoá tự nhiên: dự án theo máy + đường dẫn, phiên Claude theo cli_session_id, máy theo alias).
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const home = (p) => (p === '~' ? os.homedir() : p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : p);
const readJson = (f, report) => {
  if (!fs.existsSync(f)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch (e) {
    report.skipped.push(`${path.basename(f)}: hỏng (${e.message}) — bỏ qua`);
    return undefined;
  }
};
const pick = (o, ...keys) => {
  for (const k of keys) if (o && o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k];
  return undefined;
};
const list = (v, ...keys) => (Array.isArray(v) ? v : v && typeof v === 'object' ? pick(v, ...keys) ?? Object.entries(v).map(([k, x]) => (typeof x === 'object' ? { id: k, ...x } : { id: k, value: x })) : []);

/** Cùng thuật toán với CryptoService của api: khoá AES dẫn từ secret.key bằng HMAC. */
function makeEncrypt(dataDir) {
  const master = Buffer.from(fs.readFileSync(path.join(dataDir, 'secret.key'), 'utf8').trim(), 'base64');
  const key = crypto.createHmac('sha256', master).update('hugremote:aes').digest();
  return (plain) => {
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
    return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), ct.toString('base64')].join(':');
  };
}

function findV1Dir(from) {
  const cands = from ? [home(from)] : ['~/.hugremote', '~/.hugcode', '~/.config/hugcode', '~/.config/hugremote-v1'].map(home);
  return cands.find((d) => fs.existsSync(path.join(d, 'projects.json')) || fs.existsSync(path.join(d, 'auth.json')));
}

function importV1({ dataDir, root, from, sshDir, dryRun }) {
  const report = { projects: 0, hosts: 0, claude: 0, password: false, twoFactor: false, skipped: [] };
  const v1 = findV1Dir(from);
  if (!v1) {
    console.error(`Không thấy dữ liệu v1${from ? ` ở ${from}` : ''} (cần projects.json hoặc auth.json). Dùng --from <thư mục>.`);
    process.exitCode = 1;
    return;
  }
  const ssh = home(sshDir || '~/.ssh');
  const db = path.join(dataDir, 'hugremote.db');
  if (!fs.existsSync(db) || !fs.existsSync(path.join(dataDir, 'secret.key'))) {
    console.error(`Chưa có dữ liệu bản mới ở ${dataDir} — chạy HugRemote một lần trước rồi nhập.`);
    process.exitCode = 1;
    return;
  }
  // 1. Sao lưu nguyên trạng (chỉ đọc nguồn)
  const stamp = new Date().toISOString().slice(0, 10);
  const backup = path.join(dataDir, `import-v1-${stamp}`);
  const files = ['projects.json', 'auth.json', 'two_factor.json'].map((f) => path.join(v1, f));
  const sshFiles = ['hugcode_claude_sessions.json', 'hugcode_credentials.json'].map((f) => path.join(ssh, f));
  if (!dryRun) {
    fs.mkdirSync(backup, { recursive: true, mode: 0o700 });
    for (const f of [...files, ...sshFiles]) if (fs.existsSync(f)) fs.copyFileSync(f, path.join(backup, path.basename(f)));
    for (const f of fs.readdirSync(backup)) fs.chmodSync(path.join(backup, f), 0o600);
  }
  const [projectsJ, authJ, tfaJ] = files.map((f) => readJson(f, report));
  const [sessionsJ, credsJ] = sshFiles.map((f) => readJson(f, report));

  const Database = require(require.resolve('better-sqlite3', { paths: [path.join(root, 'apps', 'api')] }));
  const conn = new Database(db);
  conn.pragma('busy_timeout = 5000');
  const encrypt = makeEncrypt(dataDir);
  const now = new Date().toISOString();
  const owner = conn.prepare(`SELECT id FROM users WHERE role='owner'`).get();
  if (!owner) {
    console.error('Chưa có tài khoản owner ở bản mới.');
    process.exitCode = 1;
    return;
  }

  const run = () => {
    // 2. Mật khẩu: giữ băm PBKDF2-SHA512 100k của v1 (cùng định dạng) → đăng nhập bằng mật khẩu cũ
    if (authJ) {
      const hash = pick(authJ, 'passwordHash', 'password_hash', 'hash');
      const salt = pick(authJ, 'salt', 'passwordSalt', 'password_salt');
      const iter = Number(pick(authJ, 'iterations', 'iter') ?? 100000);
      if (hash && salt && iter === 100000 && /^[0-9a-f]{128}$/i.test(hash)) {
        conn.prepare(`UPDATE users SET password_hash=?, password_salt=?, must_change_password=0 WHERE id=?`).run(hash, salt, owner.id);
        report.password = true;
      } else report.skipped.push('auth.json: định dạng băm khác PBKDF2-SHA512 100k — giữ mật khẩu hiện tại');
    }
    // 3. 2FA: mã hoá lại secret bằng khoá của bản mới
    if (tfaJ) {
      const secret = pick(tfaJ, 'secret', 'base32', 'totpSecret');
      const enabled = pick(tfaJ, 'enabled', 'isEnabled') !== false;
      if (secret && enabled) {
        const codes = (pick(tfaJ, 'recoveryCodeHashes', 'recoveryCodes', 'backupCodes') ?? []).map((c) =>
          /^[0-9a-f]{64}$/i.test(c) ? c : crypto.createHash('sha256').update(String(c).replace('-', '')).digest('hex'),
        );
        conn
          .prepare(
            `INSERT INTO two_factor (user_id, enabled, secret_enc, pending_secret_enc, recovery_code_hashes) VALUES (?,1,?,NULL,?)
             ON CONFLICT(user_id) DO UPDATE SET enabled=1, secret_enc=excluded.secret_enc, recovery_code_hashes=excluded.recovery_code_hashes`,
          )
          .run(owner.id, encrypt(String(secret).replace(/\s/g, '').toUpperCase()), JSON.stringify(codes));
        report.twoFactor = true;
      }
    }
    // 4. Mật khẩu SSH v1 (lưu rõ trong file v1) → mã hoá trong hosts_meta
    for (const c of list(credsJ, 'servers', 'credentials')) {
      const alias = pick(c, 'alias', 'host', 'id', 'name');
      const pw = pick(c, 'password', 'value');
      if (!alias || typeof pw !== 'string') continue;
      const had = conn.prepare(`SELECT host_id FROM hosts_meta WHERE host_id=? AND secret_enc IS NOT NULL`).get(alias);
      if (had) continue;
      conn
        .prepare(
          `INSERT INTO hosts_meta (host_id, workspace_dir, auth_type, secret_enc, updated_at) VALUES (?,NULL,'password',?,?)
           ON CONFLICT(host_id) DO UPDATE SET auth_type='password', secret_enc=excluded.secret_enc, updated_at=excluded.updated_at`,
        )
        .run(alias, encrypt(pw), now);
      report.hosts++;
    }
    // 5. Dự án
    const projectId = new Map();
    const ensureProject = (hostId, rootPath, name) => {
      const k = `${hostId}\0${rootPath}`;
      if (projectId.has(k)) return projectId.get(k);
      const had = conn.prepare(`SELECT id FROM projects WHERE host_id=? AND root_path=?`).get(hostId, rootPath);
      if (had) return projectId.set(k, had.id).get(k);
      const id = crypto.randomBytes(16).toString('hex');
      conn.prepare(`INSERT INTO projects (id, host_id, name, root_path, is_home, created_at) VALUES (?,?,?,?,0,?)`).run(id, hostId, name, rootPath, now);
      report.projects++;
      return projectId.set(k, id).get(k);
    };
    for (const p of list(projectsJ, 'projects', 'items')) {
      const rootPath = pick(p, 'path', 'rootPath', 'root', 'dir', 'cwd');
      if (!rootPath) continue;
      const hostId = pick(p, 'serverId', 'server', 'host', 'hostId') ?? 'local';
      ensureProject(String(hostId), String(rootPath).replace(/\/+$/, ''), String(pick(p, 'name', 'title') ?? path.basename(rootPath)));
    }
    // 6. Phiên Claude v1 → phiên HugRemote gắn cli_session_id, lượt đầu dùng --resume
    for (const s of list(sessionsJ, 'sessions', 'items')) {
      const cli = pick(s, 'sessionId', 'claudeSessionId', 'cliSessionId', 'id');
      const cwd = pick(s, 'cwd', 'projectPath', 'path', 'workdir');
      if (!cli || !cwd || !/^[0-9a-f-]{36}$/i.test(String(cli))) continue;
      const hostId = String(pick(s, 'serverId', 'server', 'host') ?? 'local');
      const pid = ensureProject(hostId, String(cwd).replace(/\/+$/, ''), path.basename(String(cwd)));
      if (conn.prepare(`SELECT 1 FROM claude_sessions WHERE project_id=? AND cli_session_id=?`).get(pid, cli)) continue;
      const id = crypto.randomUUID();
      const ts = String(pick(s, 'updatedAt', 'lastUsed', 'createdAt') ?? now);
      conn
        .prepare(
          `INSERT INTO claude_sessions (id, project_id, owner_user_id, name, cli_session_id, model, effort, permission_mode, status, last_sequence, created_at, updated_at)
           VALUES (?,?,?,?,?,NULL,NULL,'manual','idle',1,?,?)`,
        )
        .run(id, pid, owner.id, String(pick(s, 'name', 'title', 'summary') ?? 'Phiên từ v1').slice(0, 80), cli, ts, ts);
      conn
        .prepare(`INSERT INTO claude_messages (session_id, seq, role, content, created_at) VALUES (?,1,'cli_resume',?,?)`)
        .run(id, JSON.stringify({ kind: 'note', id: `${id.slice(0, 8)}-cli`, text: 'CLI_RESUMED' }), now);
      report.claude++;
    }
    const summary = { at: now, from: v1, backup, ...report };
    conn.prepare(`INSERT INTO settings (key, value) VALUES ('import_v1', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(JSON.stringify(summary));
  };
  if (dryRun) {
    console.log(`(thử) Sẽ nhập từ ${v1}: ${list(projectsJ, 'projects', 'items').length} dự án, ${list(sessionsJ, 'sessions', 'items').length} phiên Claude, ${list(credsJ, 'servers', 'credentials').length} mật khẩu SSH, mật khẩu: ${authJ ? 'có' : 'không'}, 2FA: ${tfaJ ? 'có' : 'không'}`);
    conn.close();
    return;
  }
  conn.transaction(run)();
  conn.close();
  console.log(
    `Đã nhập từ ${v1} (sao lưu: ${backup}):\n` +
      `  · ${report.projects} dự án mới\n  · ${report.claude} phiên Claude\n  · ${report.hosts} máy có mật khẩu SSH\n` +
      `  · mật khẩu đăng nhập: ${report.password ? 'giữ mật khẩu v1' : 'giữ nguyên'}\n  · 2FA: ${report.twoFactor ? 'đã chuyển' : 'không có'}` +
      (report.skipped.length ? `\nBỏ qua:\n  · ${report.skipped.join('\n  · ')}` : ''),
  );
}

module.exports = { importV1, findV1Dir };
