import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { UserRole } from '@app/shared';
import type { AuthUser } from './auth-user';

export const IS_PUBLIC = 'isPublic';
/** Route công khai — chỉ dùng cho danh sách ở G-1 (login, 2fa/verify, refresh, health, sso redirect). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ALLOW_PENDING = 'allowPending';
/** Cho phép người đã qua mật khẩu nhưng còn phải đổi mật khẩu / chưa qua 2FA (route đổi mật khẩu, me, logout). */
export const AllowPending = () => SetMetadata(ALLOW_PENDING, true);

export const ROLES = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES, roles);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest<{ user: AuthUser }>().user;
});
