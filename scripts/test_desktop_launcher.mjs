import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { findFreePort, waitForServer, launchBackend } from '../desktop/launcher.mjs';

const port = await findFreePort();
assert.ok(port > 0 && port < 65536);
console.log('PASS desktop launcher picks a loopback port');

const secret = 'b'.repeat(64);
const child = launchBackend({
  runtime: process.execPath,
  backendEntry: new URL('../apps/api/dist/main.js', import.meta.url).pathname,
  cwd: new URL('../', import.meta.url).pathname,
  port,
  secret,
  env: { ...process.env, AUTH_MODE: 'none' },
});
let backendOutput = '';
child.stderr.on('data', (chunk) => { backendOutput += chunk.toString().slice(0, 500); });
child.stdout.on('data', (chunk) => { backendOutput += chunk.toString().slice(0, 500); });
try {
  await waitForServer({ port, secret, child, timeoutMs: 10000 });
  const noCookie = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(noCookie.status, 403);
  const withCookie = await fetch(`http://127.0.0.1:${port}/`, { headers: { cookie: `hugremote_desktop_session=${secret}` } });
  assert.equal(withCookie.status, 200);
  console.log('PASS desktop backend launches, requires secret cookie, serves UI');
} catch (error) {
  console.error('Backend startup diagnostic:', backendOutput.slice(0, 1200));
  throw error;
} finally {
  if (child.exitCode === null && !child.killed) {
    const exited = new Promise((resolve) => child.once('exit', resolve));
    child.kill('SIGTERM');
    await exited;
  }
}
await assert.rejects(() => waitForServer({ port, secret, child: new EventEmitter(), timeoutMs: 200 }), /timeout/i);
console.log('PASS dead backend fails readiness');
