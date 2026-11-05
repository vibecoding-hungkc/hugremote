import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { findFreePort, launchBackend, waitForServer } from '../desktop/launcher.mjs';

if (process.platform !== 'darwin') throw new Error('macOS-only smoke test');
const repo = path.resolve(import.meta.dirname, '..');
const resources = path.join(repo, 'dist', 'macos-app', `HugRemote-darwin-${process.arch}`, 'HugRemote.app', 'Contents', 'Resources');
const runtime = path.join(resources, 'node', 'bin', 'node');
const cwd = path.join(resources, 'hugremote');
const backendEntry = path.join(cwd, 'apps', 'api', 'dist', 'main.js');
for (const file of [runtime, backendEntry, path.join(cwd, 'apps/api/public/index.html')]) assert.ok(fs.existsSync(file), `missing ${file}`);
const secret = crypto.randomBytes(32).toString('hex');
const port = await findFreePort();
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hugremote-macos-smoke-'));
const child = launchBackend({ runtime, backendEntry, cwd, port, secret, env: { ...process.env, HOME: home, AUTH_MODE: 'none' } });
let diagnostic = '';
for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk) => { diagnostic = (diagnostic + chunk.toString()).slice(-1000); });
try {
  await waitForServer({ port, secret, child });
  const url = `http://127.0.0.1:${port}`;
  assert.equal((await fetch(url)).status, 403);
  const headers = { cookie: `hugremote_desktop_session=${secret}` };
  const page = await fetch(url, { headers });
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<html/i);
  const api = await fetch(`${url}/api/servers`, { headers });
  assert.equal(api.status, 200);
  const serverList = await api.json();
  assert.ok(Array.isArray(serverList.servers), 'GET /api/servers must return a server list');
  const ptyOutput = execFileSync(runtime, ['-e', "const p=require('node-pty');const s=p.spawn('/bin/sh',['-c','printf PTY_READY'],{name:'xterm',cols:80,rows:24,cwd:process.cwd(),env:process.env});s.onData(d=>process.stdout.write(d));s.onExit(e=>process.exit(e.exitCode))"], { cwd, timeout: 10000 });
  assert.match(ptyOutput.toString(), /PTY_READY/);
  console.log('PASS bundled macOS Node, native PTY, HTTP UI and servers API');
} catch (error) {
  console.error('Bundled backend failed:', diagnostic);
  throw error;
} finally {
  if (child.exitCode === null && !child.killed) {
    const exited = new Promise((resolve) => child.once('exit', resolve));
    child.kill('SIGTERM');
    await exited;
  }
  fs.rmSync(home, { recursive: true, force: true });
}
