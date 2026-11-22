import { api } from '../../../lib/api-client';
import type { S } from '../../../types/schemas';

export const systemApi = {
  info: () => api<S['SystemInfoDto']>('/system/info'),
  checks: () => api<S['CheckDto'][]>('/system/checks'),
  logs: (kind: 'app' | 'ssh' | 'update') => api<S['LogsDto']>('/system/logs', { query: { kind } }),
  update: () => api<S['UpdateStateDto']>('/system/update'),
  startUpdate: (when: 'now' | 'idle') => api<S['UpdateStateDto']>('/system/update', { body: { when } }),
  cancelUpdate: () => api<void>('/system/update', { method: 'DELETE' }),
};
