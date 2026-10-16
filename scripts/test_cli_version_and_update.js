import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliPath = path.resolve(__dirname, '../bin/hugremote.js');

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

test('CLI update --help prints updater help and exits 0', () => {
  const res = spawnSync(process.execPath, [cliPath, 'update', '--help'], {
    encoding: 'utf8',
  });
  assert.equal(res.status, 0);
  assert.match(res.stdout, /HugRemote Updater/);
  assert.match(res.stdout, /--force/);
});

test('CLI update checks Git and runs safely without crashing', () => {
  const res = spawnSync(process.execPath, [cliPath, 'update'], {
    encoding: 'utf8',
  });
  assert.equal(res.status, 0);
  assert.match(res.stdout, /Kiểm tra và cập nhật HugRemote|phiên bản mới nhất/i);
});
