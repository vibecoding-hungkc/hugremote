import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { signAndVerifyMacApp, buildMacDmg, patchMachOUuid } from './macos-installer.mjs';
import { prunePayload } from './prune-payload.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const desktopDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopDir, '..', '..');

const requireDesktop = createRequire(import.meta.url);
const { packager } = requireDesktop('@electron/packager');

if (process.platform !== 'darwin') {
  console.error('Lỗi: Đóng gói macOS .app/.dmg chỉ chạy được trên macOS.');
  process.exit(1);
}

const arch = process.arch;
console.log(`Bắt đầu đóng gói HugRemote Desktop cho macOS (${arch})...`);

const outDir = path.join(desktopDir, 'out');
const buildStage = path.join(outDir, 'build-stage');
const shellDir = path.join(buildStage, 'shell');
const payloadDir = path.join(buildStage, 'payload', 'hugremote');

// Dọn dẹp thư mục build tạm
fs.rmSync(buildStage, { recursive: true, force: true });
fs.mkdirSync(shellDir, { recursive: true });
fs.mkdirSync(payloadDir, { recursive: true });

// 1. Chuẩn bị shellDir cho Electron Packager
console.log('1. Chuẩn bị shellDir...');
const desktopPkg = JSON.parse(fs.readFileSync(path.join(desktopDir, 'package.json'), 'utf8'));
const shellPkg = {
  name: 'hugremote',
  productName: 'HugRemote',
  version: desktopPkg.version || '0.1.0',
  description: 'HugRemote Desktop for macOS',
  main: 'dist/main.js',
  type: 'module',
  private: true,
};
fs.writeFileSync(path.join(shellDir, 'package.json'), JSON.stringify(shellPkg, null, 2), 'utf8');
// chỉ mã chạy: bản cũ chép cả dist/HugRemote.dmg của lần build trước vào app → mỗi lần build dmg phình thêm (2026-11-25)
fs.cpSync(path.join(desktopDir, 'dist'), path.join(shellDir, 'dist'), {
  recursive: true,
  filter: (src) => !/\.(dmg|map)$|\.d\.c?ts$/.test(src),
});
fs.cpSync(path.join(desktopDir, 'resources'), path.join(shellDir, 'resources'), { recursive: true });

// 2. Chuẩn bị payload (API + Web + Shared)
console.log('2. Triển khai API độc lập qua pnpm deploy...');
const deployedApiDir = path.join(payloadDir, 'apps', 'api');
fs.mkdirSync(deployedApiDir, { recursive: true });
execFileSync(
  'pnpm',
  ['--filter', '@app/api', 'deploy', '--prod', deployedApiDir],
  { cwd: repoRoot, stdio: 'inherit' }
);

console.log('2b. Dọn payload: bỏ binary nền tảng khác, mã nguồn C/TS, @types, source map...');
prunePayload(deployedApiDir, arch);

console.log('3. Sao chép web dist & shared dist vào payload...');
const deployedWebDir = path.join(payloadDir, 'apps', 'web', 'dist');
fs.mkdirSync(path.dirname(deployedWebDir), { recursive: true });
fs.cpSync(path.join(repoRoot, 'apps', 'web', 'dist'), deployedWebDir, { recursive: true });

const deployedSharedDir = path.join(payloadDir, 'packages', 'shared', 'dist');
fs.mkdirSync(path.dirname(deployedSharedDir), { recursive: true });
fs.cpSync(path.join(repoRoot, 'packages', 'shared', 'dist'), deployedSharedDir, { recursive: true });

// Cấp quyền thực thi cho các helper native (spawn-helper trong node-pty)
const ptyDir = path.join(deployedApiDir, 'node_modules', 'node-pty');
if (fs.existsSync(ptyDir)) {
  for (const sub of [
    path.join(ptyDir, 'build', 'Release', 'spawn-helper'),
    path.join(ptyDir, 'prebuilds', `darwin-${arch}`, 'spawn-helper'),
  ]) {
    if (fs.existsSync(sub)) {
      fs.chmodSync(sub, 0o755);
    }
  }
}

// 4. Đóng gói bằng @electron/packager
console.log('4. Chạy packager đóng gói Electron app...');
const packagerOptions = {
  dir: shellDir,
  out: outDir,
  overwrite: true,
  platform: 'darwin',
  arch,
  electronVersion: '41.1.0',
  appBundleId: 'com.hugtech.hugremote',
  name: 'HugRemote',
  asar: false,
  icon: path.join(desktopDir, 'resources', 'icon'),
  extraResource: [path.join(buildStage, 'payload', 'hugremote')],
  // Thiếu khoá này thì macOS (Local Network privacy, Big Sur+) không hỏi quyền và chặn thẳng mọi kết nối của app tới
  // IP mạng LAN (192.168.x.x…) — kết nối SSH tới máy trong cùng mạng sẽ báo "connect EHOSTUNREACH" dù `ssh` dòng lệnh
  // (process khác, đã có quyền) vẫn nối bình thường (dogfood 2026-11-27).
  extendInfo: {
    NSLocalNetworkUsageDescription: 'HugRemote cần truy cập mạng cục bộ (LAN) để nối SSH tới các máy trong cùng mạng với bạn.',
  },
};

const results = await packager(packagerOptions);
if (!results || results.length === 0) {
  throw new Error('Packager không tạo được kết quả');
}

const packagedFolder = results[0];
const appPath = path.join(packagedFolder, 'HugRemote.app');
if (!fs.existsSync(appPath)) {
  throw new Error(`Không tìm thấy ${appPath}`);
}

console.log(`Đã tạo app: ${appPath}`);

// 5. Chuẩn hoá symlink bên trong bundle (tránh lỗi invalid destination khi codesign)
console.log('5. Chuẩn hoá symlink và tài nguyên bên trong app bundle...');
const payloadInApp = path.join(appPath, 'Contents', 'Resources', 'hugremote');
const buildStagePayload = path.join(buildStage, 'payload', 'hugremote');

function normalizeSymlinks(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    let stat;
    try {
      stat = fs.lstatSync(full);
    } catch {
      continue;
    }
    if (stat.isSymbolicLink()) {
      const target = fs.readlinkSync(full);
      if (target.startsWith(buildStagePayload)) {
        const newTarget = target.replace(buildStagePayload, payloadInApp);
        const rel = path.relative(dir, newTarget);
        fs.unlinkSync(full);
        fs.symlinkSync(rel, full);
      }
    } else if (stat.isDirectory()) {
      normalizeSymlinks(full);
    }
  }
}
normalizeSymlinks(payloadInApp);

// Cập nhật Info.plist và tài nguyên icons
const resourcesDir = path.join(appPath, 'Contents', 'Resources');
for (const iconFile of ['HugRemote.icns', 'electron.icns', 'icon.icns']) {
  fs.copyFileSync(path.join(desktopDir, 'resources', 'icon.icns'), path.join(resourcesDir, iconFile));
}
fs.copyFileSync(path.join(desktopDir, 'resources', 'icon.png'), path.join(resourcesDir, 'icon.png'));

// UUID riêng cho file thực thi chính — Local Network privacy theo UUID, không theo bundle id (xem patchMachOUuid)
patchMachOUuid(path.join(appPath, 'Contents', 'MacOS', 'HugRemote'), 'com.hugtech.hugremote/v2');

// 6. Ký mã ad-hoc và xác thực chữ ký (AC-52)
console.log('6. Ký mã ad-hoc (codesign --sign - --force --deep)...');
signAndVerifyMacApp(appPath);
console.log('✓ Chữ ký ad-hoc hợp lệ!');

// 7. Tạo file .dmg và ký mã .dmg (AC-52)
console.log('7. Tạo bộ cài đặt .dmg...');
const dmgName = `HugRemote-macOS-${arch}.dmg`;
const dmgPath = path.join(outDir, dmgName);
buildMacDmg({
  appPath,
  dmgStageDir: path.join(buildStage, 'dmg-stage'),
  dmgPath,
  volumeName: 'HugRemote',
});

// Bản sao tên cố định — để ở out/, KHÔNG để trong dist/ (dist/ được chép vào app ở bước 1)
fs.rmSync(path.join(desktopDir, 'dist', 'HugRemote.dmg'), { force: true }); // dọn bản cũ còn sót từ script trước
const targetDistDmg = path.join(outDir, 'HugRemote.dmg');
fs.copyFileSync(dmgPath, targetDistDmg);
try {
  execFileSync('xattr', ['-cr', targetDistDmg]);
  execFileSync('codesign', ['--force', '--sign', '-', targetDistDmg]);
} catch {}

console.log('\n=========================================');
console.log('ĐÓNG GÓI MACOS HOÀN TẤT THÀNH CÔNG:');
console.log(`- Ứng dụng .app : ${appPath}`);
console.log(`- Tệp cài đặt .dmg: ${dmgPath}`);
console.log(`- Bản tên cố định : ${targetDistDmg}`);
console.log('=========================================\n');
