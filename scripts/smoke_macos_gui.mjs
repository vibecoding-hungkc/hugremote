import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

if (process.platform !== 'darwin') throw new Error('macOS-only GUI smoke test');
const app = path.resolve('dist', 'macos-app', `HugRemote-darwin-${process.arch}`, 'HugRemote.app');
const executable = path.join(app, 'Contents', 'MacOS', 'HugRemote');
assert.ok(fs.existsSync(executable), `Missing Electron executable: ${executable}`);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hugremote-mac-gui-'));
const marker = path.join(dir, 'ready');
const child = spawn(executable, [], {
  env: { ...process.env, HUGREMOTE_DESKTOP_SMOKE_FILE: marker, HOME: dir },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let diagnostics = '';
for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk) => { diagnostics = (diagnostics + chunk.toString()).slice(-1200); });
try {
  let exited = false;
  child.once('exit', () => { exited = true; });
  for (let i = 0; i < 240 && !fs.existsSync(marker) && !exited; i++) await delay(250);
  assert.ok(fs.existsSync(marker), `Electron window did not render: ${diagnostics}`);
  assert.equal(fs.readFileSync(marker, 'utf8').trim(), 'DESKTOP_GUI_READY');
  console.log('PASS packaged Electron app launches and renders Vue UI');
} finally {
  if (child.exitCode === null) child.kill('SIGTERM');
  fs.rmSync(dir, { recursive: true, force: true });
}
