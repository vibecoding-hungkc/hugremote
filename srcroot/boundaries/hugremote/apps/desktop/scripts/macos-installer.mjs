import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';

const MACHO_MAGICS = new Set([
  0xfeedfacf,
  0xcffaedfe,
  0xfeedface,
  0xcefaedfe,
  0xcafebabe,
  0xbebafeca,
]);

const defaultRun = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit' });

/**
 * Ghi đè LC_UUID của file Mach-O (thin 64-bit hoặc fat) bằng UUID suy từ `seed` — cố định qua mọi lần build.
 * macOS Local Network privacy nhận diện app theo Mach-O UUID của file thực thi chính (Apple TN3179). Binary Electron
 * dựng sẵn có UUID giống hệt nhau ở mọi app cùng phiên bản Electron (v1, app Electron khác…), nên quyết định cũ của
 * UUID đó bị dùng lại: app không bao giờ được hỏi quyền và bị chặn LAN im lặng (EHOSTUNREACH).
 * Phải chạy TRƯỚC khi ký. Trả số slice đã vá.
 */
export function patchMachOUuid(filePath, seed) {
  const buf = fs.readFileSync(filePath);
  const uuid = crypto.createHash('sha256').update(seed).digest().subarray(0, 16);
  uuid[6] = (uuid[6] & 0x0f) | 0x50; // RFC 4122 v5
  uuid[8] = (uuid[8] & 0x3f) | 0x80;
  const patchSlice = (off) => {
    if (buf.readUInt32LE(off) !== 0xfeedfacf) throw new Error(`Không phải Mach-O 64-bit tại offset ${off}`);
    const ncmds = buf.readUInt32LE(off + 16);
    let p = off + 32;
    for (let i = 0; i < ncmds; i++) {
      if (buf.readUInt32LE(p) === 0x1b) return uuid.copy(buf, p + 8), 1; // LC_UUID
      p += buf.readUInt32LE(p + 4);
    }
    throw new Error('Không thấy LC_UUID');
  };
  let n = 0;
  if (buf.readUInt32BE(0) === 0xcafebabe) {
    for (let i = 0, count = buf.readUInt32BE(4); i < count; i++) n += patchSlice(buf.readUInt32BE(8 + i * 20 + 8));
  } else n = patchSlice(0);
  fs.writeFileSync(filePath, buf);
  return n;
}

export function isMachOBinary(filePath) {
  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(4);
    const bytesRead = fs.readSync(fd, buf, 0, 4, 0);
    if (bytesRead < 4) return false;
    return MACHO_MAGICS.has(buf.readUInt32BE(0));
  } catch {
    return false;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

export function findNestedCodePaths(resourcesDir) {
  const found = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, entry);
      let stat;
      try {
        stat = fs.lstatSync(fullPath);
      } catch {
        continue;
      }
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!stat.isFile()) continue;
      const ext = path.extname(entry);
      const isCandidate =
        entry === 'node' ||
        entry === 'spawn-helper' ||
        ext === '.node' ||
        ext === '.dylib' ||
        ext === '.so';
      if (isCandidate && isMachOBinary(fullPath)) {
        found.push(fullPath);
      }
    }
  }
  walk(resourcesDir);
  return found.sort((a, b) => b.split(path.sep).length - a.split(path.sep).length);
}

export function signAndVerifyMacApp(appPath, run = defaultRun) {
  const resourcesDir = path.join(appPath, 'Contents', 'Resources');
  for (const binaryPath of findNestedCodePaths(resourcesDir)) {
    run('codesign', ['--force', '--sign', '-', binaryPath]);
  }
  run('codesign', [
    '--force',
    '--deep',
    '--preserve-metadata=entitlements,requirements,flags,runtime',
    '--sign',
    '-',
    appPath,
  ]);
  run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath]);
}

export function buildMacDmg({
  appPath,
  dmgStageDir,
  dmgPath,
  volumeName = 'HugRemote',
  run = defaultRun,
}) {
  fs.rmSync(dmgStageDir, { recursive: true, force: true });
  fs.mkdirSync(dmgStageDir, { recursive: true });
  fs.mkdirSync(path.dirname(dmgPath), { recursive: true });
  fs.rmSync(dmgPath, { force: true });
  run('ditto', [appPath, path.join(dmgStageDir, path.basename(appPath))]);
  fs.symlinkSync('/Applications', path.join(dmgStageDir, 'Applications'));
  run('hdiutil', [
    'create',
    '-fs',
    'HFS+',
    '-volname',
    volumeName,
    '-srcfolder',
    dmgStageDir,
    '-ov',
    '-format',
    'UDZO',
    dmgPath,
  ]);
  try {
    run('xattr', ['-cr', dmgPath]);
  } catch {}
  run('codesign', ['--force', '--sign', '-', dmgPath]);
  return dmgPath;
}
