import { spawn, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as pty from 'node-pty';
import type { ClientChannel, SFTPWrapper, Stats } from 'ssh2';
import { remoteCd, shellQuote } from '@app/shared';
import type { ExecResult, SshPool, SshTarget } from '../ssh/ssh-pool';

/** Một mục trong thư mục — dùng cho S5, S8. */
export interface DirEntry {
  name: string;
  type: 'dir' | 'file' | 'link';
  size: number;
  mtime: number;
}

export interface FileStat {
  type: 'dir' | 'file' | 'link';
  size: number;
  mtime: number;
}

/** PTY đang chạy — terminal (AC-9). */
export interface PtyHandle {
  write(data: string | Buffer): void;
  resize(cols: number, rows: number): void;
  onData(cb: (d: Buffer) => void): void;
  onExit(cb: (code: number | null) => void): void;
  kill(): void;
}

/** Tiến trình dài có stdin/stdout tách riêng — Claude CLI stream-json (AC-20). */
export interface StreamProc {
  stdin: { write(d: string): void; end(): void };
  onStdout(cb: (d: Buffer) => void): void;
  onStderr(cb: (d: Buffer) => void): void;
  onExit(cb: (code: number | null) => void): void;
  /** SIGINT (dừng lượt) hoặc SIGKILL. */
  signal(sig: 'SIGINT' | 'SIGTERM' | 'SIGKILL'): void;
}

export class PathOutsideRootError extends Error {}
export class PathNotFoundError extends Error {}

export interface ExecOpts {
  cwd?: string;
  stdin?: string | Buffer;
  timeoutMs?: number;
  maxBytes?: number;
  env?: Record<string, string>;
}

/**
 * Giao diện chung cho "máy" — local (node-pty, child_process, fs) hoặc SSH (ssh2 shell/exec/SFTP).
 * Đường dẫn: local là tuyệt đối đã kiểm trong ALLOWED_ROOT (G-4); remote giữ dạng `~/…` hoặc tuyệt đối,
 * không mở rộng `~` bằng home local.
 */
export interface HostRuntime {
  readonly kind: 'local' | 'ssh';
  /** argv không qua shell local; với SSH được quote từng tham số (G-5). */
  exec(argv: string[], opts?: ExecOpts): Promise<ExecResult>;
  /** Đường dẫn tuyệt đối thật trên máy đích (`~/x` → `/home/dev/x`). */
  realpath(p: string): Promise<string>;
  readdir(p: string): Promise<DirEntry[]>;
  stat(p: string): Promise<FileStat | null>;
  readFile(p: string, maxBytes?: number): Promise<Buffer>;
  /** Đọc N byte cuối (log, file lớn). */
  readTail(p: string, bytes: number): Promise<Buffer>;
  writeFile(p: string, data: Buffer): Promise<void>;
  mkdir(p: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  remove(p: string): Promise<void>;
  /** `argv` có → chạy đúng lệnh đó thay shell (tmux, vòng 3 — chỉ SSH); không → shell đăng nhập. */
  spawnPty(cwd: string, cols: number, rows: number, argv?: string[]): Promise<PtyHandle>;
  spawnStream(argv: string[], cwd: string, env?: Record<string, string>): Promise<StreamProc>;
}

// ============================ LOCAL ============================

/** realpath trong ALLOWED_ROOT; chặn `..`, symlink ra ngoài, null byte (G-4). */
export function resolveWithinRoot(p: string, root: string): string {
  if (p.includes('\0')) throw new PathOutsideRootError();
  const expanded = p === '~' ? os.homedir() : p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : p;
  const abs = path.resolve(root, expanded);
  const realRoot = fs.realpathSync(root);
  let real: string;
  try {
    real = fs.realpathSync(abs);
  } catch {
    // chưa tồn tại (tạo mới) → kiểm thư mục cha
    let parent = path.dirname(abs);
    while (!fs.existsSync(parent) && parent !== path.dirname(parent)) parent = path.dirname(parent);
    real = path.join(fs.realpathSync(parent), path.relative(parent, abs));
  }
  if (real !== realRoot && !real.startsWith(realRoot + path.sep)) throw new PathOutsideRootError();
  return real;
}

const typeOf = (s: fs.Stats): 'dir' | 'file' | 'link' => (s.isDirectory() ? 'dir' : s.isSymbolicLink() ? 'link' : 'file');

export class LocalRuntime implements HostRuntime {
  readonly kind = 'local' as const;
  constructor(private readonly allowedRoot: string) {}

  private r(p: string) {
    return resolveWithinRoot(p, this.allowedRoot);
  }

  exec(argv: string[], opts: ExecOpts = {}): Promise<ExecResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(argv[0], argv.slice(1), {
        cwd: opts.cwd ? this.r(opts.cwd) : undefined,
        env: { ...process.env, ...opts.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const out: Buffer[] = [];
      const err: Buffer[] = [];
      let size = 0;
      const max = opts.maxBytes ?? 8 * 1024 * 1024;
      const timer = opts.timeoutMs ? setTimeout(() => child.kill('SIGKILL'), opts.timeoutMs) : undefined;
      child.stdout.on('data', (d: Buffer) => {
        size += d.length;
        if (size <= max) out.push(d);
      });
      child.stderr.on('data', (d: Buffer) => err.push(d));
      child.on('error', (e) => {
        if (timer) clearTimeout(timer);
        reject(e);
      });
      child.on('close', (code) => {
        if (timer) clearTimeout(timer);
        resolve({ stdout: Buffer.concat(out), stderr: Buffer.concat(err), code });
      });
      if (opts.stdin !== undefined) child.stdin.end(opts.stdin);
      else child.stdin.end();
    });
  }

  realpath(p: string) {
    return Promise.resolve(this.r(p));
  }

  async readdir(p: string): Promise<DirEntry[]> {
    const dir = this.r(p);
    const names = await fsp.readdir(dir).catch((e: NodeJS.ErrnoException) => {
      if (e.code === 'ENOENT') throw new PathNotFoundError();
      throw e;
    });
    const out: DirEntry[] = [];
    for (const name of names) {
      try {
        const l = await fsp.lstat(path.join(dir, name));
        const s = l.isSymbolicLink() ? await fsp.stat(path.join(dir, name)).catch(() => l) : l;
        out.push({
          name,
          type: s.isDirectory() ? 'dir' : l.isSymbolicLink() && !s.isFile() ? 'link' : s.isDirectory() ? 'dir' : 'file',
          size: s.size,
          mtime: s.mtimeMs,
        });
      } catch {
        /* mục biến mất giữa chừng */
      }
    }
    return out;
  }

  async stat(p: string): Promise<FileStat | null> {
    try {
      const s = await fsp.stat(this.r(p));
      return { type: typeOf(s), size: s.size, mtime: s.mtimeMs };
    } catch {
      return null;
    }
  }

  async readFile(p: string, maxBytes?: number) {
    const f = this.r(p);
    if (maxBytes) {
      const s = await fsp.stat(f);
      if (s.size > maxBytes) throw Object.assign(new Error('too large'), { code: 'E2BIG', size: s.size });
    }
    return fsp.readFile(f);
  }

  async readTail(p: string, bytes: number) {
    const f = this.r(p);
    const s = await fsp.stat(f);
    const fd = await fsp.open(f, 'r');
    try {
      const len = Math.min(bytes, s.size);
      const buf = Buffer.alloc(len);
      await fd.read(buf, 0, len, s.size - len);
      return buf;
    } finally {
      await fd.close();
    }
  }

  async writeFile(p: string, data: Buffer) {
    const f = this.r(p);
    const tmp = `${f}.hugremote-tmp-${process.pid}`;
    const mode = await fsp
      .stat(f)
      .then((s) => s.mode & 0o777)
      .catch(() => 0o644);
    await fsp.writeFile(tmp, data, { mode });
    await fsp.rename(tmp, f);
  }

  async mkdir(p: string) {
    await fsp.mkdir(this.r(p), { recursive: false });
  }
  async rename(from: string, to: string) {
    await fsp.rename(this.r(from), this.r(to));
  }
  async remove(p: string) {
    await fsp.rm(this.r(p), { recursive: true, force: false });
  }

  spawnPty(cwd: string, cols: number, rows: number, argv?: string[]): Promise<PtyHandle> {
    if (argv) return Promise.reject(new Error('local PTY chỉ chạy shell'));
    const shell =
      process.env.SHELL && fs.existsSync(process.env.SHELL) ? process.env.SHELL : fs.existsSync('/bin/bash') ? '/bin/bash' : '/bin/sh';
    let dir: string;
    try {
      dir = this.r(cwd);
    } catch {
      dir = os.homedir();
    }
    const p = pty.spawn(shell, ['-l'], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: fs.existsSync(dir) ? dir : os.homedir(),
      env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
    });
    return Promise.resolve({
      write: (d) => p.write(typeof d === 'string' ? d : d.toString('utf8')),
      resize: (c, r) => p.resize(Math.max(2, c), Math.max(2, r)),
      onData: (cb) => p.onData((d) => cb(Buffer.from(d, 'utf8'))),
      onExit: (cb) => p.onExit(({ exitCode }) => cb(exitCode)),
      kill: () => p.kill(),
    });
  }

  spawnStream(argv: string[], cwd: string, env?: Record<string, string>): Promise<StreamProc> {
    let dir: string;
    try {
      dir = this.r(cwd);
    } catch {
      dir = os.homedir();
    }
    const child: ChildProcess = spawn(argv[0], argv.slice(1), {
      cwd: dir,
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('spawn', () =>
        resolve({
          stdin: { write: (d) => child.stdin!.write(d), end: () => child.stdin!.end() },
          onStdout: (cb) => child.stdout!.on('data', cb),
          onStderr: (cb) => child.stderr!.on('data', cb),
          onExit: (cb) => child.on('close', (code) => cb(code)),
          signal: (sig) => child.kill(sig),
        }),
      );
    });
  }
}

// ============================ SSH ============================

/** `~/x` → đường dẫn SFTP (tương đối home của phiên SFTP); tuyệt đối giữ nguyên. */
function sftpPath(p: string): string {
  if (p === '~' || p === '') return '.';
  if (p.startsWith('~/')) return p.slice(2);
  return p;
}

/** Tham số đường dẫn cho lệnh remote: `~` mở rộng bằng $HOME của máy đích, không bằng home local (G-4). */
export function remotePathArg(p: string): string {
  if (p === '~') return '"$HOME"';
  if (p.startsWith('~/')) return `"$HOME"/${shellQuote(p.slice(2))}`;
  return shellQuote(p);
}

/** Tham số argv cho remote: `~`/`~/…` mở rộng bằng $HOME máy đích, còn lại quote nguyên (G-5). */
const argQuote = (a: string) => (a === '~' || a.startsWith('~/') ? remotePathArg(a) : shellQuote(a));

const sftpCall = <T>(fn: (cb: (err: Error | null | undefined, v: T) => void) => void) =>
  new Promise<T>((res, rej) =>
    fn((err, v) => {
      if (err) {
        const code = (err as Error & { code?: number }).code;
        if (code === 2) return rej(new PathNotFoundError());
        return rej(err);
      }
      res(v);
    }),
  );

const sftpType = (s: Stats): 'dir' | 'file' | 'link' => (s.isDirectory() ? 'dir' : s.isSymbolicLink() ? 'link' : 'file');

export class SshRuntime implements HostRuntime {
  readonly kind = 'ssh' as const;
  constructor(
    private readonly pool: SshPool,
    private readonly target: SshTarget,
  ) {}

  private sftp(): Promise<SFTPWrapper> {
    return this.pool.sftp(this.target);
  }

  exec(argv: string[], opts: ExecOpts = {}): Promise<ExecResult> {
    const envPrefix = opts.env
      ? Object.entries(opts.env)
          .map(([k, v]) => `${k}=${shellQuote(v)}`)
          .join(' ') + ' '
      : '';
    const cmd = (opts.cwd ? `${remoteCd(opts.cwd)} && ` : '') + envPrefix + argv.map(argQuote).join(' ');
    return this.pool.exec(this.target, cmd, { stdin: opts.stdin, timeoutMs: opts.timeoutMs, maxBytes: opts.maxBytes });
  }

  async realpath(p: string) {
    const s = await this.sftp();
    return sftpCall<string>((cb) => s.realpath(sftpPath(p), cb));
  }

  async readdir(p: string): Promise<DirEntry[]> {
    const s = await this.sftp();
    const list = await sftpCall<{ filename: string; attrs: Stats }[]>((cb) => s.readdir(sftpPath(p), cb));
    return list.map((e) => ({ name: e.filename, type: sftpType(e.attrs), size: e.attrs.size, mtime: e.attrs.mtime * 1000 }));
  }

  async stat(p: string): Promise<FileStat | null> {
    const s = await this.sftp();
    try {
      const st = await sftpCall<Stats>((cb) => s.stat(sftpPath(p), cb));
      return { type: sftpType(st), size: st.size, mtime: st.mtime * 1000 };
    } catch {
      return null;
    }
  }

  async readFile(p: string, maxBytes?: number) {
    const s = await this.sftp();
    if (maxBytes) {
      const st = await sftpCall<Stats>((cb) => s.stat(sftpPath(p), cb));
      if (st.size > maxBytes) throw Object.assign(new Error('too large'), { code: 'E2BIG', size: st.size });
    }
    return sftpCall<Buffer>((cb) => s.readFile(sftpPath(p), cb as never));
  }

  async readTail(p: string, bytes: number) {
    const r = await this.exec(['tail', '-c', String(bytes), '--', p], { maxBytes: bytes + 1024 });
    return r.stdout;
  }

  async writeFile(p: string, data: Buffer) {
    const s = await this.sftp();
    const target = sftpPath(p);
    const tmp = `${target}.hugremote-tmp`;
    await sftpCall<void>((cb) => s.writeFile(tmp, data, cb as never));
    // posix-rename của OpenSSH: đổi tên đè nguyên tử
    await sftpCall<void>((cb) =>
      (s as SFTPWrapper & { ext_openssh_rename: (a: string, b: string, c: (e?: Error) => void) => void }).ext_openssh_rename(
        tmp,
        target,
        cb,
      ),
    );
  }

  async mkdir(p: string) {
    const s = await this.sftp();
    await sftpCall<void>((cb) => s.mkdir(sftpPath(p), cb as never));
  }
  async rename(from: string, to: string) {
    const s = await this.sftp();
    await sftpCall<void>((cb) => s.rename(sftpPath(from), sftpPath(to), cb));
  }
  async remove(p: string) {
    const r = await this.pool.exec(this.target, `rm -rf -- ${remotePathArg(p)}`);
    if (r.code !== 0) throw new Error(r.stderr.toString());
  }

  async spawnPty(cwd: string, cols: number, rows: number, argv?: string[]): Promise<PtyHandle> {
    const cmd = argv ? `${remoteCd(cwd)} && exec ${argv.map(argQuote).join(' ')}` : `${remoteCd(cwd)} && exec "\${SHELL:-/bin/sh}" -l`;
    const ch: ClientChannel = await this.pool.shell(this.target, cols, rows, cmd);
    return {
      write: (d) => ch.write(d),
      resize: (c, r) => ch.setWindow(Math.max(2, r), Math.max(2, c), 0, 0),
      onData: (cb) => {
        ch.on('data', cb);
        ch.stderr.on('data', cb);
      },
      onExit: (cb) => ch.on('close', (code: number | null) => cb(code ?? null)),
      kill: () => ch.close(),
    };
  }

  async spawnStream(argv: string[], cwd: string, env?: Record<string, string>): Promise<StreamProc> {
    const envPrefix = env
      ? Object.entries(env)
          .map(([k, v]) => `${k}=${shellQuote(v)}`)
          .join(' ') + ' '
      : '';
    // Shell đăng nhập để có PATH của user (claude thường ở ~/.local/bin)
    const inner = `${remoteCd(cwd)} && ${envPrefix}exec ${argv.map(argQuote).join(' ')}`;
    const ch = await this.pool.spawn(this.target, `exec "\${SHELL:-/bin/sh}" -lc ${shellQuote(inner)}`);
    return {
      stdin: { write: (d) => ch.write(d), end: () => ch.end() },
      onStdout: (cb) => ch.on('data', cb),
      onStderr: (cb) => ch.stderr.on('data', cb),
      onExit: (cb) => ch.on('close', (code: number | null) => cb(code ?? null)),
      signal: (sig) => {
        try {
          ch.signal(sig === 'SIGINT' ? 'INT' : sig === 'SIGTERM' ? 'TERM' : 'KILL');
        } catch {
          /* máy đích không hỗ trợ signal */
        }
        if (sig !== 'SIGINT') ch.close();
      },
    };
  }
}
