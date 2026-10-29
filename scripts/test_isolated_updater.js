import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync, lstatSync, mkdtempSync, mkdirSync, readFileSync, readlinkSync,
  readdirSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { installIsolatedRelease, isolatedUpdatePaths } from '../bin/isolated-update.js';

const CANONICAL_REPOSITORY = 'https://github.com/vibecoding-hungkc/hugremote.git';

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function fixture({ buildSource } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'hugremote-isolated-update-'));
  const source = path.join(root, 'source');
  const remote = path.join(root, 'canonical.git');
  const malicious = path.join(root, 'malicious.git');
  const install = path.join(root, 'install');
  const home = path.join(root, 'home');
  mkdirSync(source, { recursive: true });
  mkdirSync(home, { recursive: true });
  git(source, 'init', '-q');
  git(source, 'config', 'user.name', 'fixture');
  git(source, 'config', 'user.email', 'fixture@example.invalid');
  git(source, 'branch', '-M', 'main');
  writeFileSync(path.join(source, 'package.json'), JSON.stringify({
    name: 'fixture', version: '1.0.0', type: 'module',
    scripts: { build: 'node build.js' },
  }, null, 2));
  writeFileSync(path.join(source, 'package-lock.json'), JSON.stringify({
    name: 'fixture', version: '1.0.0', lockfileVersion: 3, requires: true,
    packages: { '': { name: 'fixture', version: '1.0.0' } },
  }, null, 2));
  writeFileSync(path.join(source, 'build.js'), buildSource || "import fs from 'node:fs'; fs.writeFileSync('built.txt', 'trusted\\n');\n");
  mkdirSync(path.join(source, 'bin'));
  writeFileSync(path.join(source, 'bin', 'hugremote.js'), "#!/usr/bin/env node\nconsole.log('HugRemote v1.0.0');\n");
  git(source, 'add', '.');
  git(source, 'commit', '-qm', 'release');
  const commit = git(source, 'rev-parse', 'HEAD');
  git(source, 'tag', 'v1.0.0');
  execFileSync('git', ['clone', '--bare', source, remote]);

  const evilSource = path.join(root, 'evil-source');
  execFileSync('git', ['clone', '-q', source, evilSource]);
  git(evilSource, 'config', 'user.name', 'fixture');
  git(evilSource, 'config', 'user.email', 'fixture@example.invalid');
  writeFileSync(path.join(evilSource, 'build.js'), "import fs from 'node:fs'; fs.writeFileSync('built.txt', 'evil\\n');\n");
  git(evilSource, 'add', '.');
  git(evilSource, 'commit', '-qm', 'evil');
  git(evilSource, 'tag', '-f', 'v1.0.0');
  execFileSync('git', ['clone', '--bare', evilSource, malicious]);
  execFileSync('git', ['clone', '-q', malicious, install]);

  return { root, source, remote, malicious, install, home, commit };
}

function withCanonicalMirror(remote, callback) {
  const oldCount = process.env.GIT_CONFIG_COUNT;
  const oldKey = process.env.GIT_CONFIG_KEY_0;
  const oldValue = process.env.GIT_CONFIG_VALUE_0;
  process.env.GIT_CONFIG_COUNT = '1';
  process.env.GIT_CONFIG_KEY_0 = `url.${remote}/.insteadOf`;
  process.env.GIT_CONFIG_VALUE_0 = CANONICAL_REPOSITORY;
  try { return callback(); } finally {
    if (oldCount === undefined) delete process.env.GIT_CONFIG_COUNT; else process.env.GIT_CONFIG_COUNT = oldCount;
    if (oldKey === undefined) delete process.env.GIT_CONFIG_KEY_0; else process.env.GIT_CONFIG_KEY_0 = oldKey;
    if (oldValue === undefined) delete process.env.GIT_CONFIG_VALUE_0; else process.env.GIT_CONFIG_VALUE_0 = oldValue;
  }
}

function inactiveService(overrides = {}) {
  return {
    isActive: () => false,
    getWorkingDirectory: () => null,
    setWorkingDirectory: () => {},
    restart: () => {},
    waitUntilActive: () => true,
    ...overrides,
  };
}

function install(f, overrides = {}) {
  return withCanonicalMirror(f.remote, () => installIsolatedRelease({
    sourceRoot: f.install,
    ref: 'v1.0.0',
    channel: 'stable',
    expectedCommit: f.commit,
    homeDir: f.home,
    service: inactiveService(),
    healthTimeoutMs: 25,
    ...overrides,
  }));
}

function treeSnapshot(root) {
  const result = [];
  function walk(current, relative = '') {
    for (const name of readdirSync(current).sort()) {
      const absolute = path.join(current, name);
      const rel = path.join(relative, name);
      const stat = lstatSync(absolute);
      if (stat.isSymbolicLink()) result.push([rel, 'link', readlinkSync(absolute)]);
      else if (stat.isDirectory()) { result.push([rel, 'dir', stat.mode]); walk(absolute, rel); }
      else result.push([rel, 'file', stat.mode, readFileSync(absolute).toString('base64')]);
    }
  }
  walk(root);
  return result;
}

function seedPrevious(home) {
  const paths = isolatedUpdatePaths(home);
  const previous = path.join(home, 'previous-release');
  mkdirSync(path.join(previous, 'bin'), { recursive: true });
  writeFileSync(path.join(previous, 'bin', 'hugremote.js'), 'old\n');
  mkdirSync(path.dirname(paths.currentLink), { recursive: true });
  mkdirSync(path.dirname(paths.cliLinks.hugremote), { recursive: true });
  symlinkSync(previous, paths.currentLink);
  symlinkSync(path.join(paths.currentLink, 'bin', 'hugremote.js'), paths.cliLinks.hugremote);
  symlinkSync(path.join(paths.currentLink, 'bin', 'hugremote.js'), paths.cliLinks.hugcode);
  writeFileSync(paths.channelFile, 'beta\n');
  return { paths, previous };
}

test('pins the canonical repository, verifies expected commit, and preserves sourceRoot byte-for-byte', () => {
  const f = fixture();
  writeFileSync(path.join(f.install, 'package-lock.json'), `${readFileSync(path.join(f.install, 'package-lock.json'), 'utf8')}\nlocal-change\n`);
  writeFileSync(path.join(f.install, '.gitconfig'), 'local config\n');
  const before = treeSnapshot(f.install);

  const result = install(f);

  assert.equal(result.commit, f.commit);
  assert.deepEqual(treeSnapshot(f.install), before);
  assert.equal(readFileSync(path.join(result.releaseDir, 'built.txt'), 'utf8'), 'trusted\n');
});

test('rejects a commit mismatch before executing lifecycle scripts', () => {
  const marker = path.join(tmpdir(), `hugremote-untrusted-${process.pid}-${Date.now()}`);
  const f = fixture({ buildSource: `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(marker)}, 'ran');\n` });
  try {
    assert.throws(() => install(f, { expectedCommit: '0'.repeat(40) }), /expected commit/i);
    assert.equal(existsSync(marker), false);
  } finally { rmSync(marker, { force: true }); }
});

test('beta is pinned to canonical main and exact expected commit', () => {
  const f = fixture();
  const result = install(f, { ref: 'main', channel: 'beta' });
  assert.equal(result.commit, f.commit);
  assert.equal(readFileSync(path.join(result.releaseDir, 'built.txt'), 'utf8'), 'trusted\n');
});

test('rejects regular CLI files without overwriting either alias', () => {
  for (const alias of ['hugremote', 'hugcode']) {
    const f = fixture();
    const paths = isolatedUpdatePaths(f.home);
    mkdirSync(path.dirname(paths.cliLinks[alias]), { recursive: true });
    writeFileSync(paths.cliLinks[alias], 'owned by user\n');
    assert.throws(() => install(f), /CLI.*symlink/i);
    assert.equal(readFileSync(paths.cliLinks[alias], 'utf8'), 'owned by user\n');
  }
});

test('rejects unsafe symlink parents and wrong managed path types', () => {
  const f = fixture();
  const outside = path.join(f.root, 'outside');
  mkdirSync(outside);
  symlinkSync(outside, path.join(f.home, '.local'));
  assert.throws(() => install(f), /symlink parent/i);
  assert.deepEqual(readdirSync(outside), []);

  const g = fixture();
  const paths = isolatedUpdatePaths(g.home);
  mkdirSync(paths.stateDir, { recursive: true });
  writeFileSync(paths.releasesDir, 'not a directory');
  assert.throws(() => install(g), /releases.*directory/i);
});

test('exclusive lock rejects a concurrent updater before cloning', () => {
  const f = fixture();
  const paths = isolatedUpdatePaths(f.home);
  mkdirSync(paths.stateDir, { recursive: true });
  writeFileSync(paths.lockFile, 'other updater\n');
  assert.throws(() => install(f), /already running/i);
  assert.equal(readdirSync(paths.releasesDir).length, 0);
});

test('current-generation CAS never overwrites a concurrent winner', () => {
  const f = fixture({ buildSource: `
    import fs from 'node:fs';
    fs.mkdirSync(process.env.TEST_CURRENT_PARENT, { recursive: true });
    try { fs.unlinkSync(process.env.TEST_CURRENT_LINK); } catch {}
    fs.symlinkSync(process.env.TEST_CAS_WINNER, process.env.TEST_CURRENT_LINK);
    fs.writeFileSync('built.txt', 'trusted\\n');
  ` });
  const paths = isolatedUpdatePaths(f.home);
  const winner = path.join(f.home, 'winner');
  mkdirSync(winner);
  const old = {
    TEST_CURRENT_PARENT: process.env.TEST_CURRENT_PARENT,
    TEST_CURRENT_LINK: process.env.TEST_CURRENT_LINK,
    TEST_CAS_WINNER: process.env.TEST_CAS_WINNER,
  };
  process.env.TEST_CURRENT_PARENT = path.dirname(paths.currentLink);
  process.env.TEST_CURRENT_LINK = paths.currentLink;
  process.env.TEST_CAS_WINNER = winner;
  try {
    assert.throws(() => install(f), /current generation changed/i);
    assert.equal(path.resolve(path.dirname(paths.currentLink), readlinkSync(paths.currentLink)), winner);
  } finally {
    for (const [key, value] of Object.entries(old)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('switches both aliases through current and migrates service working directory', () => {
  const f = fixture();
  const calls = [];
  const result = install(f, { service: inactiveService({
    getWorkingDirectory: () => '/legacy/checkout',
    setWorkingDirectory: value => calls.push(value),
  }) });
  const paths = isolatedUpdatePaths(f.home);
  assert.equal(path.resolve(path.dirname(paths.currentLink), readlinkSync(paths.currentLink)), result.releaseDir);
  for (const link of Object.values(paths.cliLinks)) {
    assert.equal(path.resolve(path.dirname(link), readlinkSync(link)), path.join(paths.currentLink, 'bin', 'hugremote.js'));
  }
  assert.deepEqual(calls, [paths.currentLink]);
});

test('rolls back aliases, channel, working directory, current, and new generation on partial switch', () => {
  const f = fixture();
  const { paths, previous } = seedPrevious(f.home);
  assert.throws(() => install(f, { service: inactiveService({
    getWorkingDirectory: () => '/legacy/checkout',
    setWorkingDirectory: value => { if (value === paths.currentLink) throw new Error('migration failed'); },
  }) }), /migration failed/);

  assert.equal(path.resolve(path.dirname(paths.currentLink), readlinkSync(paths.currentLink)), previous);
  assert.equal(readFileSync(paths.channelFile, 'utf8'), 'beta\n');
  for (const link of Object.values(paths.cliLinks)) assert.ok(lstatSync(link).isSymbolicLink());
  assert.deepEqual(readdirSync(paths.releasesDir), []);
});

test('snapshots service activity before build and uses bounded health checks after restart and rollback', () => {
  const marker = path.join(tmpdir(), `hugremote-build-${process.pid}-${Date.now()}`);
  const f = fixture({ buildSource: `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(marker)}, 'built'); fs.writeFileSync('built.txt', 'trusted\\n');\n` });
  const { paths, previous } = seedPrevious(f.home);
  const events = [];
  let healthCalls = 0;
  const service = inactiveService({
    isActive: () => { events.push(existsSync(marker) ? 'sample-after-build' : 'sample-before-build'); return true; },
    getWorkingDirectory: () => '/legacy/checkout',
    setWorkingDirectory: value => events.push(`wd:${value}`),
    restart: () => events.push('restart'),
    waitUntilActive: timeout => { events.push(`health:${timeout}`); healthCalls += 1; return healthCalls > 1; },
  });
  try {
    assert.throws(() => install(f, { service, healthTimeoutMs: 25 }), /not active/i);
    assert.equal(events[0], 'sample-before-build');
    assert.equal(events.filter(value => value === 'health:25').length, 2);
    assert.ok(events.includes('wd:/legacy/checkout'));
    assert.equal(path.resolve(path.dirname(paths.currentLink), readlinkSync(paths.currentLink)), previous);
    assert.deepEqual(readdirSync(paths.releasesDir), []);
  } finally { rmSync(marker, { force: true }); }
});

test('rolls back a service migration that mutates state before throwing', () => {
  const f = fixture();
  const { paths, previous } = seedPrevious(f.home);
  let workingDirectory = '/legacy/checkout';
  assert.throws(() => install(f, { service: inactiveService({
    getWorkingDirectory: () => workingDirectory,
    setWorkingDirectory: value => {
      workingDirectory = value;
      if (value === paths.currentLink) throw new Error('partial migration');
    },
  }) }), /partial migration/);
  assert.equal(workingDirectory, '/legacy/checkout');
  assert.equal(path.resolve(path.dirname(paths.currentLink), readlinkSync(paths.currentLink)), previous);
});

test('releases the updater lock when the pre-update service snapshot fails', () => {
  const f = fixture();
  const paths = isolatedUpdatePaths(f.home);
  assert.throws(() => install(f, { service: inactiveService({
    isActive: () => { throw new Error('snapshot failed'); },
  }) }), /snapshot failed/);
  assert.equal(existsSync(paths.lockFile), false);
});

test('same release installs to unique immutable generations without deleting the active generation', () => {
  const f = fixture();
  const first = install(f);
  const firstBytes = readFileSync(path.join(first.releaseDir, 'built.txt'));
  const second = install(f);
  assert.notEqual(second.releaseDir, first.releaseDir);
  assert.equal(existsSync(first.releaseDir), true);
  assert.deepEqual(readFileSync(path.join(first.releaseDir, 'built.txt')), firstBytes);
});
