import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launchBackend, terminateBackend } from '../desktop/launcher.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hugremote-desktop-group-'));
const childScript = path.join(dir, 'child.mjs');
const marker = path.join(dir, 'child-pid');
fs.writeFileSync(childScript, `import fs from 'node:fs'; import {spawn} from 'node:child_process'; const c=spawn('sleep',['30'],{stdio:'ignore'}); fs.writeFileSync(${JSON.stringify(marker)},String(c.pid)); setInterval(()=>{},1000);`);
const backend = launchBackend({ runtime: process.execPath, backendEntry: childScript, cwd: dir, port: 8388, secret: 'a'.repeat(64) });
let grandchildPid;
try {
  for (let i = 0; i < 80 && !fs.existsSync(marker); i++) await delay(50);
  assert.ok(fs.existsSync(marker), 'backend launched a descendant');
  grandchildPid = Number(fs.readFileSync(marker, 'utf8'));
  terminateBackend(backend);
  for (let i = 0; i < 80; i++) {
    try { process.kill(grandchildPid, 0); } catch (error) { if (error.code === 'ESRCH') break; throw error; }
    await delay(50);
  }
  assert.throws(() => process.kill(grandchildPid, 0), { code: 'ESRCH' }, 'closing app must terminate backend descendants');
  console.log('PASS desktop backend process group terminates descendants');
} finally {
  if (backend.exitCode === null) backend.kill('SIGKILL');
  if (grandchildPid) try { process.kill(grandchildPid, 'SIGKILL'); } catch {}
  fs.rmSync(dir, { recursive: true, force: true });
}
