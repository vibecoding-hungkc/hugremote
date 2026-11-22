import { api } from '../../../lib/api-client';
import type { Host, S } from '../../../types/schemas';

export const hostsApi = {
  create: (b: S['HostInputDto']) => api<Host>('/hosts', { body: b }),
  update: (id: string, b: S['HostPatchDto']) => api<Host>(`/hosts/${encodeURIComponent(id)}`, { method: 'PATCH', body: b }),
  remove: (id: string) => api<void>(`/hosts/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  test: (id: string | undefined, b: S['HostTestDto']) => api<S['TestResultDto']>(`/hosts/${id ? encodeURIComponent(id) : '_new'}/test`, { body: b }),
  trust: (id: string, b: S['TrustKeyDto']) => api<void>(`/hosts/${encodeURIComponent(id)}/trust-key`, { body: b }),
  keys: () => api<S['SshKeyDto'][]>('/ssh-keys'),
};
