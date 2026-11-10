export type AuthMode = 'none' | 'password' | 'google' | 'oidc' | 'both';

export interface AuthUser {
  provider: AuthMode;
  email?: string;
  name?: string;
  avatar?: string;
  mustChangePassword?: boolean;
  twoFactorVerified?: boolean;
}

export interface OidcStoredConfig {
  mode: AuthMode;
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
  allowedEmails: string[];
  buttonLabel: string;
  updatedAt: string;
}

export interface SessionRecord {
  user: AuthUser;
  expiresAt: number;
}

export interface AttemptRecord {
  failedCount: number;
  lockedUntil: number;
}
