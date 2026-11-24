import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const MACHO_MAGICS = new Set([
  0xfeedfacf,
  0xcffaedfe,
  0xfeedface,
  0xcefaedfe,
  0xcafebabe,
  0xbebafeca,
]);

const defaultRun = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit' });

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
