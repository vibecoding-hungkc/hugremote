import { api } from '../../../lib/api-client';
import type { S } from '../../../types/schemas';

export const ssoApi = {
  config: () => api<S['SsoConfigDto']>('/sso/config'),
  save: (b: S['SsoConfigInputDto']) => api<S['SsoConfigDto']>('/sso/config', { method: 'PUT', body: b }),
  discover: (b: S['SsoDiscoverDto']) => api<S['DiscoverResultDto']>('/sso/discover', { body: b }),
  disable: () => api<void>('/sso/disable', { method: 'POST' }),
  members: () => api<S['MemberDto'][]>('/sso/members'),
  revoke: (id: string) => api<void>(`/sso/members/${id}`, { method: 'DELETE' }),
  restore: (id: string) => api<void>(`/sso/members/${id}/restore`, { method: 'POST' }),
  denials: () => api<S['DenialDto'][]>('/sso/denials'),
  allow: (email: string) => api<S['SsoConfigDto']>('/sso/allow', { body: { email } }),
};
