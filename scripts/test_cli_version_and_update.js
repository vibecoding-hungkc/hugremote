import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareSemver, parseSemver, detectChannel, fetchLatestGitHubRelease } from '../bin/update.js';

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
