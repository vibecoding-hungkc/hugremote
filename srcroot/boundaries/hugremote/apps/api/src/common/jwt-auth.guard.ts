import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode, UserRole } from '@app/shared';
import { APP_CONFIG } from '../config/app-config';
import type { AppConfig } from '../config/app-config';
import { AppError } from './app-error';
import { ALLOW_PENDING, IS_PUBLIC, ROLES } from './decorators';
import type { AuthUser } from './auth-user';
import { AuthService } from '../modules/auth/auth.service';

function isLoopback(ip?: string): boolean {
  if (!ip) return true;
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost';
}

/**
 * Guard toàn cục (G-1): mọi route cần access token hợp lệ + thiết bị chưa bị đăng xuất, trừ `@Public()`.
 * Người còn phải đổi mật khẩu chỉ vào được route `@AllowPending()`. `@Roles()` chặn theo vai.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ctx.getType() !== 'http') return true;
    const targets = [ctx.getHandler(), ctx.getClass()];
    const req = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      cookies?: Record<string, string | undefined>;
      ip?: string;
      socket?: { remoteAddress?: string };
      user?: AuthUser;
    }>();
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

    let user: AuthUser | null = null;
    const desktopSecret = this.cfg.desktopSecret;
    const cookieSecret = req.cookies?.['hugremote_desktop_token'];
    const headerSecret = req.headers['x-hugremote-desktop-secret'];

    if (desktopSecret && (cookieSecret === desktopSecret || headerSecret === desktopSecret)) {
      const clientIp = req.ip || req.socket?.remoteAddress;
      if (!isLoopback(clientIp)) {
        throw AppError.forbidden();
      }
      user = await this.auth.localOwner();
    } else {
      user = this.cfg.authMode === 'none' ? await this.auth.localOwner() : token ? await this.auth.authenticate(token) : null;
    }
    if (user) req.user = user;
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;
    if (!user) throw AppError.unauthorized();
    if (user.mustChangePassword && !this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING, targets)) {
      throw AppError.forbidden(ErrorCode.PASSWORD_CHANGE_REQUIRED);
    }
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES, targets);
    if (roles?.length && !roles.includes(user.role)) throw AppError.forbidden();
    return true;
  }
}
