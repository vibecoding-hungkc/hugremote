import { Client, ClientChannel, SFTPWrapper } from 'ssh2';
import { execFileSync, spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { Duplex } from 'stream';
import pty from 'node-pty';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ServerConfig, hasSshHostAlias } from '../config.js';

export interface RemotePtyInstance {
  id: string;
  name: string;
  serverId: string;
  buffer: string;
  stream: ClientChannel;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
  onData: (callback: (data: string) => void) => void;
  onExit: (callback: () => void) => void;
}

const MAX_BUFFER_LENGTH = 100 * 1024;
const NATIVE_FALLBACK_TTL_MS = 2 * 60 * 1000;

export function isEncryptedPrivateKeyBuffer(buf: Buffer): boolean {
  const text = buf.toString('utf8');
  if (/ENCRYPTED/i.test(text)) return true;
  if (text.includes('BEGIN OPENSSH PRIVATE KEY')) {
    try {
      const base64Body = text
        .replace(/-----BEGIN OPENSSH PRIVATE KEY-----/g, '')
        .replace(/-----END OPENSSH PRIVATE KEY-----/g, '')
        .replace(/\s+/g, '');
      const raw = Buffer.from(base64Body, 'base64');
      const magic = 'openssh-key-v1\0';
      if (raw.subarray(0, magic.length).toString('ascii') === magic) {
        const cipherLen = raw.readUInt32BE(magic.length);
        const cipherName = raw
          .subarray(magic.length + 4, magic.length + 4 + cipherLen)
          .toString('ascii');
        if (cipherName && cipherName !== 'none') {
          return true;
        }
      }
    } catch {
      // Ignore parse failure
    }
  }
  return false;
}

function resolveSshAuthSock(): string | undefined {
  if (process.env.SSH_AUTH_SOCK && fs.existsSync(process.env.SSH_AUTH_SOCK)) {
    return process.env.SSH_AUTH_SOCK;
  }
  if (process.platform === 'darwin') {
    try {
      const out = execFileSync('launchctl', ['getenv', 'SSH_AUTH_SOCK'], {
        encoding: 'utf8',
        timeout: 1500,
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      if (out && fs.existsSync(out)) {
        process.env.SSH_AUTH_SOCK = out;
        return out;
      }
    } catch {
      // Ignore if launchctl has no SSH_AUTH_SOCK
    }
  }
  return process.env.SSH_AUTH_SOCK || undefined;
}

let cachedLoginShellPath: string | null = null;
function resolveEnhancedPath(): string {
  const home = os.homedir();
  const standardDirs = [
    path.join(home, '.local', 'bin'),
    path.join(home, '.orbstack', 'bin'),
    path.join(home, '.rd', 'bin'),
    '/opt/homebrew/bin',
    '/opt/homebrew/sbin',
    '/usr/local/bin',
    '/usr/local/sbin',
    '/opt/local/bin',
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin',
  ];

  if (process.platform === 'darwin' && cachedLoginShellPath === null) {
    cachedLoginShellPath = '';
    try {
      const userShell = process.env.SHELL || '/bin/zsh';
      const out = execFileSync(
        userShell,
        ['-lic', 'printf "__HUG_PATH_START__%s__HUG_PATH_END__" "$PATH"'],
        {
          encoding: 'utf8',
          timeout: 1500,
          stdio: ['ignore', 'pipe', 'ignore'],
        }
      );
      const match = out.match(/__HUG_PATH_START__([\s\S]*?)__HUG_PATH_END__/);
      if (match && match[1]) {
        cachedLoginShellPath = match[1].trim();
      }
    } catch {
      // Ignore shell probe failure
    }
  }

  const parts = [
    ...standardDirs,
    ...(cachedLoginShellPath ? cachedLoginShellPath.split(':') : []),
    ...(process.env.PATH ? process.env.PATH.split(':') : []),
  ].filter(Boolean);

  return Array.from(new Set(parts)).join(':');
}

export function getEnhancedSshEnv(extraEnv?: Record<string, string>): NodeJS.ProcessEnv {
  const authSock = resolveSshAuthSock();
  return {
    ...process.env,
    ...(authSock ? { SSH_AUTH_SOCK: authSock } : {}),
    PATH: resolveEnhancedPath(),
    ...(extraEnv || {}),
  };
}

function resolveKeyFilePath(rawKeyPath: string, homeDir = os.homedir()): string {
  const trimmed = rawKeyPath.trim().replace(/^['"]|['"]$/g, '');
  if (trimmed.startsWith('~/')) {
    return path.join(homeDir, trimmed.slice(2));
  }
  if (trimmed.startsWith('%d/')) {
    return path.join(homeDir, trimmed.slice(3));
  }
  if (path.isAbsolute(trimmed)) {
    return trimmed;
  }
  return path.join(homeDir, '.ssh', trimmed);
}

function parseJumpHop(rawHop: string): { user?: string; host: string; port?: string } {
  let rest = rawHop.trim();
  let user: string | undefined;
  const atIdx = rest.lastIndexOf('@');
  if (atIdx !== -1) {
    user = rest.slice(0, atIdx);
    rest = rest.slice(atIdx + 1);
  }
  const bracketMatch = rest.match(/^\[([^\]]+)\](?::(\d+))?$/);
  if (bracketMatch) {
    return { user, host: bracketMatch[1], port: bracketMatch[2] };
  }
  const colonParts = rest.split(':');
  if (colonParts.length === 2 && /^\d+$/.test(colonParts[1])) {
    return { user, host: colonParts[0], port: colonParts[1] };
  }
  return { user, host: rest };
}

export function buildProxyCommandFromJump(proxyJump: string, sshExec = '/usr/bin/ssh'): string {
  const hops = proxyJump
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean);
  if (hops.length === 0) return '';
  const lastHop = parseJumpHop(hops[hops.length - 1]);
  const priorHops = hops
    .slice(0, -1)
    .map((h) => {
      const parsed = parseJumpHop(h);
      const userHost = parsed.user ? `${parsed.user}@${parsed.host}` : parsed.host;
      return parsed.port ? `${userHost}:${parsed.port}` : userHost;
    })
    .join(',');

  const parts: string[] = [
    sshExec,
    '-o',
    'StrictHostKeyChecking=no',
    '-o',
    'ServerAliveInterval=15',
  ];
  if (priorHops) {
    parts.push('-J', priorHops);
  }
  if (lastHop.port) {
    parts.push('-p', lastHop.port);
  }
  parts.push('-W', "'[%h]:%p'");
  parts.push(lastHop.user ? `${lastHop.user}@${lastHop.host}` : lastHop.host);
  return parts.join(' ');
}

interface EffectiveSshTarget {
  alias: string;
  host: string;
  port: number;
  user: string;
  identityFiles: string[];
  proxyCommand?: string;
  proxyJump?: string;
}

function resolveEffectiveSshTarget(server: ServerConfig, homeDir = os.homedir()): EffectiveSshTarget {
  const alias = server.name || server.host;
  const identityFiles: string[] = [];
  if (server.key) {
    identityFiles.push(resolveKeyFilePath(server.key, homeDir));
  }

  let resolvedHost = server.host || alias;
  let resolvedPort = server.port || 22;
  let resolvedUser = server.user || os.userInfo().username || 'root';
  let resolvedProxyCommand = server.proxyCommand;
  let resolvedProxyJump = server.proxyJump;

  const sshBin = fs.existsSync('/usr/bin/ssh') ? '/usr/bin/ssh' : 'ssh';
  if (alias && hasSshHostAlias(alias, homeDir)) {
    try {
      const sshConfigPath = path.join(homeDir, '.ssh', 'config');
      const args = fs.existsSync(sshConfigPath) ? ['-F', sshConfigPath, '-G', alias] : ['-G', alias];
      const out = execFileSync(sshBin, args, {
        encoding: 'utf8',
        timeout: 1500,
        env: getEnhancedSshEnv({ HOME: homeDir }),
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      for (const rawLine of out.split('\n')) {
        const line = rawLine.trim();
        if (!line) continue;
        const spaceIdx = line.indexOf(' ');
        if (spaceIdx === -1) continue;
        const k = line.slice(0, spaceIdx).toLowerCase();
        const v = line.slice(spaceIdx + 1).trim();
        if (!v) continue;
        if (k === 'hostname') {
          resolvedHost = v;
        } else if (k === 'port') {
          const p = parseInt(v, 10);
          if (!isNaN(p) && p > 0) resolvedPort = p;
        } else if (k === 'user') {
          resolvedUser = v;
        } else if (k === 'identityfile') {
          const fullKey = resolveKeyFilePath(v, homeDir);
          if (!identityFiles.includes(fullKey)) identityFiles.push(fullKey);
        } else if (k === 'proxycommand' && v.toLowerCase() !== 'none') {
          resolvedProxyCommand = v;
        } else if (k === 'proxyjump' && v.toLowerCase() !== 'none') {
          resolvedProxyJump = v;
        }
      }
    } catch {
      // Fallback to ServerConfig properties if ssh -G is unavailable
    }
  }

  const sshDir = path.join(homeDir, '.ssh');
  for (const defName of ['id_ed25519', 'id_ecdsa', 'id_rsa', 'id_dsa']) {
    const full = path.join(sshDir, defName);
    if (!identityFiles.includes(full)) identityFiles.push(full);
  }

  if (!resolvedProxyCommand && resolvedProxyJump) {
    const sshExec = fs.existsSync('/usr/bin/ssh') ? '/usr/bin/ssh' : 'ssh';
    resolvedProxyCommand = buildProxyCommandFromJump(server.proxyJump || resolvedProxyJump, sshExec);
  }

  return {
    alias,
    host: resolvedHost,
    port: resolvedPort,
    user: resolvedUser,
    identityFiles,
    proxyCommand: resolvedProxyCommand,
    proxyJump: resolvedProxyJump,
  };
}

function resolveUsablePrivateKey(target: EffectiveSshTarget): Buffer | undefined {
  for (const filePath of target.identityFiles) {
    try {
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) continue;
      const buf = fs.readFileSync(filePath);
      if (isEncryptedPrivateKeyBuffer(buf)) {
        continue;
      }
      return buf;
    } catch {
      // Ignore unreadable key file
    }
  }
  return undefined;
}

function expandOpenSshTokens(template: string, target: EffectiveSshTarget): string {
  return template.replace(/%([%hprn])/g, (_m, tok) => {
    if (tok === '%') return '%';
    if (tok === 'h') return target.host;
    if (tok === 'p') return String(target.port);
    if (tok === 'r') return target.user;
    if (tok === 'n') return target.alias || target.host;
    return _m;
  });
}

function createProxyCommandDuplex(proxyCmdTemplate: string, target: EffectiveSshTarget): { sock: Duplex; cleanup: () => void } {
  const expandedCmd = expandOpenSshTokens(proxyCmdTemplate, target);
  const child: ChildProcess = spawn('/bin/sh', ['-c', expandedCmd], {
    env: getEnhancedSshEnv(),
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    try {
      child.kill('SIGTERM');
    } catch {}
  };

  const sock = new Duplex({
    read() {},
    write(chunk, encoding, callback) {
      if (!child.stdin || child.stdin.destroyed) {
        callback(new Error('ProxyCommand stdin is closed'));
        return;
      }
      child.stdin.write(chunk, encoding, callback);
    },
    final(callback) {
      try {
        child.stdin?.end();
      } catch {}
      callback();
    },
    destroy(err, callback) {
      cleanup();
      callback(err);
    },
  });

  child.stdout?.on('data', (chunk: Buffer) => {
    sock.push(chunk);
  });
  child.stdout?.on('end', () => {
    sock.push(null);
  });
  child.on('error', (err) => {
    sock.destroy(err);
  });
  child.on('close', (code) => {
    if (code && code !== 0 && !sock.destroyed) {
      sock.destroy(new Error(`ProxyCommand exited with code ${code}`));
    }
  });

  return { sock, cleanup };
}

export function buildNativeSshArgs(
  server: ServerConfig,
  extraArgs: string[] = [],
  homeDirOverride?: string
): string[] {
  const homeDir = homeDirOverride || process.env.HOME || os.homedir();
  const args: string[] = [
    '-o',
    'ServerAliveInterval=15',
    '-o',
    'ServerAliveCountMax=3',
    '-o',
    'StrictHostKeyChecking=no',
  ];

  const hasAliasInConfig = Boolean(server.name) && hasSshHostAlias(server.name, homeDir);

  if (hasAliasInConfig) {
    const sshConfigPath = path.join(homeDir, '.ssh', 'config');
    if (homeDirOverride && fs.existsSync(sshConfigPath)) {
      args.push('-F', sshConfigPath);
    }
    args.push(server.name);
  } else {
    if (server.key) {
      const resolvedKey = resolveKeyFilePath(server.key, homeDir);
      if (fs.existsSync(resolvedKey)) {
        args.push('-i', resolvedKey);
      }
    }
    if (server.proxyJump) {
      args.push('-J', server.proxyJump);
    } else if (server.proxyCommand) {
      args.push('-o', `ProxyCommand=${server.proxyCommand}`);
    }
    if (server.port && server.port !== 22) {
      args.push('-p', String(server.port));
    }
    const target = server.user ? `${server.user}@${server.host}` : server.host;
    args.push(target);
  }

  args.push(...extraArgs);
  return args;
}

interface NativeSshTestSpawners {
  spawnPty?: (
    sessionInfo: { id: string; name: string; serverId: string; cols?: number; rows?: number; cwd?: string },
    server: ServerConfig,
    args: string[]
  ) => RemotePtyInstance;
  spawnExec?: (
    server: ServerConfig,
    command: string,
    options?: { env?: Record<string, string> }
  ) => ClientChannel;
}

class SshConnectionPool {
  private clients = new Map<string, Client>();
  private connecting = new Map<string, Promise<Client>>();
  private sftpWrappers = new Map<string, SFTPWrapper>();
  private connectedServerIds = new Set<string>();
  private nativeFallbackUntil = new Map<string, number>();
  private testSpawners: NativeSshTestSpawners | null = null;

  public setNativeSshSpawnersForTest(spawners: NativeSshTestSpawners | null) {
    this.testSpawners = spawners;
    this.nativeFallbackUntil.clear();
  }

  private shouldUseNativeFallback(serverId: string): boolean {
    const until = this.nativeFallbackUntil.get(serverId);
    if (!until) return false;
    if (Date.now() > until) {
      this.nativeFallbackUntil.delete(serverId);
      return false;
    }
    return true;
  }

  private markNativeFallback(serverId: string) {
    this.nativeFallbackUntil.set(serverId, Date.now() + NATIVE_FALLBACK_TTL_MS);
  }

  async getClient(server: ServerConfig): Promise<Client> {
    const existing = this.clients.get(server.id);
    if (existing) {
      return existing;
    }

    if (this.shouldUseNativeFallback(server.id)) {
      throw new Error('Using native OpenSSH fallback for this host');
    }

    const pending = this.connecting.get(server.id);
    if (pending) {
      return pending;
    }

    const connectPromise = new Promise<Client>((resolve, reject) => {
      const conn = new Client();
      let settled = false;
      let proxyCleanup: (() => void) | null = null;

      const target = resolveEffectiveSshTarget(server);
      const privateKey = resolveUsablePrivateKey(target);
      const agent = resolveSshAuthSock();

      conn.on('keyboard-interactive', (_name, _instructions, _lang, prompts, finish) => {
        if (server.password && prompts.length > 0) {
          finish(prompts.map(() => server.password!));
        } else {
          finish([]);
        }
      });

      conn.on('ready', () => {
        settled = true;
        this.connecting.delete(server.id);
        this.nativeFallbackUntil.delete(server.id);
        this.clients.set(server.id, conn);
        this.connectedServerIds.add(server.id);
        resolve(conn);
      });

      conn.on('error', (err) => {
        this.connecting.delete(server.id);
        this.clients.delete(server.id);
        this.sftpWrappers.delete(server.id);
        proxyCleanup?.();
        if (!settled) {
          settled = true;
          this.markNativeFallback(server.id);
          reject(err);
        }
      });

      conn.on('close', () => {
        this.connecting.delete(server.id);
        this.clients.delete(server.id);
        this.sftpWrappers.delete(server.id);
        proxyCleanup?.();
        if (!settled) {
          settled = true;
          this.markNativeFallback(server.id);
          reject(new Error('SSH connection closed before ready'));
        }
      });

      try {
        const baseConfig: any = {
          username: target.user,
          privateKey,
          password: server.password,
          agent,
          tryKeyboard: Boolean(server.password),
          readyTimeout: 12000,
          keepaliveInterval: 10000,
        };

        if (target.proxyCommand) {
          const proxy = createProxyCommandDuplex(target.proxyCommand, target);
          proxyCleanup = proxy.cleanup;
          baseConfig.sock = proxy.sock;
        } else {
          baseConfig.host = target.host;
          baseConfig.port = target.port || 22;
        }

        conn.connect(baseConfig);
      } catch (syncErr) {
        this.connecting.delete(server.id);
        proxyCleanup?.();
        if (!settled) {
          settled = true;
          this.markNativeFallback(server.id);
          reject(syncErr);
        }
      }
    });

    this.connecting.set(server.id, connectPromise);
    return connectPromise;
  }

  async getSftp(server: ServerConfig): Promise<SFTPWrapper> {
    const existing = this.sftpWrappers.get(server.id);
    if (existing) return existing;

    const client = await this.getClient(server);
    return new Promise((resolve, reject) => {
      client.sftp((err, sftp) => {
        if (err) return reject(err);
        this.sftpWrappers.set(server.id, sftp);
        resolve(sftp);
      });
    });
  }

  private spawnNativeSshExec(
    server: ServerConfig,
    command: string,
    options?: { env?: Record<string, string> }
  ): ClientChannel {
    this.connectedServerIds.add(server.id);
    if (this.testSpawners?.spawnExec) {
      return this.testSpawners.spawnExec(server, command, options);
    }
    const sshBin = fs.existsSync('/usr/bin/ssh') ? '/usr/bin/ssh' : 'ssh';
    const sshArgs = buildNativeSshArgs(server, ['-o', 'BatchMode=yes', command]);
    const child = spawn(sshBin, sshArgs, {
      env: getEnhancedSshEnv(options?.env),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const channelEmitter: any = new EventEmitter();
    channelEmitter.stderr = new EventEmitter();
    channelEmitter.write = (data: string | Buffer, cb?: any) => child.stdin?.write(data, cb);
    channelEmitter.end = (data?: string | Buffer, cb?: any) => {
      if (data !== undefined) child.stdin?.end(data, cb);
      else child.stdin?.end(cb);
    };
    channelEmitter.close = () => {
      try {
        child.kill('SIGTERM');
      } catch {}
    };
    channelEmitter.signal = (sig?: string) => {
      try {
        child.kill((sig ? `SIG${sig.replace(/^SIG/, '')}` : 'SIGTERM') as any);
      } catch {}
    };

    child.stdout?.on('data', (chunk: Buffer) => channelEmitter.emit('data', chunk));
    child.stderr?.on('data', (chunk: Buffer) => channelEmitter.stderr.emit('data', chunk));
    child.on('error', (err) => channelEmitter.emit('error', err));
    child.on('exit', (code, signal) => channelEmitter.emit('exit', code, signal || undefined));
    child.on('close', (code, signal) => channelEmitter.emit('close', code ?? undefined, signal || undefined));

    return channelEmitter as ClientChannel;
  }

  private spawnNativeSshPty(
    sessionInfo: { id: string; name: string; serverId: string; cols?: number; rows?: number; cwd?: string },
    server: ServerConfig
  ): RemotePtyInstance {
    this.connectedServerIds.add(server.id);
    const sshArgs = buildNativeSshArgs(server, ['-tt']);
    if (this.testSpawners?.spawnPty) {
      return this.testSpawners.spawnPty(sessionInfo, server, sshArgs);
    }

    const sshBin = fs.existsSync('/usr/bin/ssh') ? '/usr/bin/ssh' : 'ssh';
    const cols = Math.max(10, sessionInfo.cols || 80);
    const rows = Math.max(5, sessionInfo.rows || 24);
    const ptyProcess = pty.spawn(sshBin, sshArgs, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: os.homedir(),
      env: getEnhancedSshEnv({
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
      }) as Record<string, string>,
    });

    let sentInitialCwd = !sessionInfo.cwd;
    let buffer = '';
    const dataCallbacks: Array<(data: string) => void> = [];
    const exitCallbacks: Array<() => void> = [];

    ptyProcess.onData((data: string) => {
      buffer += data;
      if (buffer.length > MAX_BUFFER_LENGTH) {
        buffer = buffer.substring(buffer.length - MAX_BUFFER_LENGTH);
      }
      if (!sentInitialCwd && sessionInfo.cwd) {
        sentInitialCwd = true;
        setTimeout(() => {
          try {
            ptyProcess.write(`cd "${sessionInfo.cwd}" && clear\r`);
          } catch {}
        }, 120);
      }
      for (const cb of dataCallbacks) cb(data);
    });

    ptyProcess.onExit(() => {
      for (const cb of exitCallbacks) cb();
    });

    return {
      id: sessionInfo.id,
      name: sessionInfo.name,
      serverId: sessionInfo.serverId,
      get buffer() {
        return buffer;
      },
      stream: {} as ClientChannel,
      write(data: string) {
        try {
          ptyProcess.write(data);
        } catch {}
      },
      resize(newCols: number, newRows: number) {
        try {
          ptyProcess.resize(Math.max(10, newCols), Math.max(5, newRows));
        } catch {}
      },
      kill() {
        try {
          ptyProcess.kill();
        } catch {}
      },
      onData(cb) {
        dataCallbacks.push(cb);
      },
      onExit(cb) {
        exitCallbacks.push(cb);
      },
    };
  }

  async executeCommand(
    server: ServerConfig,
    command: string,
    options?: { env?: Record<string, string> }
  ): Promise<ClientChannel> {
    if (this.shouldUseNativeFallback(server.id)) {
      return this.spawnNativeSshExec(server, command, options);
    }
    try {
      const client = await this.getClient(server);
      return await new Promise((resolve, reject) => {
        client.exec(command, options || {}, (err, stream) => {
          if (err) return reject(err);
          resolve(stream);
        });
      });
    } catch {
      this.markNativeFallback(server.id);
      return this.spawnNativeSshExec(server, command, options);
    }
  }

  async runRemoteCommand(
    server: ServerConfig,
    command: string,
    stdinBuffer?: Buffer | string,
    timeoutMs = 30000
  ): Promise<{ stdout: Buffer; stderr: string; exitCode: number }> {
    const stream = await this.executeCommand(server, command);
    return new Promise((resolve, reject) => {
      let settled = false;
      let exitCode: number | undefined;
      const outChunks: Buffer[] = [];
      const errChunks: Buffer[] = [];

      const finish = (err?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (err) {
          reject(err);
        } else {
          resolve({
            stdout: Buffer.concat(outChunks),
            stderr: Buffer.concat(errChunks).toString('utf8'),
            exitCode: exitCode ?? 0,
          });
        }
      };

      const timer = setTimeout(() => {
        try {
          stream.close();
        } catch {}
        finish(new Error('Remote SSH command timed out'));
      }, timeoutMs);

      stream.on('data', (chunk: Buffer | string) => {
        outChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      stream.stderr?.on('data', (chunk: Buffer | string) => {
        errChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      stream.on('error', (err: Error) => finish(err));
      stream.on('exit', (code: number | null) => {
        if (typeof code === 'number') exitCode = code;
      });
      stream.on('close', (code?: number | null) => {
        if (exitCode === undefined && typeof code === 'number') {
          exitCode = code;
        }
        finish();
      });

      if (stdinBuffer !== undefined) {
        try {
          stream.end(stdinBuffer);
        } catch (err: any) {
          finish(err);
        }
      }
    });
  }

  async createShell(
    sessionInfo: { id: string; name: string; serverId: string; cols?: number; rows?: number; cwd?: string },
    server: ServerConfig
  ): Promise<RemotePtyInstance> {
    if (this.shouldUseNativeFallback(server.id)) {
      return this.spawnNativeSshPty(sessionInfo, server);
    }
    try {
      const client = await this.getClient(server);

      return await new Promise((resolve, reject) => {
        client.shell(
          {
            term: 'xterm-256color',
            cols: Math.max(10, sessionInfo.cols || 80),
            rows: Math.max(5, sessionInfo.rows || 24),
          },
          (err, stream) => {
            if (err) return reject(err);

            if (sessionInfo.cwd) {
              setTimeout(() => {
                try {
                  stream.write(`cd "${sessionInfo.cwd}" && clear\r`);
                } catch (_) {}
              }, 100);
            }

            let buffer = '';
            const dataCallbacks: Array<(data: string) => void> = [];
            const exitCallbacks: Array<() => void> = [];

            stream.on('data', (chunk: Buffer) => {
              const str = chunk.toString('utf8');
              buffer += str;
              if (buffer.length > MAX_BUFFER_LENGTH) {
                buffer = buffer.substring(buffer.length - MAX_BUFFER_LENGTH);
              }
              for (const cb of dataCallbacks) cb(str);
            });

            stream.on('close', () => {
              for (const cb of exitCallbacks) cb();
            });

            const instance: RemotePtyInstance = {
              id: sessionInfo.id,
              name: sessionInfo.name,
              serverId: sessionInfo.serverId,
              get buffer() {
                return buffer;
              },
              stream,
              write(data: string) {
                try {
                  stream.write(data);
                } catch (_) {}
              },
              resize(cols: number, rows: number) {
                try {
                  stream.setWindow(Math.max(5, rows), Math.max(10, cols), 0, 0);
                } catch (_) {}
              },
              kill() {
                try {
                  stream.close();
                } catch (_) {}
              },
              onData(cb) {
                dataCallbacks.push(cb);
              },
              onExit(cb) {
                exitCallbacks.push(cb);
              },
            };

            resolve(instance);
          }
        );
      });
    } catch {
      this.markNativeFallback(server.id);
      return this.spawnNativeSshPty(sessionInfo, server);
    }
  }

  disconnect(serverId: string) {
    this.connecting.delete(serverId);
    this.connectedServerIds.delete(serverId);
    this.nativeFallbackUntil.delete(serverId);
    const client = this.clients.get(serverId);
    if (client) {
      try {
        client.end();
      } catch (_) {}
      this.clients.delete(serverId);
      this.sftpWrappers.delete(serverId);
    }
  }

  isServerConnected(serverId: string): boolean {
    return this.clients.has(serverId) || this.connectedServerIds.has(serverId);
  }
}

export const sshPool = new SshConnectionPool();
