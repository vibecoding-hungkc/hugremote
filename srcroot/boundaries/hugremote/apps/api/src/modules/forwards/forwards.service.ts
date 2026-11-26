import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'node:crypto';
import * as net from 'node:net';
import type { Client } from 'ssh2';
import { Repository } from 'typeorm';
import { ErrorCode } from '@app/shared';
import { AppError } from '../../common/app-error';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import { HostsService, LOCAL_HOST_ID } from '../hosts/hosts.service';
import type { CreateForwardDto, ForwardDto, ListeningPortDto, UpdateForwardDto } from './dto/forward.dto';
import { PortForwardEntity } from './forward.entity';

interface Live {
  status: 'on' | 'err';
  error?: string;
  server?: net.Server; // -L
  client?: Client; // -R: client đang giữ forwardIn
  row: PortForwardEntity;
}

const TICK_MS = 10_000;

/**
 * Vòng 3 — AC-57/58. Chuyển tiếp chạy trên chính kết nối SSH của pool (không đẻ `ssh -L` rời).
 * `-L`: listener 127.0.0.1:localPort → `forwardOut` mỗi kết nối. `-R`: `forwardIn` 127.0.0.1:remotePort trên máy SSH → nối về
 * 127.0.0.1:localPort của Mac. Nhịp 10 giây chạm `pool.client()` để pool không reap client nhàn rỗi (giữ `-R` sống), đồng thời
 * là nhịp thử lại khi máy mất kết nối (G-17: mọi listener chỉ 127.0.0.1).
 */
/** Kiểm cổng đích: quá ngần này coi như không ai nghe. */
const PROBE_MS = 2000;

/** Có tiến trình nghe ở 127.0.0.1:port không — mở thử một kết nối TCP rồi đóng ngay. */
export function localPortOpen(port: number, ms = PROBE_MS): Promise<boolean> {
  return new Promise((res) => {
    const s = net.connect(port, '127.0.0.1');
    const end = (v: boolean) => (s.destroy(), res(v));
    s.once('connect', () => end(true));
    s.once('error', () => end(false));
    s.setTimeout(ms, () => end(false));
  });
}

@Injectable()
export class ForwardsService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Forwards');
  private readonly live = new Map<string, Live>();
  private readonly rHandlers = new WeakSet<Client>();
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectRepository(PortForwardEntity) private readonly rows: Repository<PortForwardEntity>,
    private readonly hosts: HostsService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
  ) {}

  async onModuleInit() {
    // Mở app: bật lại chuyển tiếp có "Tự bật khi mở app" mà người dùng chưa tắt; không Tự bật → về tắt.
    // (dogfood operator: trước đây Tự bật ghi đè cả lựa chọn Tắt của người dùng)
    for (const f of await this.rows.find()) {
      if (!f.autoStart && f.enabled) await this.rows.update({ id: f.id }, { enabled: false });
      if (f.autoStart && f.enabled) await this.startOrRetry(f);
    }
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
    for (const id of [...this.live.keys()]) this.stop(id);
  }

  async list(check = false): Promise<ForwardDto[]> {
    const out = (await this.rows.find({ order: { createdAt: 'ASC' } })).map((f) => this.dto(f));
    if (check) await Promise.all(out.map(async (d) => d.status === 'on' && (d.target = (await this.targetUp(d)) ? 'up' : 'down')));
    return out;
  }

  /**
   * Đích có ai nghe không — trước đây chỉ biết khi có kết nối thật đi qua, nên cổng đích tắt mà vẫn hiện "đang bật"
   * (Authority 2026-11-26). `-R`: thử nối cổng trên máy local · `-L`: mở thử một kênh SSH tới cổng trên máy SSH rồi đóng ngay.
   */
  private async targetUp(f: ForwardDto): Promise<boolean> {
    if (f.direction === 'R') return localPortOpen(f.localPort);
    let c: Client;
    try {
      c = await this.hosts.pool.client(await this.hosts.target(f.hostId));
    } catch {
      return false;
    }
    return new Promise<boolean>((res) => {
      const t = setTimeout(() => res(false), PROBE_MS);
      c.forwardOut('127.0.0.1', 0, f.remoteHost, f.remotePort, (err, stream) => {
        clearTimeout(t);
        if (err) return res(false);
        stream.on('error', () => undefined);
        stream.close();
        res(true);
      });
    });
  }

  async create(d: CreateForwardDto): Promise<ForwardDto> {
    if (d.hostId === LOCAL_HOST_ID) throw AppError.badRequest(ErrorCode.FORWARD_LOCAL_HOST);
    await this.hosts.target(d.hostId); // máy phải tồn tại
    const f = Object.assign(new PortForwardEntity(), {
      id: crypto.randomUUID(),
      direction: d.direction,
      hostId: d.hostId,
      remoteHost: d.direction === 'L' ? (d.remoteHost ?? 'localhost') : '127.0.0.1',
      remotePort: d.remotePort,
      localPort: d.localPort,
      label: d.label?.trim() || null,
      autoStart: d.autoStart ?? true,
      enabled: true,
      createdAt: new Date().toISOString(),
    });
    await this.assertFree(f);
    await this.start(f); // lỗi cổng bận → ném trước khi ghi DB
    if (f.direction === 'R' && this.live.get(f.id)?.error === ErrorCode.REMOTE_PORT_IN_USE) {
      this.stop(f.id); // cổng trên máy SSH đã có tiến trình khác giữ — báo 409 như -L, không tạo bản ghi lỗi
      throw AppError.conflict(ErrorCode.REMOTE_PORT_IN_USE, { port: f.remotePort });
    }
    await this.rows.insert(f);
    return this.dto(f);
  }

  /** Sửa cổng: mở listener mới trước, thành công mới đóng cũ — lỗi thì giữ nguyên (ARCHITECTURE §6). */
  async update(id: string, d: UpdateForwardDto): Promise<ForwardDto> {
    const cur = await this.get(id);
    const next = Object.assign(new PortForwardEntity(), cur, {
      ...(d.remotePort !== undefined && { remotePort: d.remotePort }),
      ...(d.localPort !== undefined && { localPort: d.localPort }),
      ...(d.label !== undefined && { label: d.label.trim() || null }),
      ...(d.autoStart !== undefined && { autoStart: d.autoStart }),
      ...(d.enabled !== undefined && { enabled: d.enabled }),
    });
    const portsChanged = next.localPort !== cur.localPort || next.remotePort !== cur.remotePort;
    if (portsChanged) await this.assertFree(next);
    const old = this.live.get(id);
    if (!next.enabled) this.stop(id);
    else if (!old) await this.start(next);
    else {
      // Chỉ mở lại khi đổi đúng cổng đang nghe (-L: cổng trên Mac, -R: cổng trên máy SSH); đổi đầu kia chỉ cần cập nhật row
      const rebind = next.direction === 'L' ? next.localPort !== cur.localPort : next.remotePort !== cur.remotePort;
      if (!rebind) old.row = next;
      else {
        this.live.delete(id);
        try {
          await this.start(next);
        } catch (e) {
          this.live.set(id, old);
          throw e;
        }
        this.close(old, cur);
      }
    }
    await this.rows.update(
      { id },
      { remotePort: next.remotePort, localPort: next.localPort, label: next.label, autoStart: next.autoStart, enabled: next.enabled },
    );
    return this.dto(next);
  }

  async remove(id: string) {
    await this.get(id);
    this.stop(id);
    await this.rows.delete({ id });
  }

  /**
   * AC-58: cổng TCP đang nghe (`ss`, không có thì `lsof` — macOS). Bỏ cổng 22.
   * `local` = máy chạy HugRemote (Mac) — nguồn cho chiều `-R` (Authority 2026-11-25); bỏ cổng của chính HugRemote
   * và listener `-L` do HugRemote mở, vì đó không phải service của người dùng.
   */
  async listening(hostId: string): Promise<ListeningPortDto[]> {
    const rt = await this.hosts.runtime(hostId);
    const ss = await rt.exec(['ss', '-ltnpH']).catch(() => null);
    const ls = ss && ss.code === 0 ? null : await rt.exec(['lsof', '-iTCP', '-sTCP:LISTEN', '-nP']).catch(() => null);
    const out = ss && ss.code === 0 ? parseSs(ss.stdout.toString()) : ls && ls.code === 0 ? parseLsof(ls.stdout.toString()) : [];
    if (hostId !== LOCAL_HOST_ID) return out;
    const ours = new Set([this.cfg.port, ...[...this.live.values()].filter((l) => l.server).map((l) => l.row.localPort)]);
    return out.filter((p) => !ours.has(p.port));
  }

  // ------------------------------------------------------------------------------------------------

  private async get(id: string) {
    const f = await this.rows.findOne({ where: { id } });
    if (!f) throw AppError.notFound();
    return f;
  }

  private async assertFree(f: PortForwardEntity) {
    const all = await this.rows.find();
    const clash = all.find(
      (x) =>
        x.id !== f.id &&
        x.direction === f.direction &&
        (f.direction === 'L' ? x.localPort === f.localPort : x.hostId === f.hostId && x.remotePort === f.remotePort),
    );
    if (clash)
      throw AppError.conflict(f.direction === 'L' ? ErrorCode.LOCAL_PORT_IN_USE : ErrorCode.REMOTE_PORT_IN_USE, {
        usedBy: clash.label ?? clash.id,
      });
    if (f.direction === 'L' && f.localPort < 1024) throw AppError.badRequest(ErrorCode.VALIDATION_FAILED);
  }

  private async start(f: PortForwardEntity) {
    if (f.direction === 'L') {
      const l: Live = { status: 'on', row: f };
      const server = net.createServer((sock) => void this.pipeOut(l.row, sock)); // đọc row lúc có kết nối — sửa đích không cần mở lại
      await new Promise<void>((res, rej) => {
        server.once('error', (e: NodeJS.ErrnoException) =>
          rej(e.code === 'EADDRINUSE' ? AppError.conflict(ErrorCode.LOCAL_PORT_IN_USE, { port: f.localPort }) : e),
        );
        server.listen(f.localPort, '127.0.0.1', () => res());
      });
      server.on('error', (e) => this.log.warn(`${f.id}: ${e.message}`));
      l.server = server;
      this.live.set(f.id, l);
      await this.probe(f, l);
      return;
    }
    const l: Live = { status: 'err', error: 'FORWARD_CONNECTING', row: f };
    this.live.set(f.id, l);
    await this.bindRemote(f, l);
  }

  /** Mỗi kết nối vào listener `-L` → một kênh `forwardOut` trên client SSH dùng chung. */
  private async pipeOut(f: PortForwardEntity, sock: net.Socket) {
    try {
      const c = await this.hosts.pool.client(await this.hosts.target(f.hostId));
      c.forwardOut('127.0.0.1', sock.localPort ?? 0, f.remoteHost, f.remotePort, (err, stream) => {
        if (err) {
          const code = /denied|prohibited/i.test(err.message)
            ? 'FORWARDING_DENIED'
            : /refused/i.test(err.message)
              ? 'REMOTE_NOT_LISTENING'
              : err.message;
          this.mark(f.id, 'err', code);
          return sock.destroy();
        }
        if (this.live.get(f.id)?.error === 'REMOTE_NOT_LISTENING') this.mark(f.id, 'on', undefined);
        sock.pipe(stream).pipe(sock);
        stream.on('error', () => sock.destroy());
        sock.on('error', () => stream.destroy());
      });
    } catch (e) {
      this.mark(f.id, 'err', (e as Error).message);
      sock.destroy();
    }
  }

  private async bindRemote(f: PortForwardEntity, l: Live) {
    try {
      const c = await this.hosts.pool.client(await this.hosts.target(f.hostId));
      if (l.client === c && l.status === 'on') return;
      this.attachTcpHandler(c);
      await new Promise<void>((res, rej) =>
        c.forwardIn('127.0.0.1', f.remotePort, (err) =>
          err
            ? rej(
                /unable to bind/i.test(err.message)
                  ? new Error(ErrorCode.REMOTE_PORT_IN_USE)
                  : /denied|prohibited|forward/i.test(err.message)
                    ? new Error('FORWARDING_DENIED')
                    : err,
              )
            : res(),
        ),
      );
      l.client = c;
      l.status = 'on';
      l.error = undefined;
      c.once('close', () => {
        if (this.live.get(f.id) === l) Object.assign(l, { status: 'err', error: 'SSH_DISCONNECTED', client: undefined });
      });
    } catch (e) {
      Object.assign(l, { status: 'err', error: (e as Error).message, client: undefined });
    }
  }

  /** Một handler `tcp connection` mỗi client, chia theo cổng đích → service trên Mac. */
  private attachTcpHandler(c: Client) {
    if (this.rHandlers.has(c)) return;
    this.rHandlers.add(c);
    c.on('tcp connection', (info, accept, reject) => {
      const l = [...this.live.values()].find((x) => x.client === c && x.row.direction === 'R' && x.row.remotePort === info.destPort);
      if (!l) return reject();
      const stream = accept();
      const sock = net.connect(l.row.localPort, '127.0.0.1');
      sock.on('error', () => stream.destroy());
      stream.on('error', () => sock.destroy());
      stream.pipe(sock).pipe(stream);
    });
  }

  /** `-L`: kiểm máy tới được để báo trạng thái thật (listener vẫn giữ cổng dù máy tạm mất). */
  private async probe(f: PortForwardEntity, l: Live) {
    try {
      await this.hosts.pool.client(await this.hosts.target(f.hostId));
      // hai lỗi này chỉ biết được khi có kết nối thật đi qua — probe (chỉ kiểm máy tới được) không xoá
      if (l.error !== 'FORWARDING_DENIED' && l.error !== 'REMOTE_NOT_LISTENING') Object.assign(l, { status: 'on', error: undefined });
    } catch (e) {
      Object.assign(l, { status: 'err', error: (e as Error).message });
    }
  }

  /** Mở không được (cổng bận, máy chưa tới được) → giữ lỗi có mã + log; `tick()` thử lại 10 giây một lần. */
  private async startOrRetry(f: PortForwardEntity) {
    try {
      await this.start(f);
      this.log.log(`${f.id}: bật ${f.direction} ${f.hostId} ${f.remotePort} ↔ 127.0.0.1:${f.localPort}`);
    } catch (e) {
      const code = e instanceof AppError ? e.code : (e as Error).message;
      this.live.set(f.id, { status: 'err', error: code, row: f });
      this.log.warn(`${f.id}: chưa bật được (${code}) — thử lại sau ${TICK_MS / 1000} giây`);
    }
  }

  private async tick() {
    for (const f of await this.rows.find({ where: { enabled: true } })) {
      const l = this.live.get(f.id);
      if (!l) continue;
      if (!l.server && !l.client && f.direction === 'L') {
        this.live.delete(f.id);
        await this.startOrRetry(f);
        continue;
      }
      if (f.direction === 'L') await this.probe(f, l);
      else await this.bindRemote(f, l);
    }
  }

  private mark(id: string, status: Live['status'], error?: string) {
    const l = this.live.get(id);
    if (l) Object.assign(l, { status, error });
  }

  private stop(id: string) {
    const l = this.live.get(id);
    if (!l) return;
    this.live.delete(id);
    this.close(l, l.row);
  }

  private close(l: Live, f: PortForwardEntity) {
    l.server?.close();
    if (l.client && f.direction === 'R') l.client.unforwardIn('127.0.0.1', f.remotePort, () => undefined);
  }

  private dto(f: PortForwardEntity): ForwardDto {
    const l = this.live.get(f.id);
    return {
      id: f.id,
      direction: f.direction,
      hostId: f.hostId,
      remoteHost: f.remoteHost,
      remotePort: f.remotePort,
      localPort: f.localPort,
      label: f.label ?? undefined,
      autoStart: !!f.autoStart,
      enabled: !!f.enabled,
      status: !f.enabled ? 'off' : (l?.status ?? 'err'),
      error: f.enabled ? l?.error : undefined,
    };
  }
}

/** `ss -ltnpH`: `LISTEN 0 511 0.0.0.0:3000 0.0.0.0:* users:(("node",pid=12,fd=20))` → cổng + tên tiến trình, gộp IPv4/IPv6. */
export function parseSs(out: string): ListeningPortDto[] {
  const m = new Map<number, string>();
  for (const line of out.split('\n')) {
    const cols = line.trim().split(/\s+/);
    if (cols.length < 4) continue;
    const port = Number(cols[3].slice(cols[3].lastIndexOf(':') + 1));
    if (!port || port === 22) continue;
    const proc = /users:\(\("([^"]+)"/.exec(line)?.[1] ?? '';
    if (!m.has(port) || (!m.get(port) && proc)) m.set(port, proc);
  }
  return [...m].sort((a, b) => a[0] - b[0]).map(([port, proc]) => ({ port, proc }));
}

/** `lsof -iTCP -sTCP:LISTEN -nP`: `node 12 dev 20u IPv4 … TCP *:3000 (LISTEN)`. */
export function parseLsof(out: string): ListeningPortDto[] {
  const m = new Map<number, string>();
  for (const line of out.split('\n').slice(1)) {
    const port = Number(/:(\d+) \(LISTEN\)/.exec(line)?.[1]);
    if (port && port !== 22 && !m.has(port)) m.set(port, line.split(/\s+/)[0]);
  }
  return [...m].sort((a, b) => a[0] - b[0]).map(([port, proc]) => ({ port, proc }));
}
