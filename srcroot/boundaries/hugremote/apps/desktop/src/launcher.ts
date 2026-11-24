import * as net from 'node:net';
import { ChildProcess, spawn } from 'node:child_process';

export async function findFreePort(startPort: number = 8099): Promise<number> {
  const tryPort = (p: number): Promise<number> => {
    return new Promise((resolve, reject) => {
      const srv = net.createServer();
      srv.once('error', (err) => {
        srv.close();
        reject(err);
      });
      srv.listen(p, '127.0.0.1', () => {
        const port = (srv.address() as net.AddressInfo).port;
        srv.close(() => resolve(port));
      });
    });
  };

  try {
    return await tryPort(startPort);
  } catch {
    return await tryPort(0);
  }
}

export interface LaunchBackendOptions {
  runtime: string;
  backendEntry: string;
  cwd: string;
  port: number;
  secret: string;
  webDist?: string;
  env?: NodeJS.ProcessEnv;
}

export function launchBackend(opts: LaunchBackendOptions): ChildProcess {
  const { runtime, backendEntry, cwd, port, secret, webDist, env = process.env } = opts;
  const backendEnv: NodeJS.ProcessEnv = {
    ...env,
    ELECTRON_RUN_AS_NODE: '1',
    HOST: '127.0.0.1',
    PORT: String(port),
    BASE_PATH: '',
    AUTH_MODE: 'none',
    HUGREMOTE_DESKTOP_SECRET: secret,
    ...(webDist ? { WEB_DIST: webDist } : {}),
  };

  return spawn(runtime, [backendEntry], {
    cwd,
    env: backendEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
}

export function terminateBackend(child?: ChildProcess | null): void {
  if (!child?.pid) return;
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch (error: any) {
    if (error.code !== 'ESRCH') throw error;
  }
  const timeout = setTimeout(() => {
    try {
      if (child.pid) process.kill(-child.pid, 'SIGKILL');
    } catch (error: any) {
      if (error.code !== 'ESRCH') console.error('Cannot stop desktop process group:', error);
    }
  }, 3500);
  timeout.unref();
}

export async function waitForServer(opts: {
  port: number;
  child: ChildProcess;
  timeoutMs?: number;
}): Promise<string> {
  const { port, child, timeoutMs = 20000 } = opts;
  const url = `http://127.0.0.1:${port}/api/health`;
  const deadline = Date.now() + timeoutMs;
  let exited = false;
  child.once('exit', () => {
    exited = true;
  });
  child.once('error', () => {
    exited = true;
  });

  while (Date.now() < deadline) {
    if (exited || (child.exitCode !== undefined && child.exitCode !== null)) {
      throw new Error('Desktop backend exited before ready');
    }
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(800) });
      if (res.ok) return `http://127.0.0.1:${port}`;
    } catch {
      // not yet ready
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Desktop backend readiness timeout (${timeoutMs}ms)`);
}
