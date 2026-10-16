#!/usr/bin/env node

import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { loadUserConfig } from './config-env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json for version
const pkgPath = path.resolve(__dirname, '../package.json');
let version = '1.0.0';
try {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  version = pkg.version || '1.0.0';
} catch (_) {}

const rawArgs = process.argv.slice(2);

// Normalize em-dash (—) and en-dash (–) to standard hyphens (- or --)
// Common on iOS / macOS / mobile virtual keyboards where -- or - auto-converts to —
const args = rawArgs.map((arg) => {
  if (typeof arg === 'string') {
    if (arg.startsWith('—') || arg.startsWith('–')) {
      const rest = arg.slice(1);
      return (rest.length === 1 ? '-' : '--') + rest;
    }
  }
  return arg;
});

function printHelp() {
  console.log(`
🐴 HugRemote v${version} — Mobile-First Web IDE & Terminal

Sử dụng:
  hugremote [options]
  hugremote update           Cập nhật HugRemote lên phiên bản mới nhất
  hugremote --version        Hiển thị phiên bản hiện tại
  npx hugremote [options]

Tùy chọn:
  -p, --port <number>        Cổng lắng nghe HTTP/WS (mặc định: 8099 hoặc $PORT)
  -h, --host <ip>            Địa chỉ IP lắng nghe (mặc định: '::' hoặc $HOST)
  -b, --base-path <path>     Tiền tố đường dẫn subpath (vd: /remote hoặc $BASE_PATH)
  -w, --workspace <dir>      Thư mục workspace mặc định (mặc định: ~ hoặc $WORKSPACE_ROOT)
  -a, --allowed-root <dir>   Thư mục giới hạn tối đa duyệt file (mặc định: ~ hoặc $ALLOWED_ROOT)
  --auth <mode>              Auth mode: none, password, google (mặc định: none hoặc $AUTH_MODE)
  --password <pass>          Mật khẩu ban đầu (mặc định: 123456 và bắt buộc đổi lần đầu)
  --app-url <url>            Public app URL cho Google OAuth (hoặc $APP_URL)
  -v, --version              Hiển thị phiên bản
  --help                     Hiển thị hướng dẫn này

Ví dụ:
  hugremote                    # Khởi chạy cổng 8099
  hugremote --version          # Xem phiên bản hiện tại
  hugremote update             # Cập nhật mã nguồn & tự động build
  hugremote -p 3000            # Khởi chạy cổng 3000
  hugremote -p 8099 -b /remote # Khởi chạy với base path /remote (Reverse Proxy/Cloudflare Tunnel)
`);
  process.exit(0);
}

if (
  args.includes('-v') ||
  args.includes('-V') ||
  args.includes('--v') ||
  args.includes('--version') ||
  args.includes('-version') ||
  args.includes('version')
) {
  console.log(`HugRemote v${version}`);
  process.exit(0);
}

if (args[0] === 'update' || args[0] === 'upgrade' || args.includes('--update')) {
  const { runUpdate } = await import('./update.js');
  await runUpdate(args.slice(1));
  process.exit(0);
}

if (
  args.includes('--help') ||
  args.includes('-help') ||
  args.includes('-h') ||
  args.includes('help')
) {
  printHelp();
}

try {
  loadUserConfig();
} catch (error) {
  console.error(`HugRemote: ${error.message}`);
  process.exit(1);
}

// Parse arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '-p' || arg === '--port') {
    const val = args[++i];
    if (val && !isNaN(parseInt(val, 10))) {
      process.env.PORT = val;
    }
  } else if (arg === '-h' || arg === '--host') {
    const val = args[++i];
    if (val) process.env.HOST = val;
  } else if (arg === '-b' || arg === '--base-path') {
    const val = args[++i];
    if (val) process.env.BASE_PATH = val;
  } else if (arg === '-w' || arg === '--workspace') {
    const val = args[++i];
    if (val) process.env.WORKSPACE_ROOT = path.resolve(val.replace(/^~/, os.homedir()));
  } else if (arg === '-a' || arg === '--allowed-root') {
    const val = args[++i];
    if (val) process.env.ALLOWED_ROOT = path.resolve(val.replace(/^~/, os.homedir()));
  } else if (arg === '--auth') {
    const val = args[++i];
    if (val) process.env.AUTH_MODE = val;
  } else if (arg === '--password') {
    const val = args[++i];
    if (val) process.env.AUTH_PASSWORD = val;
  } else if (arg === '--app-url') {
    const val = args[++i];
    if (val) process.env.APP_URL = val;
  }
}

// Ensure workspace directory exists
const targetWs = process.env.WORKSPACE_ROOT || os.homedir();
if (!fs.existsSync(targetWs)) {
  try {
    fs.mkdirSync(targetWs, { recursive: true });
  } catch (_) {}
}

// Ensure server dist exists
const serverEntry = path.resolve(__dirname, '../server/dist/index.js');
if (!fs.existsSync(serverEntry)) {
  console.error('⚠️  Không tìm thấy bản build server tại: ' + serverEntry);
  console.error('Vui lòng chạy: npm run build');
  process.exit(1);
}

// On macOS (Darwin), ensure node-pty spawn-helper has executable permission
if (process.platform === 'darwin') {
  try {
    const candidates = [
      path.resolve(__dirname, '../server/node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper'),
      path.resolve(__dirname, '../server/node_modules/node-pty/prebuilds/darwin-x64/spawn-helper'),
      path.resolve(__dirname, '../server/node_modules/node-pty/build/Release/spawn-helper'),
      path.resolve(__dirname, '../node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper'),
      path.resolve(__dirname, '../node_modules/node-pty/prebuilds/darwin-x64/spawn-helper'),
      path.resolve(__dirname, '../node_modules/node-pty/build/Release/spawn-helper'),
    ];
    for (const f of candidates) {
      if (fs.existsSync(f)) {
        try { fs.chmodSync(f, 0o755); } catch (_) {}
      }
    }
  } catch (_) {}
}

// Start server
await import(serverEntry);
