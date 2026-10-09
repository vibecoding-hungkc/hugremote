export type AuthMode = 'none' | 'password' | 'google';

export interface AuthUser {
  provider: AuthMode;
  email?: string;
  name?: string;
  avatar?: string;
  mustChangePassword?: boolean;
}

export interface SessionRecord {
  user: AuthUser;
  expiresAt: number;
}

export interface AttemptRecord {
  failedCount: number;
  lockedUntil: number;
}
