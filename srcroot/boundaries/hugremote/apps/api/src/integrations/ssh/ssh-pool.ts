import { Logger } from '@nestjs/common';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Duplex } from 'node:stream';
import { Client, type ClientChannel, type ConnectConfig, type SFTPWrapper } from 'ssh2';

/** Thông tin để nối một máy (không chứa gì của HTTP/DB — ARCHITECTURE §8). */
export interface SshTarget {
  id: string;
  hostName: string;
  port: number;
  user: string;
  identityFile?: string;
  password?: string;
  passphrase?: string;
  /** Máy trung gian đã được phân giải sẵn (ProxyJump). */
  jump?: SshTarget;
}

export interface KnownKey {
  keyType: string;
  fingerprint: string;
}

/** Kho host key do module hosts cấp (đọc/ghi bảng `known_hosts`). */
export interface HostKeyStore {
  get(host: string, port: number): KnownKey[];
}

export type SshErrorKind = 'HOST_KEY_UNKNOWN' | 'HOST_KEY_CHANGED' | 'SSH_AUTH_FAILED' | 'SSH_UNREACHABLE' | 'SSH_REFUSED';

export class SshError extends Error {
  constructor(
    readonly kind: SshErrorKind,
    readonly details: Record<string, unknown> = {},
  ) {
    super(kind);
  }
}

export interface ExecResult {
  stdout: Buffer;
  stderr: Buffer;
  code: number | null;
}

const expandHome = (p: string) => (p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : p);

export function fingerprintOf(key: Buffer): string {
  return 'SHA256:' + crypto.createHash('sha256').update(key).digest('base64').replace(/=+$/, '');
}

function keyTypeOf(key: Buffer): string {
  try {
    const len = key.readUInt32BE(0);
    return key.subarray(4, 4 + len).toString('ascii');
  } catch {
    return 'unknown';
  }
}

const DEFAULT_KEYS = ['id_ed25519', 'id_ecdsa', 'id_rsa'];

/** Khoá riêng để thử: IdentityFile của máy, rồi các khoá mặc định trong ~/.ssh. */
function privateKeys(t: SshTarget): { file: string; data: Buffer }[] {
  const files = t.identityFile ? [expandHome(t.identityFile)] : DEFAULT_KEYS.map((k) => path.join(os.homedir(), '.ssh', k));
  return files.filter((f) => fs.existsSync(f)).map((f) => ({ file: f, data: fs.readFileSync(f) }));
}

interface PoolEntry {
  client: Client;
  ready: Promise<Client>;
  sftp?: Promise<SFTPWrapper>;
  lastUsed: number;
  jumpClient?: Client;
}

/**
 * Pool kết nối ssh2 theo máy. Một kết nối dùng chung cho shell, exec, SFTP của cùng máy; đóng khi rảnh 10 phút.
 * Host key kiểm với kho riêng của app (`DATA_DIR/known_hosts` ↔ bảng known_hosts): chưa có → HOST_KEY_UNKNOWN,
 * khác → HOST_KEY_CHANGED (kèm vân tay) — không bao giờ tự tin khoá (AC-6).
 */
export class SshPool {
  private readonly log = new Logger('Ssh');
  private readonly entries = new Map<string, PoolEntry>();
  private readonly timer: NodeJS.Timeout;

  constructor(
    private readonly keys: HostKeyStore,
    private readonly idleMs = 10 * 60_000,
  ) {
    this.timer = setInterval(() => this.reap(), 60_000);
    this.timer.unref();
  }

  private reap() {
    const now = Date.now();
    for (const [id, e] of this.entries) if (now - e.lastUsed > this.idleMs) this.disconnect(id);
  }

  disconnect(id: string) {
    const e = this.entries.get(id);
    if (!e) return;
    this.entries.delete(id);
    e.client.end();
    e.jumpClient?.end();
  }

  disconnectAll() {
    for (const id of [...this.entries.keys()]) this.disconnect(id);
    clearInterval(this.timer);
  }

  /** Kết nối mới (không qua pool) — dùng cho "Thử kết nối" để kiểm đúng cấu hình đang sửa. */
  async probe(t: SshTarget): Promise<{ fingerprint: string; keyType: string }> {
    let seen: { fingerprint: string; keyType: string } = { fingerprint: '', keyType: '' };
    const { client, jump } = await this.open(t, (k) => (seen = k));
    client.end();
    jump?.end();
    return seen;
  }

  /** Lấy client sẵn sàng của máy — mở mới nếu chưa có hoặc đã rớt. */
  async client(t: SshTarget): Promise<Client> {
    const cur = this.entries.get(t.id);
    if (cur) {
      cur.lastUsed = Date.now();
      return cur.ready;
    }
    const entry: PoolEntry = { client: new Client(), ready: Promise.resolve(new Client()), lastUsed: Date.now() };
    entry.ready = this.open(t).then(({ client, jump }) => {
      entry.client = client;
      entry.jumpClient = jump;
      const drop = () => {
        if (this.entries.get(t.id) === entry) this.entries.delete(t.id);
      };
      client.on('close', () => {
        if (this.entries.get(t.id) === entry) this.log.log(`${t.id}: đóng kết nối SSH`);
        drop();
      });
      client.on('error', drop);
      return client;
    });
    this.entries.set(t.id, entry);
    entry.ready.catch(() => this.entries.delete(t.id));
    return entry.ready;
  }

  async sftp(t: SshTarget): Promise<SFTPWrapper> {
    await this.client(t);
    const e = this.entries.get(t.id)!;
    e.sftp ??= new Promise<SFTPWrapper>((res, rej) => e.client.sftp((err, s) => (err ? rej(err) : res(s))));
    e.sftp.catch(() => (e.sftp = undefined));
    return e.sftp;
  }

  /** Chạy một lệnh (chuỗi đã quote an toàn — G-5) và gom output. */
  async exec(
    t: SshTarget,
    command: string,
    opts: { stdin?: string | Buffer; timeoutMs?: number; maxBytes?: number } = {},
  ): Promise<ExecResult> {
    const c = await this.client(t);
    return new Promise((resolve, reject) => {
      c.exec(command, (err, ch) => {
        if (err) return reject(err);
        const out: Buffer[] = [];
        const errs: Buffer[] = [];
        let size = 0;
        const max = opts.maxBytes ?? 8 * 1024 * 1024;
        const timer = opts.timeoutMs ? setTimeout(() => ch.close(), opts.timeoutMs) : undefined;
        ch.on('data', (d: Buffer) => {
          size += d.length;
          if (size <= max) out.push(d);
        });
        ch.stderr.on('data', (d: Buffer) => errs.push(d));
        ch.on('close', (code: number | null) => {
          if (timer) clearTimeout(timer);
          resolve({ stdout: Buffer.concat(out), stderr: Buffer.concat(errs), code });
        });
        if (opts.stdin !== undefined) ch.end(opts.stdin);
        else ch.end();
      });
    });
  }

  /** Lệnh chạy lâu (Claude CLI) — trả kênh để caller đọc/ghi luồng. */
  async spawn(t: SshTarget, command: string): Promise<ClientChannel> {
    const c = await this.client(t);
    return new Promise((resolve, reject) => c.exec(command, (err, ch) => (err ? reject(err) : resolve(ch))));
  }

  async shell(t: SshTarget, cols: number, rows: number, command?: string): Promise<ClientChannel> {
    const c = await this.client(t);
    const pty = { term: 'xterm-256color', cols, rows };
    return new Promise((resolve, reject) => {
      if (command) c.exec(command, { pty }, (err, ch) => (err ? reject(err) : resolve(ch)));
      else c.shell(pty, (err, ch) => (err ? reject(err) : resolve(ch)));
    });
  }

  private async open(
    t: SshTarget,
    onKey?: (k: { fingerprint: string; keyType: string }) => void,
  ): Promise<{ client: Client; jump?: Client }> {
    let sock: Duplex | undefined;
    let jump: Client | undefined;
    if (t.jump) {
      try {
        jump = (await this.open(t.jump)).client;
      } catch (e) {
        if (e instanceof SshError) throw new SshError(e.kind, { ...e.details, via: t.jump.id });
        throw e;
      }
      sock = await new Promise<Duplex>((res, rej) =>
        jump!.forwardOut('127.0.0.1', 0, t.hostName, t.port, (err, stream) =>
          err ? rej(new SshError('SSH_UNREACHABLE', { via: t.jump!.id, reason: err.message })) : res(stream),
        ),
      );
    }
    const keyFiles = privateKeys(t);
    const order: Record<string, unknown>[] = [];
    if (process.env.SSH_AUTH_SOCK) order.push({ type: 'agent', username: t.user, agent: process.env.SSH_AUTH_SOCK });
    for (const k of keyFiles) order.push({ type: 'publickey', username: t.user, key: k.data, passphrase: t.passphrase });
    if (t.password) {
      order.push({ type: 'password', username: t.user, password: t.password });
      order.push({
        type: 'keyboard-interactive',
        username: t.user,
        prompt: (_n: string, _i: string, _l: string, prompts: unknown[], finish: (a: string[]) => void) =>
          finish(prompts.map(() => t.password!)),
      });
    }
    let hostKeyError: SshError | undefined;
    const base: ConnectConfig = {
      host: t.hostName,
      port: t.port,
      username: t.user,
      sock,
      readyTimeout: 15_000,
      keepaliveInterval: 15_000,
      hostVerifier: (key: Buffer) => {
        const fp = fingerprintOf(key);
        const keyType = keyTypeOf(key);
        onKey?.({ fingerprint: fp, keyType });
        const known = this.keys.get(t.hostName, t.port);
        const same = known.find((k) => k.keyType === keyType);
        if (same && same.fingerprint === fp) return true;
        hostKeyError = same
          ? new SshError('HOST_KEY_CHANGED', { keyType, fingerprint: fp, oldFingerprint: same.fingerprint, host: t.hostName, port: t.port })
          : new SshError('HOST_KEY_UNKNOWN', { keyType, fingerprint: fp, host: t.hostName, port: t.port });
        return false;
      },
      // Chuỗi xác thực: agent → khoá file → mật khẩu (thuật toán v1, A2)
      authHandler: (_left, _partial, next) => {
        const item = order.shift();
        next((item ?? false) as never);
      },
    };
    const client = new Client();
    // ssh2 có thể phát 'error' lần hai (vd. "Connection lost before handshake" sau hết readyTimeout) — không ai nghe thì
    // thành uncaughtException và cả API thoát (dogfood edge 2026-11-25). Lỗi thật đã xử ở `once` bên dưới / `drop` của pool.
    client.on('error', () => undefined);
    try {
      await new Promise<void>((resolve, reject) => {
        client.once('ready', () => resolve());
        client.once('error', (err: Error & { level?: string; code?: string }) => {
          if (hostKeyError) return reject(hostKeyError);
          if (err.level === 'client-authentication') return reject(new SshError('SSH_AUTH_FAILED'));
          if (err.code === 'ECONNREFUSED') return reject(new SshError('SSH_REFUSED', { host: t.hostName, port: t.port }));
          reject(new SshError('SSH_UNREACHABLE', { host: t.hostName, port: t.port, reason: err.message }));
        });
        client.connect(base);
      });
    } catch (e) {
      client.end();
      jump?.end();
      this.log.warn(
        `${t.id}: không nối được ${t.hostName}:${t.port}${jump ? ' (qua máy trung gian)' : ''} — ${(e as SshError).kind ?? (e as Error).message}`,
      );
      throw e;
    }
    // TCP_NODELAY như OpenSSH: ssh2 để Nagle bật → phím gõ chờ ACK phím trước, terminal SSH khựng (Authority 2026-11-26).
    // Qua máy trung gian: jump đã set khi mở bằng chính hàm này; sock ở đây là stream forwardOut nên lệnh tự bỏ qua.
    client.setNoDelay(true);
    this.log.log(`${t.id}: đã nối ${t.user}@${t.hostName}:${t.port}${jump ? ' qua máy trung gian' : ''}`);
    return { client, jump };
  }
}
