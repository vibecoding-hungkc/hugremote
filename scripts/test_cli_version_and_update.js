import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, execSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  compareSemver,
  parseSemver,
  detectChannel,
  fetchLatestGitHubRelease,
  installProjectDependencies,
  stashLocalChanges,
  restoreLocalChanges,
  assertSafeReleaseTag,
  assertBetaUpdateBranch,
} from '../bin/update.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliPath = path.resolve(__dirname, '../bin/hugremote.js');
const rootDir = path.resolve(__dirname, '..');

test('CLI --version, -v, and mobile dash variations print version and exit 0', () => {
  const variations = ['--version', '-v', '-V', 'version', '—version', '–version', '—v'];
  for (const flag of variations) {
    const res = spawnSync(process.execPath, [cliPath, flag], {
      encoding: 'utf8',
    });
    assert.equal(res.status, 0, `Failed for flag: ${flag}`);
    assert.match(res.stdout, /HugRemote v\d+\.\d+\.\d+/, `Output mismatch for ${flag}: ${res.stdout}`);
  }
});

test('compareSemver accurately sorts semver versions', () => {
  assert.equal(compareSemver('v1.0.1', 'v1.0.2') < 0, true);
  assert.equal(compareSemver('v1.0.10', 'v1.0.2') > 0, true);
  assert.equal(compareSemver('v1.1.0', 'v1.0.9') > 0, true);
  assert.equal(compareSemver('v2.0.0', 'v1.9.9') > 0, true);
  assert.equal(compareSemver('v1.0.0', 'v1.0.0') === 0, true);
});

test('detectChannel prioritizes CLI flags, env, and .channel file', () => {
  assert.equal(detectChannel(rootDir, ['--stable']), 'stable');
  assert.equal(detectChannel(rootDir, ['--beta']), 'beta');
  assert.equal(detectChannel(rootDir, ['--release']), 'stable');
  assert.equal(detectChannel(rootDir, ['--main']), 'beta');
});

test('fetchLatestGitHubRelease retrieves official release metadata', async () => {
  const release = await fetchLatestGitHubRelease('vibecoding-hungkc/hugremote');
  assert.ok(release, 'Release object should not be null');
  assert.match(release.tag, /^v\d+\.\d+\.\d+/, 'Release tag must be semver formatted');
});

test('CLI update --help prints updater help and exits 0', () => {
  const res = spawnSync(process.execPath, [cliPath, 'update', '--help'], {
    encoding: 'utf8',
  });
  assert.equal(res.status, 0);
  assert.match(res.stdout, /HugRemote Updater/);
  assert.match(res.stdout, /--stable/);
  assert.match(res.stdout, /--beta/);
});

test('CLI update --stable detects release channel', () => {
  const res = spawnSync(process.execPath, [cliPath, 'update', '--stable', '--dry-run'], {
    encoding: 'utf8',
  });
  assert.equal(res.status, 0);
  assert.match(res.stdout, /Release chính thức/i);
});

test('CLI update --beta detects main branch channel', () => {
  const res = spawnSync(process.execPath, [cliPath, 'update', '--beta', '--dry-run'], {
    encoding: 'utf8',
  });
  assert.equal(res.status, 0);
  assert.match(res.stdout, /Nhánh main/i);
});

test('updater installs the checked-out lockfile dependencies before build', () => {
  const commands = [];
  installProjectDependencies('/tmp/hugremote-update-fixture', (command, options) => {
    commands.push({ command, options });
  });
  assert.deepEqual(commands.map(item => item.command), ['npm install --foreground-scripts']);
  assert.equal(commands[0].options.cwd, '/tmp/hugremote-update-fixture');
  assert.equal(commands[0].options.stdio, 'inherit');
});

test('updater identifies its exact backup by unique marker despite an intervening stash', () => {
  const commands = [];
  const backup = 'a'.repeat(40);
  const intervening = 'b'.repeat(40);
  const marker = 'race-proof-marker';
  const run = (command, options) => {
    commands.push({ command, options });
    if (command === 'git status --porcelain') return ' M package-lock.json\n?? .gitconfig\n?? merge_assets.cjs\n';
    if (command === 'git stash list --format="%H%x00%gs"') {
      return `${intervening}\u0000On main: other-process\n${backup}\u0000On main: hugremote-update-backup-${marker}\n`;
    }
    return '';
  };

  assert.equal(stashLocalChanges('/tmp/hugremote-update-fixture', run, () => marker), backup);
  restoreLocalChanges('/tmp/hugremote-update-fixture', backup, run);
  assert.deepEqual(commands.map(item => item.command), [
    'git status --porcelain',
    `git stash push --include-untracked -m "hugremote-update-backup-${marker}"`,
    'git stash list --format="%H%x00%gs"',
    `git stash apply --index ${backup}`,
  ]);
  assert.equal(commands.some(item => item.command.startsWith('git stash drop')), false);
});

test('Beta update rejects a non-main branch instead of moving local changes', () => {
  assert.equal(assertBetaUpdateBranch('main'), 'main');
  assert.throws(() => assertBetaUpdateBranch('feature/local-work'), /chỉ cập nhật.*main/i);
});

test('release tags accept semver only and reject shell metacharacters', () => {
  assert.equal(assertSafeReleaseTag('v1.6.1'), 'v1.6.1');
  assert.equal(assertSafeReleaseTag('1.6.1-rc.1+build.7'), '1.6.1-rc.1+build.7');
  for (const tag of ['v1.6.1;touch /tmp/pwned', 'v1.6.1$(id)', 'release/latest', '']) {
    assert.throws(() => assertSafeReleaseTag(tag), /không hợp lệ/);
  }
});

test('real git restore preserves exact stash, index, untracked files, and intervening stash', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'hugremote-updater-git-'));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  git('init', '-q');
  git('config', 'user.name', 'fixture');
  git('config', 'user.email', 'fixture@example.invalid');
  writeFileSync(path.join(root, 'tracked.txt'), 'base\n');
  git('add', 'tracked.txt');
  git('commit', '-qm', 'base');

  writeFileSync(path.join(root, 'tracked.txt'), 'staged\n');
  git('add', 'tracked.txt');
  writeFileSync(path.join(root, 'tracked.txt'), 'staged\nunstaged\n');
  writeFileSync(path.join(root, 'local.txt'), 'local\n');
  const backup = stashLocalChanges(root);
  assert.match(backup, /^[0-9a-f]{40}$/);

  writeFileSync(path.join(root, 'intervening.txt'), 'intervening\n');
  git('stash', 'push', '--include-untracked', '-m', 'intervening');
  restoreLocalChanges(root, backup);

  assert.equal(readFileSync(path.join(root, 'tracked.txt'), 'utf8'), 'staged\nunstaged\n');
  assert.equal(readFileSync(path.join(root, 'local.txt'), 'utf8'), 'local\n');
  assert.equal(git('status', '--short'), 'MM tracked.txt\n?? local.txt');
  const stashList = git('stash', 'list');
  assert.match(stashList, /intervening/);
  assert.match(stashList, /hugremote-update-backup/);
});
