import fs from 'node:fs';
import path from 'node:path';

/**
 * Dọn payload API (`pnpm deploy --prod`) trước khi nhét vào .app — chỉ giữ thứ chạy được trên `darwin-<arch>`.
 * Đo 2026-11-25: payload 210 MB, trong đó node-pty prebuilds Windows 58 MB, better-sqlite3 prebuilds mọi nền tảng
 * 17 MB + mã nguồn SQLite 10 MB, @types, source map, mã nguồn TS của api.
 * Chạy riêng được: `node scripts/prune-payload.mjs <thư mục api đã deploy> <arm64|x64> [darwin|linux]` (linux: để thử trên máy dev).
 */
export function prunePayload(apiDir, arch, platform = 'darwin') {
  const keep = `${platform}-${arch}`;
  const rm = (p) => fs.rmSync(p, { recursive: true, force: true });

  // mã nguồn / cấu hình dev của chính api (chỉ cần dist + node_modules + package.json)
  for (const f of ['src', 'test', 'eslint.config.mjs', 'nest-cli.json', 'tsconfig.json', 'tsconfig.build.json', 'README.md', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'])
    rm(path.join(apiDir, f));

  const store = path.join(apiDir, 'node_modules', '.pnpm');
  if (!fs.existsSync(store)) return;
  for (const entry of fs.readdirSync(store)) {
    const pkgRoot = path.join(store, entry, 'node_modules');
    if (entry.startsWith('@types+')) {
      rm(path.join(store, entry));
      continue;
    }
    for (const name of ['node-pty', 'better-sqlite3']) {
      const dir = path.join(pkgRoot, name);
      if (!fs.existsSync(dir)) continue;
      // binary dựng sẵn: chỉ giữ đúng nền tảng của bản đóng gói
      const pre = path.join(dir, 'prebuilds');
      if (fs.existsSync(pre)) for (const p of fs.readdirSync(pre)) if (!p.startsWith(keep)) rm(path.join(pre, p));
      // mã nguồn C/C++ để tự build (winpty, conpty, SQLite amalgamation) — không cần lúc chạy
      for (const d of ['deps', 'third_party', 'src']) rm(path.join(dir, d));
    }
  }
  // source map + khai báo kiểu: không dùng lúc chạy
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.map') || e.name.endsWith('.d.ts') || e.name.endsWith('.d.mts') || e.name.endsWith('.d.cts')) fs.rmSync(full);
    }
  };
  walk(path.join(apiDir, 'node_modules'));
  walk(path.join(apiDir, 'dist'));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const [dir, arch = process.arch, platform = 'darwin'] = process.argv.slice(2);
  if (!dir) throw new Error('cách dùng: node scripts/prune-payload.mjs <thư mục api> [arm64|x64]');
  prunePayload(dir, arch, platform);
}
