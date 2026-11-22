import { HttpStatus, Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ErrorCode, HostAuthType, HostKind } from '@app/shared';
import { APP_CONFIG } from '../../config/app-config';
import type { AppConfig } from '../../config/app-config';
import { AppError } from '../../common/app-error';
import { CryptoService } from '../../common/crypto.service';
import type { AuthUser } from '../../common/auth-user';
import { LocalRuntime, SshRuntime, type HostRuntime } from '../../integrations/host/host-runtime';
import {
  removeHostBlock,
  SshConfigCache,
  SshConfigChangedError,
  writeHostBlock,
  type SshHostEntry,
} from '../../integrations/ssh/ssh-config';
import { SshError, SshPool, type SshTarget } from '../../integrations/ssh/ssh-pool';
import { HostsRepository } from './hosts.repository';
import type { HostDto, HostInputDto, HostListDto, HostPatchDto, SshKeyDto, TestResultDto } from './dto/hosts.dto';
import { HostMetaEntity } from './hosts.entities';

export const LOCAL_HOST_ID = 'local';
const TEST_VALID_MS = 15 * 60_000;

/** Nghe khi một máy bị xoá — workspace/terminal/claude dọn dữ liệu của máy đó. */
type HostRemovedListener = (hostId: string) => Promise<void> | void;

@Injectable()
export class HostsService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Hosts');
  readonly config: SshConfigCache;
  readonly pool: SshPool;
  private readonly local: LocalRuntime;
  private readonly runtimes = new Map<string, HostRuntime>();
  private knownCache: { host: string; port: number; keyType: string; fingerprint: string }[] = [];
  /** Lần Thử kết nối thành công gần nhất theo máy — điều kiện để đổi địa chỉ (AC-5). */
  private readonly lastTest = new Map<string, { hostName: string; port: number; user: string; at: number }>();
  private readonly removedListeners: HostRemovedListener[] = [];

  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    private readonly repo: HostsRepository,
    private readonly crypto: CryptoService,
  ) {
    this.config = new SshConfigCache(cfg.sshConfigPath);
    this.pool = new SshPool({ get: (host, port) => this.knownCache.filter((k) => k.host === host && k.port === port) });
    this.local = new LocalRuntime(cfg.allowedRoot);
  }

  async onModuleInit() {
    await this.reloadKnown();
  }

  onModuleDestroy() {
    this.pool.disconnectAll();
  }

  onHostRemoved(l: HostRemovedListener) {
    this.removedListeners.push(l);
  }

  private async reloadKnown() {
    const rows = await this.repo.allKnown();
    this.knownCache = rows.map((r) => ({ host: r.host, port: r.port, keyType: r.keyType, fingerprint: r.fingerprintSha256 }));
    // File known_hosts riêng cho đường OpenSSH dự phòng (UserKnownHostsFile) — 0600 (G-6)
    const lines = rows.map((r) => `# ${r.hostId} ${r.keyType} ${r.fingerprintSha256}`).join('\n');
    fs.writeFileSync(path.join(this.cfg.dataDir, 'known_hosts'), lines + '\n', { mode: 0o600 });
  }

  // ------------------------- đọc -------------------------

  private sshHosts(): { hosts: SshHostEntry[]; warnings: string[] } {
    return this.config.get();
  }

  findSsh(id: string): SshHostEntry | undefined {
    return this.sshHosts().hosts.find((h) => h.alias === id);
  }

  exists(id: string) {
    return id === LOCAL_HOST_ID || !!this.findSsh(id);
  }

  assertExists(id: string) {
    if (!this.exists(id)) throw AppError.notFound(ErrorCode.HOST_NOT_FOUND);
  }

  /** Thư mục bắt đầu của máy: local → WORKSPACE_ROOT; SSH → cấu hình riêng hoặc `~`. */
  async workspaceDir(id: string): Promise<string> {
    if (id === LOCAL_HOST_ID) return this.cfg.workspaceRoot;
    return (await this.repo.getMeta(id))?.workspaceDir ?? '~';
  }

  hostName(id: string): string {
    return id === LOCAL_HOST_ID ? os.hostname() : id;
  }

  async list(user: AuthUser): Promise<HostListDto> {
    const { hosts, warnings } = this.sshHosts();
    const metas = new Map((await this.repo.allMeta()).map((m) => [m.hostId, m]));
    const pinIds = await this.pins(user);
    const pinPos = new Map(pinIds.map((id, i) => [id, i]));
    const out: HostDto[] = [
      {
        id: LOCAL_HOST_ID,
        kind: HostKind.LOCAL,
        name: os.hostname(),
        hasSecret: false,
        workspaceDir: this.cfg.workspaceRoot,
        trusted: true,
        pinned: pinPos.has(LOCAL_HOST_ID),
        pinPosition: pinPos.get(LOCAL_HOST_ID),
      },
    ];
    for (const h of hosts) {
      const m = metas.get(h.alias);
      out.push({
        id: h.alias,
        kind: HostKind.SSH,
        name: h.alias,
        hostName: h.hostName,
        user: h.user,
        port: h.port,
        proxyJump: h.proxyJump,
        keyPath: h.identityFile,
        authType: (m?.authType as HostAuthType) ?? (h.identityFile ? HostAuthType.KEY : HostAuthType.AGENT),
        hasSecret: !!m?.secretEnc,
        workspaceDir: m?.workspaceDir ?? '~',
        trusted: this.knownCache.some((k) => k.host === h.hostName && k.port === h.port),
        pinned: pinPos.has(h.alias),
        pinPosition: pinPos.get(h.alias),
        configFile: h.file.replace(os.homedir(), '~'),
        dependents: hosts.filter((x) => x.proxyJump === h.alias).map((x) => x.alias),
      });
    }
    let configMtime = 0;
    try {
      configMtime = fs.statSync(this.cfg.sshConfigPath).mtimeMs;
    } catch {
      /* chưa có file */
    }
    return { hosts: out, warnings, configMtime };
  }

  // ------------------------- kết nối -------------------------

  /** Dựng SshTarget (kèm máy trung gian, bí mật đã giải mã) từ config + hosts_meta, có thể đè bằng giá trị đang sửa. */
  async target(id: string, override: Partial<HostInputDto & HostPatchDto> = {}, depth = 0): Promise<SshTarget> {
    if (depth > 3) throw AppError.badRequest(ErrorCode.VALIDATION_FAILED, { reason: 'proxyJump lồng quá sâu' });
    const h = this.findSsh(id);
    if (!h && !override.hostName) throw AppError.notFound(ErrorCode.HOST_NOT_FOUND);
    const meta = await this.repo.getMeta(id);
    let password: string | undefined;
    let passphrase: string | undefined;
    if (meta?.secretEnc) {
      const sec = JSON.parse(this.crypto.decrypt(meta.secretEnc)) as { password?: string; passphrase?: string };
      password = sec.password;
      passphrase = sec.passphrase;
    }
    const proxyJump = override.proxyJump !== undefined ? override.proxyJump || undefined : h?.proxyJump;
    return {
      id,
      hostName: override.hostName ?? h!.hostName,
      port: override.port ?? h?.port ?? 22,
      user: override.user ?? h?.user ?? os.userInfo().username,
      identityFile: override.keyPath ?? h?.identityFile,
      password: override.password || password,
      passphrase: override.passphrase || passphrase,
      jump: proxyJump ? await this.target(proxyJump, {}, depth + 1) : undefined,
    };
  }

  /** Máy để chạy lệnh/file/PTY — local hoặc SSH (đi qua pool). */
  async runtime(id: string): Promise<HostRuntime> {
    if (id === LOCAL_HOST_ID) return this.local;
    const cached = this.runtimes.get(id);
    if (cached) return cached;
    const rt = new SshRuntime(this.pool, await this.target(id));
    this.runtimes.set(id, rt);
    return rt;
  }

  /** Ánh xạ lỗi SSH ra khuôn lỗi api (G-3). */
  static mapSshError(e: unknown): never {
    if (e instanceof SshError) {
      const status = e.kind === 'HOST_KEY_UNKNOWN' || e.kind === 'HOST_KEY_CHANGED' ? HttpStatus.CONFLICT : HttpStatus.BAD_GATEWAY;
      throw new AppError(ErrorCode[e.kind], status, e.details);
    }
    throw e;
  }

  async test(id: string | undefined, override: HostPatchDto & { alias?: string }): Promise<TestResultDto> {
    const t = await this.target(id ?? override.alias ?? '_new', override).catch((e) => {
      if (!id && override.hostName) return this.target('_new', override);
      throw e;
    });
    try {
      const k = await this.pool.probe(t);
      const at = Date.now();
      if (id) this.lastTest.set(id, { hostName: t.hostName, port: t.port, user: t.user, at });
      return { ok: true, testedAt: new Date(at).toISOString(), fingerprint: k.fingerprint, keyType: k.keyType };
    } catch (e) {
      return HostsService.mapSshError(e);
    }
  }

  async trustKey(
    id: string,
    fingerprint: string,
    keyType: string,
    host?: string,
    port?: number,
    draft: { proxyJump?: string; user?: string } = {},
  ) {
    const h = this.findSsh(id);
    const hostName = host ?? h?.hostName;
    const p = port ?? h?.port ?? 22;
    if (!hostName) throw AppError.notFound(ErrorCode.HOST_NOT_FOUND);
    // Chỉ tin đúng vân tay đang thấy — gửi vân tay khác → từ chối (AC-6)
    const t = await this.target(
      id,
      host
        ? {
            hostName: host,
            port: p,
            ...(draft.proxyJump !== undefined ? { proxyJump: draft.proxyJump } : {}),
            ...(draft.user ? { user: draft.user } : {}),
          }
        : {},
    );
    let seen: { fingerprint: string; keyType: string } | undefined;
    try {
      seen = await this.pool.probe(t);
    } catch (e) {
      if (e instanceof SshError && (e.kind === 'HOST_KEY_UNKNOWN' || e.kind === 'HOST_KEY_CHANGED')) {
        seen = { fingerprint: String(e.details.fingerprint), keyType: String(e.details.keyType) };
      } else if (e instanceof SshError && e.kind === 'SSH_AUTH_FAILED') {
        seen = undefined; // khoá máy đã thấy qua hostVerifier trước bước xác thực
      } else HostsService.mapSshError(e);
    }
    if (seen && (seen.fingerprint !== fingerprint || seen.keyType !== keyType)) throw AppError.conflict(ErrorCode.HOST_KEY_CHANGED, seen);
    await this.repo.trust({
      hostId: id,
      host: hostName,
      port: p,
      keyType,
      fingerprintSha256: fingerprint,
      trustedAt: new Date().toISOString(),
    });
    await this.reloadKnown();
    this.pool.disconnect(id);
  }

  disconnect(id: string) {
    this.pool.disconnect(id);
    this.runtimes.delete(id);
  }

  // ------------------------- ghi -------------------------

  private async saveMeta(id: string, d: Partial<HostInputDto & HostPatchDto>, keepSecret: boolean) {
    const cur = await this.repo.getMeta(id);
    let secretEnc = cur?.secretEnc ?? null;
    if (d.password || d.passphrase || !keepSecret) {
      const old = cur?.secretEnc ? (JSON.parse(this.crypto.decrypt(cur.secretEnc)) as { password?: string; passphrase?: string }) : {};
      const next = {
        password: d.password || (keepSecret ? old.password : undefined),
        passphrase: d.passphrase || (keepSecret ? old.passphrase : undefined),
      };
      secretEnc = next.password || next.passphrase ? this.crypto.encrypt(JSON.stringify(next)) : null;
    }
    const m: HostMetaEntity = Object.assign(new HostMetaEntity(), {
      hostId: id,
      workspaceDir: d.workspaceDir || cur?.workspaceDir || null,
      authType: d.authType ?? cur?.authType ?? null,
      secretEnc,
      updatedAt: new Date().toISOString(),
    });
    await this.repo.saveMeta(m);
  }

  private writeBlock(
    file: string,
    d: { alias: string; hostName: string; user?: string; port?: number; keyPath?: string; proxyJump?: string },
    expectMtime?: number,
  ) {
    try {
      writeHostBlock(
        file,
        { alias: d.alias, hostName: d.hostName, user: d.user, port: d.port, identityFile: d.keyPath, proxyJump: d.proxyJump || undefined },
        expectMtime,
      );
      this.config.invalidate();
    } catch (e) {
      if (e instanceof SshConfigChangedError) {
        this.config.invalidate();
        throw AppError.conflict(ErrorCode.SSH_CONFIG_CHANGED);
      }
      throw AppError.badRequest(ErrorCode.VALIDATION_FAILED, { reason: (e as Error).message });
    }
  }

  async create(d: HostInputDto): Promise<HostDto> {
    if (d.alias === LOCAL_HOST_ID || this.findSsh(d.alias)) throw AppError.conflict(ErrorCode.HOST_ALIAS_TAKEN);
    if (d.proxyJump && !this.findSsh(d.proxyJump)) throw AppError.badRequest(ErrorCode.HOST_NOT_FOUND, { field: 'proxyJump' });
    this.writeBlock(this.cfg.sshConfigPath, { ...d, keyPath: d.authType === HostAuthType.KEY ? d.keyPath : undefined });
    await this.saveMeta(d.alias, d, false);
    this.log.log(`Thêm máy ${d.alias}`);
    return this.one(d.alias);
  }

  async update(id: string, d: HostPatchDto): Promise<HostDto> {
    const h = this.findSsh(id);
    if (!h) throw AppError.notFound(ErrorCode.HOST_NOT_FOUND);
    const next = { hostName: d.hostName ?? h.hostName, port: d.port ?? h.port, user: d.user ?? h.user ?? '' };
    const addressChanged = next.hostName !== h.hostName || next.port !== h.port || next.user !== (h.user ?? '');
    if (addressChanged) {
      const t = this.lastTest.get(id);
      const ok = t && t.hostName === next.hostName && t.port === next.port && t.user === next.user && Date.now() - t.at < TEST_VALID_MS;
      if (!ok) throw AppError.conflict(ErrorCode.HOST_TEST_REQUIRED);
    }
    if (d.proxyJump && (d.proxyJump === id || !this.findSsh(d.proxyJump)))
      throw AppError.badRequest(ErrorCode.HOST_NOT_FOUND, { field: 'proxyJump' });
    this.writeBlock(h.file, {
      alias: id,
      ...next,
      keyPath: (d.authType ?? HostAuthType.KEY) === HostAuthType.KEY ? d.keyPath || h.identityFile : undefined,
      proxyJump: d.proxyJump !== undefined ? d.proxyJump : h.proxyJump,
    });
    await this.saveMeta(id, d, true);
    this.disconnect(id);
    return this.one(id);
  }

  /** Số dự án/phiên bị ảnh hưởng do module khác cung cấp — dùng cho hộp xác nhận. */
  async remove(id: string) {
    if (id === LOCAL_HOST_ID) throw AppError.forbidden();
    const h = this.findSsh(id);
    if (!h) throw AppError.notFound(ErrorCode.HOST_NOT_FOUND);
    const dependents = this.sshHosts()
      .hosts.filter((x) => x.proxyJump === id)
      .map((x) => x.alias);
    if (dependents.length) throw AppError.conflict(ErrorCode.HOST_IS_JUMP, { dependents });
    this.disconnect(id);
    for (const l of this.removedListeners) await l(id);
    try {
      removeHostBlock(h.file, id);
    } catch (e) {
      if (e instanceof SshConfigChangedError) throw AppError.conflict(ErrorCode.SSH_CONFIG_CHANGED);
      throw e;
    }
    this.config.invalidate();
    await this.repo.deleteMeta(id);
    await this.repo.deleteKnownForHost(id);
    await this.repo.deletePinsForHost(id);
    await this.reloadKnown();
  }

  async one(id: string): Promise<HostDto> {
    const list = await this.list({ id: '', role: 'owner' as never, familyId: '', mustChangePassword: false });
    const h = list.hosts.find((x) => x.id === id);
    if (!h) throw AppError.notFound(ErrorCode.HOST_NOT_FOUND);
    return h;
  }

  sshKeys(): SshKeyDto[] {
    const dir = path.join(os.homedir(), '.ssh');
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.pub') && fs.existsSync(path.join(dir, f.slice(0, -4))))
      .map((f) => {
        const [type, , comment] = fs.readFileSync(path.join(dir, f), 'utf8').trim().split(/\s+/);
        return { path: `~/.ssh/${f.slice(0, -4)}`, type, comment };
      });
  }

  // ------------------------- ghim -------------------------

  /** Chưa ghim gì bao giờ → "Máy này" được ghim sẵn để cây không trống ở lần đầu. */
  async pins(user: AuthUser): Promise<string[]> {
    const rows = await this.repo.pinsOf(user.id);
    return rows.length ? rows.map((p) => p.hostId) : [LOCAL_HOST_ID];
  }

  async setPins(user: AuthUser, hostIds: string[]) {
    const valid = [...new Set(hostIds)].filter((id) => this.exists(id)); // máy đã xoá → bỏ qua
    await this.repo.replacePins(user.id, valid);
    return valid;
  }
}
