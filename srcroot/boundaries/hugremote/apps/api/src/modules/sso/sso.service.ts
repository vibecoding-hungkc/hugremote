import { Inject, Injectable, Logger } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { ErrorCode } from '@app/shared';
import { AppError } from '../../common/app-error';
import { CryptoService } from '../../common/crypto.service';
import { APP_CONFIG } from '../../config/app-config';
import type { AppConfig } from '../../config/app-config';
import {
  assertSafeIssuer,
  authorizeUrl,
  discover,
  emailAllowed,
  exchange,
  GOOGLE_ISSUER,
  OidcError,
  pkce,
} from '../../integrations/oidc/oidc';
import { UserEntity } from '../auth/auth.entities';
import { AuthRepository } from '../auth/auth.repository';
import { AuthService, type ClientCtx, type IssuedSession } from '../auth/auth.service';
import { ClaudeService } from '../claude/claude.service';
import { TerminalService } from '../terminal/terminal.service';
import { SsoConfigEntity } from './sso.entities';
import { SsoRepository } from './sso.repository';

type Provider = 'google' | 'oidc';
interface Pending {
  provider: Provider;
  verifier: string;
  nonce: string;
  returnTo: string;
  at: number;
}
export interface SsoConfigInput {
  provider: Provider;
  issuerUrl?: string;
  clientId: string;
  clientSecret?: string;
  allowedEmails: string[];
  buttonLabel?: string;
  enabled: boolean;
}

const now = () => new Date().toISOString();
/** Chỉ cho quay về hash nội bộ `#/…` (G-11, chặn open redirect). */
const safeReturn = (r?: string) => (r && /^#\/[^\s]*$/.test(r) && !r.startsWith('#//') ? r : '#/');

/** SSO nhóm (AC-32), thành viên + thu hồi + lần bị từ chối (AC-45). Owner vẫn đăng nhập mật khẩu. */
@Injectable()
export class SsoService {
  private readonly log = new Logger('Sso');
  private readonly pending = new Map<string, Pending>();

  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    private readonly repo: SsoRepository,
    private readonly users: AuthRepository,
    private readonly auth: AuthService,
    private readonly crypto: CryptoService,
    private readonly claude: ClaudeService,
    private readonly terminals: TerminalService,
  ) {}

  private get devLocal() {
    return this.cfg.env !== 'production';
  }

  callbackUrl(provider: Provider) {
    return `${this.cfg.appUrl.replace(/\/+$/, '')}${this.cfg.basePath}/api/auth/sso/${provider}/callback`;
  }

  private issuerOf(c: SsoConfigEntity) {
    return c.provider === 'google' ? GOOGLE_ISSUER : (c.issuerUrl ?? '');
  }

  private async active(): Promise<SsoConfigEntity | null> {
    return (await this.repo.allConfigs()).find((c) => c.enabled) ?? null;
  }

  // ------------------------------------------------------------ cấu hình (owner)

  async getConfig() {
    const all = await this.repo.allConfigs();
    const c = all.find((x) => x.enabled) ?? all[0];
    const provider: Provider = c?.provider ?? 'oidc';
    return {
      provider,
      issuerUrl: c?.issuerUrl ?? '',
      clientId: c?.clientId ?? '',
      hasSecret: !!c?.clientSecretEnc,
      allowedEmails: JSON.parse(c?.allowedEmails ?? '[]') as string[],
      buttonLabel: c?.buttonLabel ?? '',
      enabled: !!c?.enabled,
      callbackUrls: { oidc: this.callbackUrl('oidc'), google: this.callbackUrl('google') },
    };
  }

  /** Thử discovery với Issuer (OIDC) — chỉ https, chặn IP nội bộ. */
  async discover(provider: Provider, issuerUrl?: string) {
    const issuer = provider === 'google' ? GOOGLE_ISSUER : (issuerUrl ?? '').trim();
    try {
      await assertSafeIssuer(issuer, this.devLocal);
      const m = await discover(issuer);
      return { ok: true, issuer: m.issuer, authorizationEndpoint: m.authorization_endpoint };
    } catch (e) {
      throw AppError.badRequest(ErrorCode.SSO_FAILED, { reason: (e as Error).message });
    }
  }

  async saveConfig(d: SsoConfigInput) {
    const prev = await this.repo.getConfig(d.provider);
    if (d.provider === 'oidc') await this.discover('oidc', d.issuerUrl);
    const allow = [...new Set(d.allowedEmails.map((x) => x.trim().toLowerCase()).filter(Boolean))];
    const c: SsoConfigEntity = Object.assign(new SsoConfigEntity(), {
      provider: d.provider,
      issuerUrl: d.provider === 'oidc' ? (d.issuerUrl ?? '').trim().replace(/\/+$/, '') : null,
      clientId: d.clientId.trim(),
      clientSecretEnc: d.clientSecret ? this.crypto.encrypt(d.clientSecret) : (prev?.clientSecretEnc ?? null),
      allowedEmails: JSON.stringify(allow),
      buttonLabel: d.buttonLabel?.trim() || null,
      enabled: d.enabled ? 1 : 0,
    });
    if (d.enabled && !c.clientSecretEnc) throw AppError.badRequest(ErrorCode.VALIDATION_FAILED, { field: 'clientSecret' });
    if (d.enabled) await this.repo.disableAll(); // một nhà cung cấp bật tại một thời điểm
    await this.repo.saveConfig(c);
    this.log.log(`Owner ${d.enabled ? 'bật' : 'lưu'} SSO ${d.provider} (${allow.length} mục được phép)`);
    return this.getConfig();
  }

  async disable() {
    await this.repo.disableAll();
    this.log.log('Owner tắt SSO');
  }

  /** Cho trang đăng nhập (công khai): có SSO không, nhãn nút. */
  async publicInfo() {
    const c = await this.active();
    return c
      ? { enabled: true, provider: c.provider, label: c.buttonLabel ?? (c.provider === 'google' ? 'Google' : 'SSO') }
      : { enabled: false };
  }

  // ------------------------------------------------------------ luồng đăng nhập

  async start(provider: Provider, returnTo?: string): Promise<string> {
    const c = await this.active();
    if (!c || c.provider !== provider || !c.clientId) throw AppError.badRequest(ErrorCode.SSO_DISABLED);
    const meta = await discover(this.issuerOf(c)).catch((e: Error) => {
      throw AppError.badRequest(ErrorCode.SSO_FAILED, { reason: e.message });
    });
    for (const [k, v] of this.pending) if (Date.now() - v.at > 10 * 60_000) this.pending.delete(k);
    const state = crypto.randomBytes(24).toString('base64url');
    const nonce = crypto.randomBytes(16).toString('base64url');
    const { verifier, challenge } = pkce();
    this.pending.set(state, { provider, verifier, nonce, returnTo: safeReturn(returnTo), at: Date.now() });
    return authorizeUrl(meta, { clientId: c.clientId, redirectUri: this.callbackUrl(provider), state, nonce, challenge });
  }

  /** Trả phiên đăng nhập + hash để về; lỗi → `code` để web hiện câu báo trên S1. */
  async callback(
    provider: Provider,
    q: { code?: string; state?: string; error?: string },
    ctx: ClientCtx,
  ): Promise<{ session?: IssuedSession; returnTo: string; error?: ErrorCode }> {
    const p = q.state ? this.pending.get(q.state) : undefined;
    if (q.state) this.pending.delete(q.state);
    if (!p || p.provider !== provider || Date.now() - p.at > 10 * 60_000) return { returnTo: '#/', error: ErrorCode.SSO_FAILED };
    if (q.error || !q.code) return { returnTo: p.returnTo, error: ErrorCode.SSO_FAILED };
    const c = await this.active();
    if (!c || c.provider !== provider) return { returnTo: p.returnTo, error: ErrorCode.SSO_DISABLED };
    let who: { email: string };
    try {
      const meta = await discover(this.issuerOf(c));
      who = await exchange(meta, {
        clientId: c.clientId!,
        clientSecret: this.crypto.decrypt(c.clientSecretEnc!),
        redirectUri: this.callbackUrl(provider),
        code: q.code,
        verifier: p.verifier,
        nonce: p.nonce,
      });
    } catch (e) {
      this.log.warn(`SSO ${provider}: ${(e as Error).message}`);
      if (e instanceof OidcError) await this.repo.addDenial({ email: '(không rõ)', provider, reason: 'token_invalid', at: now() });
      return { returnTo: p.returnTo, error: ErrorCode.SSO_FAILED };
    }
    const allow = JSON.parse(c.allowedEmails) as string[];
    if (!emailAllowed(who.email, allow)) {
      await this.repo.addDenial({ email: who.email, provider, reason: 'not_allowed', at: now() });
      this.log.warn(`Từ chối SSO ${who.email} — không có trong danh sách được phép`);
      return { returnTo: p.returnTo, error: ErrorCode.SSO_EMAIL_NOT_ALLOWED };
    }
    let user = await this.users.findUserByEmail(who.email);
    if (user?.role === 'owner') {
      // SSO chỉ dành cho thành viên; owner đăng nhập bằng mật khẩu (+2FA) — không cho SSO vượt qua 2FA của owner
      return { returnTo: p.returnTo, error: ErrorCode.SSO_FAILED };
    }
    if (user?.revokedAt) {
      await this.repo.addDenial({ email: who.email, provider, reason: 'revoked', at: now() });
      this.log.warn(`Từ chối SSO ${who.email} — đã bị thu hồi`);
      return { returnTo: p.returnTo, error: ErrorCode.SSO_EMAIL_NOT_ALLOWED };
    }
    if (!user) {
      user = Object.assign(new UserEntity(), {
        id: crypto.randomUUID(),
        role: 'member',
        email: who.email,
        passwordHash: null,
        passwordSalt: null,
        mustChangePassword: 0,
        preferences: '{}',
        lastLoginAt: null,
        revokedAt: null,
        createdAt: now(),
      });
      await this.users.saveUser(user);
    }
    this.log.log(`${who.email} đăng nhập bằng SSO ${provider}`);
    return { session: await this.auth.issue(user, ctx), returnTo: p.returnTo };
  }

  // ------------------------------------------------------------ thành viên (owner)

  async members() {
    const list = await this.users.listMembers();
    return Promise.all(
      list.map(async (m) => ({
        id: m.id,
        email: m.email ?? '',
        lastLoginAt: m.lastLoginAt,
        revokedAt: m.revokedAt,
        running: (await this.claude.runningOf(m.id)) + (await this.terminals.runningOf(m.id)),
      })),
    );
  }

  /** Thu hồi: chặn đăng nhập, đăng xuất mọi thiết bị, dừng mọi phiên đang chạy của người đó (AC-45). */
  async revoke(id: string) {
    const m = await this.users.findUser(id);
    if (!m || m.role !== 'member') throw AppError.notFound();
    const at = now();
    await this.users.updateUser(id, { revokedAt: at });
    await this.users.revokeAllForUser(id, at);
    await this.claude.stopAllOf(id);
    await this.terminals.stopAllOf(id);
    this.log.log(`Owner thu hồi ${m.email}`);
  }

  async restore(id: string) {
    const m = await this.users.findUser(id);
    if (!m || m.role !== 'member') throw AppError.notFound();
    await this.users.updateUser(id, { revokedAt: null });
  }

  denials() {
    return this.repo.listDenials();
  }

  /** "Cho phép" từ danh sách bị từ chối: thêm email vào allowlist của nhà cung cấp đang bật. */
  async allowEmail(email: string) {
    const c = await this.active();
    if (!c) throw AppError.badRequest(ErrorCode.SSO_DISABLED);
    const allow = new Set(JSON.parse(c.allowedEmails) as string[]);
    allow.add(email.trim().toLowerCase());
    c.allowedEmails = JSON.stringify([...allow]);
    await this.repo.saveConfig(c);
    await this.repo.removeDenialsOf(email);
    const u = await this.users.findUserByEmail(email.toLowerCase());
    if (u?.revokedAt) await this.users.updateUser(u.id, { revokedAt: null });
    return this.getConfig();
  }
}
