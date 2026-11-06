import net from 'node:net';
import { spawn } from 'node:child_process';
import { dirname } from 'node:path';

export async function findFreePort() {
  const server = net.createServer();
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    return server.address().port;
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

export function launchBackend({ runtime, backendEntry, cwd, port, secret, env = process.env }) {
  if (!/^[a-f0-9]{64}$/.test(secret)) throw new Error('Invalid desktop launch secret');
  return spawn(runtime, [backendEntry], {
    cwd,
    env: {
      ...env,
      HOST: '127.0.0.1',
      PORT: String(port),
      BASE_PATH: '',
      AUTH_MODE: 'none',
      HUGREMOTE_DESKTOP_SECRET: secret,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
}

export function terminateBackend(child) {
  if (!child?.pid) return;
  // The backend owns a separate process group; terminate its PTY/CLI children too.
  try { process.kill(-child.pid, 'SIGTERM'); } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
  const timeout = setTimeout(() => {
    try { process.kill(-child.pid, 'SIGKILL'); } catch (error) {
      if (error.code !== 'ESRCH') console.error('Cannot stop desktop process group:', error);
    }
  }, 3500);
  timeout.unref();
}

export async function waitForServer({ port, secret, child, timeoutMs = 15000 }) {
  const url = `http://127.0.0.1:${port}/`;
  const deadline = Date.now() + timeoutMs;
  let exited = false;
  child.once('exit', () => { exited = true; });
  child.once('error', () => { exited = true; });
  while (Date.now() < deadline) {
    if (exited || child.exitCode !== undefined && child.exitCode !== null) throw new Error('Desktop backend exited before ready');
    try {
      const result = await fetch(url, {
        headers: { cookie: `hugremote_desktop_session=${secret}` },
        signal: AbortSignal.timeout(750),
      });
      if (result.ok && (await result.text()).includes('<html')) return url;
    } catch { /* Server not bound yet; try until deadline. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Desktop backend readiness timeout');
}
