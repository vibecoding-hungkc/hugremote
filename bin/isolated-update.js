import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CANONICAL_REPOSITORY = 'https://github.com/vibecoding-hungkc/hugremote.git';
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/i;

function runFile(command, args, options = {}) {
  return execFileSync(command, args, { encoding: 'utf8', ...options });
}

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function defaultService(homeDir) {
  const dropInDir = path.join(homeDir, '.config', 'systemd', 'user', 'hugremote.service.d');
  const dropInFile = path.join(dropInDir, '20-hugremote-release.conf');
  return {
    isActive() {
      try {
        return runFile('systemctl', ['--user', 'is-active', 'hugremote.service']).trim() === 'active';
      } catch (_) {
        return false;
      }
    },
    getWorkingDirectory() {
      try {
        const value = runFile('systemctl', [
          '--user', 'show', 'hugremote.service', '--property=WorkingDirectory', '--value',
        ]).trim();
        return value || null;
      } catch (_) {
        return null;
      }
    },
    setWorkingDirectory(workingDirectory) {
      if (workingDirectory) {
        fs.mkdirSync(dropInDir, { recursive: true, mode: 0o700 });
        atomicFile(`[Service]\nWorkingDirectory=${workingDirectory}\n`, dropInFile, 0o600);
      } else {
        fs.rmSync(dropInFile, { force: true });
      }
      runFile('systemctl', ['--user', 'daemon-reload']);
    },
    restart() {
      runFile('systemctl', ['--user', 'restart', 'hugremote.service'], { stdio: 'inherit' });
    },
    waitUntilActive(timeoutMs) {
      const deadline = Date.now() + timeoutMs;
      do {
        if (this.isActive()) return true;
        sleep(Math.min(100, Math.max(1, deadline - Date.now())));
      } while (Date.now() < deadline);
      return this.isActive();
    },
  };
}

function ownerId() {
  return typeof process.getuid === 'function' ? process.getuid() : null;
}

function assertOwned(stat, target) {
  const uid = ownerId();
  if (uid !== null && stat.uid !== uid) throw new Error(`Unsafe path ownership: ${target}`);
}

function ensureOwnedDirectory(directory, root, label = 'directory') {
  const absoluteRoot = path.resolve(root);
  const absoluteDirectory = path.resolve(directory);
  if (absoluteDirectory !== absoluteRoot && !absoluteDirectory.startsWith(`${absoluteRoot}${path.sep}`)) {
    throw new Error(`Unsafe ${label} path outside home directory.`);
  }

  const rootStat = fs.lstatSync(absoluteRoot);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw new Error(`Unsafe symlink parent: ${absoluteRoot}`);
  assertOwned(rootStat, absoluteRoot);

  const relative = path.relative(absoluteRoot, absoluteDirectory);
  let current = absoluteRoot;
  for (const component of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    try {
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) throw new Error(`Unsafe symlink parent: ${current}`);
      if (!stat.isDirectory()) throw new Error(`${label} must be a directory: ${current}`);
      assertOwned(stat, current);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      fs.mkdirSync(current, { mode: 0o700 });
      assertOwned(fs.lstatSync(current), current);
    }
  }
}

function inspectManagedPath(target, allowedTypes, label) {
  try {
    const stat = fs.lstatSync(target);
    assertOwned(stat, target);
    const type = stat.isSymbolicLink() ? 'symlink'
      : stat.isFile() ? 'file'
        : stat.isDirectory() ? 'directory' : 'other';
    if (!allowedTypes.includes(type)) {
      const expected = allowedTypes.join(' or ');
      throw new Error(`${label} must be ${expected}: ${target}`);
    }
    return { type, stat, link: type === 'symlink' ? fs.readlinkSync(target) : null };
  } catch (error) {
    if (error.code === 'ENOENT') return { type: 'absent', stat: null, link: null };
    throw error;
  }
}

function atomicSymlink(target, linkPath) {
  const temporary = path.join(path.dirname(linkPath), `.${path.basename(linkPath)}.tmp-${process.pid}-${crypto.randomUUID()}`);
  try {
    fs.symlinkSync(target, temporary);
    fs.renameSync(temporary, linkPath);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function atomicFile(contents, filePath, mode = 0o600) {
  const temporary = path.join(path.dirname(filePath), `.${path.basename(filePath)}.tmp-${process.pid}-${crypto.randomUUID()}`);
  try {
    fs.writeFileSync(temporary, contents, { encoding: 'utf8', mode, flag: 'wx' });
    fs.renameSync(temporary, filePath);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function readLinkState(linkPath, label) {
  const state = inspectManagedPath(linkPath, ['symlink'], label);
  return state.type === 'absent' ? null : state.link;
}

function linkStateEquals(linkPath, expected) {
  try {
    const stat = fs.lstatSync(linkPath);
    return stat.isSymbolicLink() && fs.readlinkSync(linkPath) === expected;
  } catch (error) {
    return error.code === 'ENOENT' && expected === null;
  }
}

function restoreLink(linkPath, previousTarget) {
  if (previousTarget === null) fs.rmSync(linkPath, { force: true });
  else atomicSymlink(previousTarget, linkPath);
}

function readFileState(filePath, label) {
  const state = inspectManagedPath(filePath, ['file'], label);
  if (state.type === 'absent') return null;
  return { contents: fs.readFileSync(filePath), mode: state.stat.mode & 0o777 };
}

function restoreFile(filePath, previous) {
  if (previous === null) fs.rmSync(filePath, { force: true });
  else atomicFile(previous.contents, filePath, previous.mode);
}

function resolvedLink(linkPath) {
  try {
    const stat = fs.lstatSync(linkPath);
    if (!stat.isSymbolicLink()) return null;
    return path.resolve(path.dirname(linkPath), fs.readlinkSync(linkPath));
  } catch (_) {
    return null;
  }
}

function acquireLock(lockFile) {
  try {
    const fd = fs.openSync(lockFile, 'wx', 0o600);
    fs.writeFileSync(fd, `${process.pid}\n`, 'utf8');
    return fd;
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error('An isolated updater is already running.');
    throw error;
  }
}

function releaseLock(lockFile, fd) {
  try { fs.closeSync(fd); } finally { fs.rmSync(lockFile, { force: true }); }
}

function serviceMethod(service, name, fallback) {
  return typeof service[name] === 'function' ? service[name].bind(service) : fallback;
}

export function isolatedUpdatePaths(homeDir = os.homedir()) {
  const stateDir = path.join(homeDir, '.local', 'share', 'hugremote');
  const binDir = path.join(homeDir, '.local', 'bin');
  const cliLinks = {
    hugremote: path.join(binDir, 'hugremote'),
    hugcode: path.join(binDir, 'hugcode'),
  };
  return {
    stateDir,
    releasesDir: path.join(stateDir, 'releases'),
    currentLink: path.join(stateDir, 'current'),
    cliLink: cliLinks.hugremote,
    cliLinks,
    channelFile: path.join(stateDir, 'channel'),
    lockFile: path.join(stateDir, 'update.lock'),
  };
}

export function resolveCanonicalCommit({ channel, ref, repository = CANONICAL_REPOSITORY }) {
  if (!['stable', 'beta'].includes(channel)) throw new Error('Kênh update không hợp lệ.');
  if (channel === 'stable' && !/^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(ref)) {
    throw new Error('Release ref không hợp lệ.');
  }
  if (channel === 'beta' && ref !== 'main') throw new Error('Beta ref phải là main.');
  const patterns = channel === 'stable' ? [`refs/tags/${ref}`, `refs/tags/${ref}^{}`] : ['refs/heads/main'];
  const output = runFile('git', ['ls-remote', '--quiet', repository, ...patterns]).trim();
  const lines = output.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const peeled = lines.find(l => l.endsWith(`refs/tags/${ref}^{}`));
  if (peeled) return peeled.split(/\s+/)[0];
  const direct = lines.find(l => channel === 'stable' ? l.endsWith(`refs/tags/${ref}`) : l.endsWith('refs/heads/main'));
  if (direct) return direct.split(/\s+/)[0];
  throw new Error(`Không tìm thấy commit cho ${channel} ref ${ref} trên repository chính thức.`);
}

export function installIsolatedRelease({
  sourceRoot,
  ref,
  channel,
  expectedCommit,
  homeDir = os.homedir(),
  service: suppliedService,
  healthTimeoutMs = 15_000,
}) {
  if (!['stable', 'beta'].includes(channel)) throw new Error('Kênh update không hợp lệ.');
  if (channel === 'stable' && !/^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(ref)) {
    throw new Error('Release ref không hợp lệ.');
  }
  if (channel === 'beta' && ref !== 'main') throw new Error('Beta ref phải là main.');
  let targetExpectedCommit = expectedCommit;
  if (!targetExpectedCommit) {
    targetExpectedCommit = resolveCanonicalCommit({ channel, ref });
  }
  if (!COMMIT_PATTERN.test(targetExpectedCommit || '')) throw new Error('expectedCommit must be an exact 40-character commit ID.');
  if (!Number.isFinite(healthTimeoutMs) || healthTimeoutMs < 1) throw new Error('healthTimeoutMs must be positive.');

  const canonicalExpectedCommit = targetExpectedCommit.toLowerCase();
  const paths = isolatedUpdatePaths(homeDir);
  const service = suppliedService || defaultService(homeDir);

  ensureOwnedDirectory(paths.stateDir, homeDir, 'state directory');
  ensureOwnedDirectory(paths.releasesDir, homeDir, 'releases directory');
  ensureOwnedDirectory(path.dirname(paths.cliLinks.hugremote), homeDir, 'CLI parent directory');
  inspectManagedPath(paths.releasesDir, ['directory'], 'releases directory');
  const previousCurrentRaw = readLinkState(paths.currentLink, 'current generation');
  const previousCli = Object.fromEntries(Object.entries(paths.cliLinks).map(([name, link]) => [name, readLinkState(link, `CLI ${name} symlink`)]));
  const previousChannel = readFileState(paths.channelFile, 'channel file');

  const lockFd = acquireLock(paths.lockFile);
  const staging = path.join(paths.stateDir, `.staging-${crypto.randomUUID()}`);
  let releaseDir = null;
  let currentCommitted = false;
  const changedCli = new Set();
  let channelChanged = false;
  let workingDirectoryChanged = false;
  let originalError = null;

  const isActive = serviceMethod(service, 'isActive', () => false);
  const getWorkingDirectory = serviceMethod(service, 'getWorkingDirectory', () => null);
  const setWorkingDirectory = serviceMethod(service, 'setWorkingDirectory', () => {});
  const restart = serviceMethod(service, 'restart', () => {});
  const waitUntilActive = serviceMethod(service, 'waitUntilActive', () => isActive());

  let serviceWasActive = false;
  let previousWorkingDirectory = null;

  try {
    // These snapshots intentionally happen while the lock is held and before clone/build lifecycle execution.
    serviceWasActive = isActive();
    previousWorkingDirectory = getWorkingDirectory();

    runFile('git', ['clone', '--quiet', '--no-checkout', CANONICAL_REPOSITORY, staging], { stdio: 'inherit' });
    const targetRef = channel === 'stable' ? `refs/tags/${ref}^{commit}` : 'refs/remotes/origin/main^{commit}';
    const resolvedCommit = runFile('git', ['rev-parse', '--verify', targetRef], { cwd: staging }).trim().toLowerCase();
    if (resolvedCommit !== canonicalExpectedCommit) {
      throw new Error(`Canonical ref does not match expected commit ${canonicalExpectedCommit}.`);
    }

    runFile('git', ['checkout', '--quiet', '--detach', canonicalExpectedCommit], { cwd: staging, stdio: 'inherit' });
    const commit = runFile('git', ['rev-parse', 'HEAD'], { cwd: staging }).trim().toLowerCase();
    if (commit !== canonicalExpectedCommit) throw new Error('Checked-out HEAD does not match expected commit exactly.');

    const manifest = JSON.parse(fs.readFileSync(path.join(staging, 'package.json'), 'utf8'));
    const version = String(manifest.version || '');
    if (!VERSION_PATTERN.test(version)) throw new Error('Version release không hợp lệ.');
    if (channel === 'stable' && version !== ref.replace(/^v/, '')) {
      throw new Error(`Tag ${ref} không khớp package version ${version}.`);
    }

    runFile('npm', ['ci', '--foreground-scripts'], { cwd: staging, stdio: 'inherit' });
    runFile('npm', ['run', 'build'], { cwd: staging, stdio: 'inherit' });
    const reported = runFile(process.execPath, ['bin/hugremote.js', '--version'], { cwd: staging }).trim();
    if (reported !== `HugRemote v${version}`) throw new Error(`Version probe thất bại: ${reported}`);

    releaseDir = path.join(paths.releasesDir, `${version}-${commit.slice(0, 12)}-${crypto.randomUUID()}`);
    fs.renameSync(staging, releaseDir);

    const cliTarget = path.join(paths.currentLink, 'bin', 'hugremote.js');
    for (const [name, link] of Object.entries(paths.cliLinks)) {
      changedCli.add(name);
      atomicSymlink(cliTarget, link);
    }
    channelChanged = true;
    atomicFile(`${channel}\n`, paths.channelFile);

    if (previousWorkingDirectory !== paths.currentLink) {
      // Arm rollback before invoking an abstraction that can mutate and then throw.
      workingDirectoryChanged = true;
      setWorkingDirectory(paths.currentLink);
    }

    // The only generation commit point. CAS prevents a concurrent/non-cooperating winner being lost.
    if (!linkStateEquals(paths.currentLink, previousCurrentRaw)) {
      throw new Error('Current generation changed during update; refusing to overwrite concurrent winner.');
    }
    atomicSymlink(releaseDir, paths.currentLink);
    currentCommitted = true;

    if (serviceWasActive) {
      restart();
      if (!waitUntilActive(healthTimeoutMs)) throw new Error('Service is not active after release restart.');
    }

    return { releaseDir, version, commit, serviceRestarted: serviceWasActive };
  } catch (error) {
    originalError = error;
    const rollbackErrors = [];

    if (currentCommitted) {
      const ours = resolvedLink(paths.currentLink) === releaseDir;
      if (ours) {
        try { restoreLink(paths.currentLink, previousCurrentRaw); } catch (rollbackError) { rollbackErrors.push(rollbackError); }
      } else {
        rollbackErrors.push(new Error('Current generation changed again; rollback did not overwrite it.'));
      }
    }
    if (channelChanged) {
      try { restoreFile(paths.channelFile, previousChannel); } catch (rollbackError) { rollbackErrors.push(rollbackError); }
    }
    for (const name of [...changedCli].reverse()) {
      try { restoreLink(paths.cliLinks[name], previousCli[name]); } catch (rollbackError) { rollbackErrors.push(rollbackError); }
    }
    if (workingDirectoryChanged) {
      try { setWorkingDirectory(previousWorkingDirectory); } catch (rollbackError) { rollbackErrors.push(rollbackError); }
    }

    if (serviceWasActive && (currentCommitted || workingDirectoryChanged)) {
      try {
        restart();
        if (!waitUntilActive(healthTimeoutMs)) throw new Error('Service is not active after rollback restart.');
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }

    if (releaseDir && resolvedLink(paths.currentLink) !== releaseDir) {
      try { fs.rmSync(releaseDir, { recursive: true, force: true }); } catch (rollbackError) { rollbackErrors.push(rollbackError); }
    }

    if (rollbackErrors.length) {
      throw new AggregateError([error, ...rollbackErrors], `${error.message} Rollback failed: ${rollbackErrors.map(item => item.message).join('; ')}`);
    }
    throw error;
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
    releaseLock(paths.lockFile, lockFd);
    void originalError;
  }
}
