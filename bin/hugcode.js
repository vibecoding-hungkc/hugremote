#!/usr/bin/env node

import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json for version
const pkgPath = path.resolve(__dirname, '../package.json');
let version = '1.0.0';
try {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  version = pkg.version || '1.0.0';
} catch (_) {}

const args = process.argv.slice(2);

function printHelp() {
  console.log(`
🐴 HugCode v${version} — Mobile-First Web IDE & Terminal

Sử dụng:
  hugcode [options]
  npx hugcode [options]

Tùy chọn:
  -p, --port <number>        Cổng lắng nghe HTTP/WS (mặc định: 8099 hoặc $PORT)
  -h, --host <ip>            Địa chỉ IP lắng nghe (mặc định: '::' hoặc $HOST)
  -b, --base-path <path>     Tiền tố đường dẫn subpath (vd: /remote hoặc $BASE_PATH)
  -w, --workspace <dir>      Thư mục workspace mặc định (mặc định: ~/projects hoặc $WORKSPACE_ROOT)
  -a, --allowed-root <dir>   Thư mục giới hạn tối đa duyệt file (mặc định: ~ hoặc $ALLOWED_ROOT)
  -v, --version              Hiển thị phiên bản
  --help                     Hiển thị hướng dẫn này

Ví dụ:
  hugcode                    # Khởi chạy cổng 8099
  hugcode -p 3000            # Khởi chạy cổng 3000
  hugcode -p 8099 -b /remote # Khởi chạy với base path /remote (Reverse Proxy/Cloudflare Tunnel)
`);
  process.exit(0);
}

if (args.includes('--help') || args.includes('-help')) {
  printHelp();
}

if (args.includes('-v') || args.includes('--version')) {
  console.log(`HugCode v${version}`);
  process.exit(0);
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
  }
}

// Ensure server dist exists
const serverEntry = path.resolve(__dirname, '../server/dist/index.js');
if (!fs.existsSync(serverEntry)) {
  console.error('⚠️  Không tìm thấy bản build server tại: ' + serverEntry);
  console.error('Vui lòng chạy: npm run build');
  process.exit(1);
}

// Start server
await import(serverEntry);
