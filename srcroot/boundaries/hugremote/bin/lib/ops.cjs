'use strict';
/** `hugremote restart · update · -p -h -b` (AC-29, AC-31) — gọi script shell của bản đang chạy. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');

const BIN = path.resolve(__dirname, '..');
const env = () => ({ ...process.env, DATA_DIR: process.env.DATA_DIR || path.join(os.homedir(), '.config/hugremote'), INSTALL_ROOT: process.env.INSTALL_ROOT || path.join(os.homedir(), '.local/share/hugremote') });
const sh = (script) => execFileSync('bash', ['-c', script], { env: env(), stdio: 'inherit' });

function restart() {
  sh(`. "${BIN}/lib/service.sh"; service_restart`);
  console.log('Đã khởi động lại HugRemote.');
}

/** Sửa một khoá trong $DATA_DIR/.env (giữ các dòng khác) rồi khởi động lại. */
function setEnv(pairs) {
  const file = path.join(env().DATA_DIR, '.env');
  let text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  for (const [k, v] of Object.entries(pairs)) {
    const re = new RegExp(`^${k}=.*$`, 'm');
    text = re.test(text) ? text.replace(re, `${k}=${v}`) : `${text.replace(/\n?$/, '\n')}${k}=${v}\n`;
  }
  fs.writeFileSync(file, text, { mode: 0o600 });
  console.log(`Đã ghi ${Object.keys(pairs).join(', ')} vào ${file}`);
  restart();
}

function latest(channel) {
  const out = execFileSync('bash', ['-c', `. "${BIN}/lib/release.sh"; latest_tag ${channel}`], { env: env() }).toString().trim();
  return out || null;
}

/** Khởi chạy updater tách rời (sống tiếp khi api khởi động lại). Trả run-id. */
function startUpdate(tag) {
  const e = env();
  const run = `${Date.now().toString(36)}`;
  // chép script ra ngoài thư mục bản đang chạy — bản cũ có thể bị dọn trong lúc cập nhật
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'hugremote-update-'));
  fs.cpSync(BIN, path.join(work, 'bin'), { recursive: true });
  const child = spawn('bash', [path.join(work, 'bin', 'isolated-update.sh'), tag, run], { env: e, detached: true, stdio: 'ignore' });
  child.unref();
  return run;
}

function update(args) {
  const e = env();
  const cur = (() => {
    try {
      return path.basename(fs.readlinkSync(path.join(e.INSTALL_ROOT, 'current')));
    } catch {
      return null;
    }
  })();
  if (!cur) {
    console.error('Bản này không cài bằng install.sh (không có INSTALL_ROOT/current) — cập nhật bằng git pull + make.');
    process.exitCode = 1;
    return;
  }
  if (args.includes('--rollback')) {
    const rel = fs.readdirSync(path.join(e.INSTALL_ROOT, 'releases')).filter((d) => !d.startsWith('.') && d !== cur);
    const prev = rel.sort((a, b) => fs.statSync(path.join(e.INSTALL_ROOT, 'releases', b)).mtimeMs - fs.statSync(path.join(e.INSTALL_ROOT, 'releases', a)).mtimeMs)[0];
    if (!prev) return console.log('Không còn bản cũ để quay về.');
    sh(`. "${BIN}/lib/release.sh"; . "${BIN}/lib/service.sh"; switch_to "${prev}"; service_restart`);
    return console.log(`Đã quay về ${prev}.`);
  }
  const channel = args.includes('--beta') ? 'beta' : args.includes('--stable') ? 'stable' : e.UPDATE_CHANNEL || 'stable';
  const tag = latest(channel);
  if (!tag) return console.log(`Không thấy bản phát hành ${channel}.`);
  if (tag === cur) return console.log(`Đang ở bản mới nhất (${cur}).`);
  if (args.includes('--dry-run')) return console.log(`Có bản mới ${tag} (${channel}); đang chạy ${cur}.`);
  const run = startUpdate(tag);
  console.log(`Đang cập nhật ${cur} → ${tag} (run ${run}). Theo dõi: ${path.join(e.DATA_DIR, 'logs', 'update.log')}`);
}

module.exports = { restart, setEnv, update, latest, startUpdate };
