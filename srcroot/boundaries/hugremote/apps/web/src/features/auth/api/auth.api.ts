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
  preferences: { theme?: 'dark' | 'light' | 'system'; locale?: 'vi' | 'en'; compact?: boolean; lastTab?: Record<string, string> };
}

export const authApi = {
  login: (password: string) => api<SessionResponse>('/auth/login', { body: { password } }),
  verify: (pendingToken: string, code: string) => api<SessionResponse>('/auth/2fa/verify', { body: { pendingToken, code } }),
  me: () => api<Me>('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) => api<SessionResponse>('/auth/password', { body: { currentPassword, newPassword } }),
  logout: () => api<void>('/auth/logout', { method: 'POST' }),
  patchPreferences: (p: Partial<Me['preferences']>) => api<Me['preferences']>('/me/preferences', { method: 'PATCH', body: p }),
};
