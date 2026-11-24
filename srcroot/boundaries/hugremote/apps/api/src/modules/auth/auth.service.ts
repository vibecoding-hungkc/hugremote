import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'node:crypto';
import * as QRCode from 'qrcode';
import { ErrorCode, LIMITS, UserRole } from '@app/shared';
import { APP_CONFIG } from '../../config/app-config';
import type { AppConfig } from '../../config/app-config';
import { AppError } from '../../common/app-error';
import { CryptoService } from '../../common/crypto.service';
import { newTotpSecret, otpauthUri, verifyTotp } from '../../common/totp';
import type { AuthUser } from '../../common/auth-user';
import { AuthRepository } from './auth.repository';
import { UserEntity } from './auth.entities';
import type {
  DeviceDto,
  MeResponseDto,
  PreferencesDto,
  PreferencesPatchDto,
  SessionResponseDto,
  TwoFactorSetupResponseDto,
} from './dto/auth.dto';

export interface ClientCtx {
  ip?: string;
  userAgent?: string;
}

/** Nội dung access token. `stage` = `full` mới vào được app; `2fa` chỉ dùng cho bước nhập mã. */
interface AccessClaims {
  sub: string;
  role: UserRole;
  fam: string;
  mcp: boolean;
  stage: 'full' | '2fa';
}

export interface IssuedSession {
  body: SessionResponseDto;
  refreshToken?: string;
}

interface Ticket {
  user: AuthUser;
  expiresAt: number;
}

const iso = (d = new Date()) => d.toISOString();
const addDays = (n: number) => new Date(Date.now() + n * 86_400_000);

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly log = new Logger('Auth');
  private readonly tickets = new Map<string, Ticket>();

  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    private readonly repo: AuthRepository,
    private readonly crypto: CryptoService,
    private readonly jwt: JwtService,
  ) {}

  /** Lần chạy đầu: tạo tài khoản owner với mật khẩu khởi tạo, bắt đổi ở lần đăng nhập đầu (AC-1). */
  async onModuleInit() {
    if (await this.repo.findOwner()) return;
    const password = this.cfg.authPassword ?? this.crypto.randomPassword(16);
    const { hash, salt } = this.crypto.hashPassword(password);
    const u = Object.assign(new UserEntity(), {
      id: crypto.randomUUID(),
      role: 'owner',
      email: null,
      passwordHash: hash,
      passwordSalt: salt,
      mustChangePassword: 1,
      preferences: '{}',
      lastLoginAt: null,
      revokedAt: null,
      createdAt: iso(),
    });
    await this.repo.saveUser(u);
    if (!this.cfg.authPassword) {
      // In ra đúng một lần — người cài đọc ở log khởi động (install.sh in lại dòng này)
      this.log.warn(`Mật khẩu khởi tạo: ${password} — đăng nhập rồi đổi ngay`);
    }
  }

  // ---------- khoá đăng nhập (5 lần / 15 phút, đếm riêng mật khẩu và 2FA) ----------

  private async assertNotLocked(key: string) {
    const a = await this.repo.getAttempt(key);
    if (a?.lockedUntil && new Date(a.lockedUntil).getTime() > Date.now()) {
      throw AppError.locked(Math.ceil((new Date(a.lockedUntil).getTime() - Date.now()) / 1000));
    }
  }

  private async recordFail(key: string) {
    const a = (await this.repo.getAttempt(key)) ?? { key, failCount: 0, lockedUntil: null };
    const expired = a.lockedUntil && new Date(a.lockedUntil).getTime() <= Date.now();
    a.failCount = (expired ? 0 : a.failCount) + 1;
    a.lockedUntil = null;
    if (a.failCount >= this.cfg.authMaxAttempts) {
      a.lockedUntil = iso(new Date(Date.now() + this.cfg.authLockMinutes * 60_000));
    }
    await this.repo.saveAttempt(a);
    if (a.lockedUntil) throw AppError.locked(this.cfg.authLockMinutes * 60);
    return this.cfg.authMaxAttempts - a.failCount;
  }

  // ---------- đăng nhập ----------

  async login(password: string, ctx: ClientCtx): Promise<IssuedSession> {
    const key = `${ctx.ip ?? '-'}:password`;
    await this.assertNotLocked(key);
    const owner = await this.repo.findOwner();
    if (!owner?.passwordHash || !owner.passwordSalt || !this.crypto.verifyPassword(password, owner.passwordHash, owner.passwordSalt)) {
      const remaining = await this.recordFail(key);
      this.log.warn(`Đăng nhập sai mật khẩu từ ${ctx.ip ?? '?'} (còn ${remaining} lần)`);
      throw AppError.unauthorized(ErrorCode.INVALID_CREDENTIALS, { remaining });
    }
    await this.repo.clearAttempt(key);
    this.log.log(`Owner đăng nhập bằng mật khẩu từ ${ctx.ip ?? '?'}`);
    const tfa = await this.repo.getTwoFactor(owner.id);
    if (tfa?.enabled) {
      const pendingToken = await this.jwt.signAsync(
        { sub: owner.id, role: owner.role as UserRole, fam: '', mcp: !!owner.mustChangePassword, stage: '2fa' } satisfies AccessClaims,
        { expiresIn: '5m' },
      );
      return { body: { needs2fa: true, pendingToken, mustChangePassword: !!owner.mustChangePassword } };
    }
    return this.issue(owner, ctx);
  }

  async verifyTwoFactor(pendingToken: string, code: string, ctx: ClientCtx): Promise<IssuedSession> {
    let claims: AccessClaims;
    try {
      claims = await this.jwt.verifyAsync<AccessClaims>(pendingToken);
    } catch {
      throw AppError.unauthorized(ErrorCode.TWO_FACTOR_INVALID);
    }
    if (claims.stage !== '2fa') throw AppError.unauthorized(ErrorCode.TWO_FACTOR_INVALID);
    const key = `${ctx.ip ?? '-'}:2fa`;
    await this.assertNotLocked(key);
    const user = await this.repo.findUser(claims.sub);
    if (!user || !(await this.checkSecondFactor(user.id, code, true))) {
      const remaining = await this.recordFail(key);
      throw AppError.unauthorized(ErrorCode.TWO_FACTOR_INVALID, { remaining });
    }
    await this.repo.clearAttempt(key);
    return this.issue(user, ctx);
  }

  /** Mã TOTP hiện tại hoặc một mã khôi phục (dùng một lần). */
  private async checkSecondFactor(userId: string, code: string, consumeRecovery: boolean): Promise<boolean> {
    const tfa = await this.repo.getTwoFactor(userId);
    if (!tfa?.enabled || !tfa.secretEnc) return false;
    const clean = code.replace(/\s|-/g, '');
    if (/^\d{6}$/.test(clean) && verifyTotp(this.crypto.decrypt(tfa.secretEnc), clean)) return true;
    const hashes = JSON.parse(tfa.recoveryCodeHashes || '[]') as string[];
    const h = this.crypto.sha256(clean.toLowerCase());
    const i = hashes.indexOf(h);
    if (i < 0) return false;
    if (consumeRecovery) {
      hashes.splice(i, 1);
      tfa.recoveryCodeHashes = JSON.stringify(hashes);
      await this.repo.saveTwoFactor(tfa);
    }
    return true;
  }

  /** SSO và đăng nhập mật khẩu dùng chung — tạo family (thiết bị) mới. */
  async issue(user: UserEntity, ctx: ClientCtx, familyId: string = crypto.randomUUID(), mcpOverride?: boolean): Promise<IssuedSession> {
    const refreshToken = this.crypto.randomToken(32);
    const now = iso();
    await this.repo.insertToken({
      id: crypto.randomUUID(),
      userId: user.id,
      familyId,
      tokenHash: this.crypto.sha256(refreshToken),
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent?.slice(0, 300) ?? null,
      createdAt: now,
      expiresAt: iso(addDays(LIMITS.REFRESH_TOKEN_DAYS)),
      lastUsedAt: now,
      revokedAt: null,
    });
    await this.repo.updateUser(user.id, { lastLoginAt: now });
    const mustChange = mcpOverride !== undefined ? mcpOverride : !!user.mustChangePassword;
    const accessToken = await this.signAccess(user, familyId, mustChange);
    return { body: { accessToken, needs2fa: false, mustChangePassword: mustChange }, refreshToken };
  }

  private signAccess(user: UserEntity, familyId: string, mustChangePassword?: boolean) {
    const claims: AccessClaims = {
      sub: user.id,
      role: user.role as UserRole,
      fam: familyId,
      mcp: mustChangePassword !== undefined ? mustChangePassword : !!user.mustChangePassword,
      stage: 'full',
    };
    return this.jwt.signAsync(claims, { expiresIn: `${LIMITS.ACCESS_TOKEN_MINUTES}m` });
  }

  /** Xoay refresh token, trượt 14 ngày; token cũ bị dùng lại → thu hồi cả family (AC-2). */
  async refresh(raw: string | undefined, ctx: ClientCtx): Promise<IssuedSession> {
    if (!raw) throw AppError.unauthorized(ErrorCode.REFRESH_INVALID);
    const t = await this.repo.findTokenByHash(this.crypto.sha256(raw));
    if (!t) throw AppError.unauthorized(ErrorCode.REFRESH_INVALID);
    const now = iso();
    if (t.revokedAt) {
      await this.repo.revokeFamily(t.familyId, now);
      throw AppError.unauthorized(ErrorCode.REFRESH_INVALID);
    }
    if (t.expiresAt <= now) throw AppError.unauthorized(ErrorCode.REFRESH_INVALID);
    const user = await this.repo.findUser(t.userId);
    if (!user || user.revokedAt) throw AppError.unauthorized(ErrorCode.REFRESH_INVALID);
    await this.repo.updateToken(t.id, { revokedAt: now, lastUsedAt: now });
    const next = this.crypto.randomToken(32);
    await this.repo.insertToken({
      id: crypto.randomUUID(),
      userId: user.id,
      familyId: t.familyId,
      tokenHash: this.crypto.sha256(next),
      ip: ctx.ip ?? t.ip,
      userAgent: ctx.userAgent?.slice(0, 300) ?? t.userAgent,
      createdAt: now,
      expiresAt: iso(addDays(LIMITS.REFRESH_TOKEN_DAYS)),
      lastUsedAt: now,
      revokedAt: null,
    });
    const accessToken = await this.signAccess(user, t.familyId);
    return { body: { accessToken, needs2fa: false, mustChangePassword: !!user.mustChangePassword }, refreshToken: next };
  }

  async logout(raw: string | undefined, user?: AuthUser) {
    const now = iso();
    if (user?.familyId) await this.repo.revokeFamily(user.familyId, now);
    if (raw) {
      const t = await this.repo.findTokenByHash(this.crypto.sha256(raw));
      if (t) await this.repo.revokeFamily(t.familyId, now);
    }
  }

  // ---------- kiểm access token (guard gọi) ----------

  /** Trả AuthUser khi token hợp lệ, user còn hiệu lực và thiết bị (family) chưa bị đăng xuất. */
  async authenticate(token: string): Promise<AuthUser | null> {
    let c: AccessClaims;
    try {
      c = await this.jwt.verifyAsync<AccessClaims>(token);
    } catch {
      return null;
    }
    if (c.stage !== 'full') return null;
    const user = await this.repo.findUser(c.sub);
    if (!user || user.revokedAt) return null;
    if (!(await this.repo.familyActive(c.fam, iso()))) return null;
    return {
      id: user.id,
      role: user.role as UserRole,
      email: user.email ?? undefined,
      familyId: c.fam,
      mustChangePassword: c.mcp && !!user.mustChangePassword,
    };
  }

  /** AUTH_MODE=none (chỉ loopback): mọi request là owner. */
  async localOwner(): Promise<AuthUser | null> {
    const o = await this.repo.findOwner();
    return o ? { id: o.id, role: UserRole.OWNER, familyId: 'local', mustChangePassword: false } : null;
  }

  /** Tạo session đầy đủ cho app Electron chạy trên loopback qua secret token (AC-51). */
  async issueDesktopSession(ctx: ClientCtx): Promise<IssuedSession> {
    const o = await this.repo.findOwner();
    if (!o) throw AppError.unauthorized();
    return this.issue(o, ctx, undefined, false);
  }

  async me(u: AuthUser): Promise<MeResponseDto> {
    const user = await this.repo.findUser(u.id);
    if (!user) throw AppError.unauthorized();
    const tfa = await this.repo.getTwoFactor(u.id);
    return {
      id: user.id,
      role: user.role as UserRole,
      email: user.email ?? undefined,
      mustChangePassword: u.mustChangePassword,
      twoFactorEnabled: !!tfa?.enabled,
      recoveryCodesLeft: tfa?.enabled ? (JSON.parse(tfa.recoveryCodeHashes || '[]') as string[]).length : 0,
      preferences: this.parsePrefs(user.preferences),
    };
  }

  // ---------- mật khẩu ----------

  async changePassword(u: AuthUser, current: string, next: string): Promise<IssuedSession> {
    const user = await this.repo.findUser(u.id);
    if (!user?.passwordHash || !user.passwordSalt) throw AppError.forbidden();
    const key = `user:${u.id}:password`;
    await this.assertNotLocked(key);
    if (!this.crypto.verifyPassword(current, user.passwordHash, user.passwordSalt)) {
      const remaining = await this.recordFail(key);
      throw AppError.unauthorized(ErrorCode.INVALID_CREDENTIALS, { remaining });
    }
    await this.repo.clearAttempt(key);
    if (next.length < LIMITS.PASSWORD_MIN_LENGTH)
      throw AppError.badRequest(ErrorCode.PASSWORD_TOO_WEAK, { min: LIMITS.PASSWORD_MIN_LENGTH });
    if (this.crypto.verifyPassword(next, user.passwordHash, user.passwordSalt)) throw AppError.badRequest(ErrorCode.PASSWORD_REUSED);
    const { hash, salt } = this.crypto.hashPassword(next);
    await this.repo.updateUser(user.id, { passwordHash: hash, passwordSalt: salt, mustChangePassword: 0 });
    // Đổi mật khẩu → mọi thiết bị khác phải đăng nhập lại (AC-44)
    await this.repo.revokeAllForUser(user.id, iso(), u.familyId);
    const fresh = (await this.repo.findUser(user.id))!;
    return { body: { accessToken: await this.signAccess(fresh, u.familyId), needs2fa: false, mustChangePassword: false } };
  }

  // ---------- 2FA (AC-3) ----------

  async setupTwoFactor(u: AuthUser): Promise<TwoFactorSetupResponseDto> {
    const secret = newTotpSecret();
    const tfa = (await this.repo.getTwoFactor(u.id)) ?? {
      userId: u.id,
      enabled: 0,
      secretEnc: null,
      pendingSecretEnc: null,
      recoveryCodeHashes: '[]',
    };
    if (tfa.enabled) throw AppError.conflict(ErrorCode.CONFIRM_REQUIRED);
    tfa.pendingSecretEnc = this.crypto.encrypt(secret);
    await this.repo.saveTwoFactor(tfa);
    const uri = otpauthUri(secret, u.email ?? 'owner');
    const qrSvg = await QRCode.toString(uri, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 });
    return { secret, otpauthUri: uri, qrSvg };
  }

  async enableTwoFactor(u: AuthUser, code: string): Promise<string[]> {
    const tfa = await this.repo.getTwoFactor(u.id);
    if (!tfa?.pendingSecretEnc) throw AppError.badRequest(ErrorCode.TWO_FACTOR_INVALID);
    const secret = this.crypto.decrypt(tfa.pendingSecretEnc);
    if (!verifyTotp(secret, code.trim())) throw AppError.badRequest(ErrorCode.TWO_FACTOR_INVALID);
    const codes = this.newRecoveryCodes();
    tfa.enabled = 1;
    tfa.secretEnc = tfa.pendingSecretEnc;
    tfa.pendingSecretEnc = null;
    tfa.recoveryCodeHashes = JSON.stringify(codes.map((c) => this.crypto.sha256(c.replace('-', ''))));
    await this.repo.saveTwoFactor(tfa);
    return codes;
  }

  /** Tắt 2FA cần mã hiện tại hoặc mã khôi phục (DECISIONS D11). */
  async disableTwoFactor(u: AuthUser, code: string) {
    if (!(await this.checkSecondFactor(u.id, code, true))) throw AppError.badRequest(ErrorCode.TWO_FACTOR_INVALID);
    await this.repo.saveTwoFactor({ userId: u.id, enabled: 0, secretEnc: null, pendingSecretEnc: null, recoveryCodeHashes: '[]' });
  }

  /** Bộ mã khôi phục mới — bộ cũ hết hiệu lực; chỉ trả một lần. */
  async regenerateRecoveryCodes(u: AuthUser, code: string): Promise<string[]> {
    if (!(await this.checkSecondFactor(u.id, code, true))) throw AppError.badRequest(ErrorCode.TWO_FACTOR_INVALID);
    const tfa = (await this.repo.getTwoFactor(u.id))!;
    const codes = this.newRecoveryCodes();
    tfa.recoveryCodeHashes = JSON.stringify(codes.map((c) => this.crypto.sha256(c.replace('-', ''))));
    await this.repo.saveTwoFactor(tfa);
    return codes;
  }

  private newRecoveryCodes(): string[] {
    return Array.from({ length: LIMITS.RECOVERY_CODES }, () => {
      const s = crypto.randomBytes(5).toString('hex');
      return `${s.slice(0, 5)}-${s.slice(5)}`;
    });
  }

  // ---------- thiết bị (AC-44) ----------

  async devices(u: AuthUser): Promise<DeviceDto[]> {
    const rows = await this.repo.activeDevices(u.id, iso());
    const out: DeviceDto[] = [];
    for (const { last } of rows) {
      const first = await this.repo.familyFirstCreated(last.familyId);
      out.push({
        familyId: last.familyId,
        userAgent: last.userAgent ?? undefined,
        ip: last.ip ?? undefined,
        createdAt: first?.createdAt ?? last.createdAt,
        lastUsedAt: last.lastUsedAt ?? undefined,
        current: last.familyId === u.familyId,
      });
    }
    return out.sort((a, b) => (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? ''));
  }

  async revokeDevice(u: AuthUser, familyId: string) {
    const first = await this.repo.familyFirstCreated(familyId);
    if (!first || first.userId !== u.id) throw AppError.notFound();
    await this.repo.revokeFamily(familyId, iso());
  }

  async revokeOtherDevices(u: AuthUser) {
    await this.repo.revokeAllForUser(u.id, iso(), u.familyId);
  }

  // ---------- tuỳ chọn người dùng ----------

  private parsePrefs(s: string): PreferencesDto {
    try {
      return JSON.parse(s || '{}') as PreferencesDto;
    } catch {
      return {};
    }
  }

  async patchPreferences(u: AuthUser, patch: PreferencesPatchDto): Promise<PreferencesDto> {
    const user = await this.repo.findUser(u.id);
    if (!user) throw AppError.unauthorized();
    const cur = this.parsePrefs(user.preferences);
    // DTO đã qua ValidationPipe có sẵn mọi trường = undefined → chỉ ghép trường thật sự gửi lên
    const given = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as PreferencesPatchDto;
    const next: PreferencesDto = { ...cur, ...given };
    if (patch.lastTab) next.lastTab = { ...(cur.lastTab ?? {}), ...patch.lastTab };
    await this.repo.updateUser(u.id, { preferences: JSON.stringify(next) });
    return next;
  }

  // ---------- vé stream 30s một lần (WS terminal, SSE) ----------

  issueTicket(u: AuthUser): { ticket: string; expiresIn: number } {
    const now = Date.now();
    for (const [k, t] of this.tickets) if (t.expiresAt < now) this.tickets.delete(k);
    const ticket = this.crypto.randomToken(24);
    this.tickets.set(ticket, { user: u, expiresAt: now + LIMITS.STREAM_TICKET_SECONDS * 1000 });
    return { ticket, expiresIn: LIMITS.STREAM_TICKET_SECONDS };
  }

  /** Vé dùng một lần: lấy ra là xoá. Kiểm lại user/thiết bị còn hiệu lực. */
  async consumeTicket(ticket: string | undefined): Promise<AuthUser | null> {
    if (!ticket) return null;
    const t = this.tickets.get(ticket);
    this.tickets.delete(ticket);
    if (!t || t.expiresAt < Date.now()) return null;
    const user = await this.repo.findUser(t.user.id);
    if (!user || user.revokedAt) return null;
    if (t.user.familyId !== 'local' && !(await this.repo.familyActive(t.user.familyId, iso()))) return null;
    return t.user;
  }
}
