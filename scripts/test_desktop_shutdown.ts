import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { createApp } from '../apps/api/src/app.js';
import { sessionManager } from '../apps/api/src/services/sessionManager.js';

// Desktop shutdown must close real terminal children, not merely its HTTP listener.
process.env.HUGREMOTE_DESKTOP_SECRET = 'c'.repeat(64);
process.env.AUTH_MODE = 'none';
const app = await createApp();
const child = spawn('sleep', ['30']);
const fakeSessionId = 'desktop-shutdown-test';
let killed = false;
(sessionManager as any).sessions.set(fakeSessionId, {
  id: fakeSessionId, clients: new Set(), backend: { kill() { killed = true; child.kill('SIGTERM'); } },
});
try {
  await app.close();
  assert.ok(killed, 'app.close() must stop the active terminal session');
  await delay(50);
  assert.ok(child.exitCode !== null || child.signalCode !== null, 'terminal subprocess must exit');
  console.log('PASS desktop shutdown closes terminal sessions');
} finally {
  child.kill('SIGKILL');
  await app.close();
}
