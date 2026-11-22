import { UserRole } from '@app/shared';

/** Người gọi đã xác thực — gắn vào `req.user` bởi JwtAuthGuard. */
export interface AuthUser {
  id: string;
  role: UserRole;
  email?: string;
  familyId: string;
  mustChangePassword: boolean;
}

export const isOwner = (u: AuthUser) => u.role === UserRole.OWNER;
