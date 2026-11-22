import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode, UserRole } from '@app/shared';
import { APP_CONFIG } from '../config/app-config';
import type { AppConfig } from '../config/app-config';
import { AppError } from './app-error';
import { ALLOW_PENDING, IS_PUBLIC, ROLES } from './decorators';
import type { AuthUser } from './auth-user';
import { AuthService } from '../modules/auth/auth.service';

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
    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: AuthUser }>();
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    const user = this.cfg.authMode === 'none' ? await this.auth.localOwner() : token ? await this.auth.authenticate(token) : null;
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
