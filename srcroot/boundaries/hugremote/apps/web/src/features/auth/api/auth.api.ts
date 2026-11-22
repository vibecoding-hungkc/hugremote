import { api } from '../../../lib/api-client';

export interface SessionResponse {
  accessToken?: string;
  needs2fa: boolean;
  pendingToken?: string;
  mustChangePassword: boolean;
}
export interface Me {
  id: string;
  role: 'owner' | 'member';
  email?: string;
  mustChangePassword: boolean;
  twoFactorEnabled: boolean;
  recoveryCodesLeft?: number;
  preferences: { theme?: 'dark' | 'light' | 'system'; locale?: 'vi' | 'en'; compact?: boolean; lastTab?: Record<string, string> };
}

export interface Device {
  familyId: string;
  userAgent?: string;
  ip?: string;
  createdAt: string;
  lastUsedAt?: string;
  current: boolean;
}

export const authApi = {
  login: (password: string) => api<SessionResponse>('/auth/login', { body: { password } }),
  verify: (pendingToken: string, code: string) => api<SessionResponse>('/auth/2fa/verify', { body: { pendingToken, code } }),
  me: () => api<Me>('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) => api<SessionResponse>('/auth/password', { body: { currentPassword, newPassword } }),
  logout: () => api<void>('/auth/logout', { method: 'POST' }),
  setup2fa: () => api<{ secret: string; otpauthUri: string; qrSvg: string }>('/auth/2fa/setup', { method: 'POST' }),
  enable2fa: (code: string) => api<{ recoveryCodes: string[] }>('/auth/2fa/enable', { body: { code } }),
  disable2fa: (code: string) => api<void>('/auth/2fa/disable', { body: { code } }),
  regenCodes: (code: string) => api<{ recoveryCodes: string[] }>('/auth/2fa/recovery-codes', { body: { code } }),
  devices: () => api<Device[]>('/auth/devices'),
  revokeDevice: (familyId: string) => api<void>(`/auth/devices/${familyId}`, { method: 'DELETE' }),
  revokeOthers: () => api<void>('/auth/devices/revoke-others', { method: 'POST' }),
  patchPreferences: (p: Partial<Me['preferences']>) => api<Me['preferences']>('/me/preferences', { method: 'PATCH', body: p }),
};
