import { api } from '../../../lib/api-client';
import type { S } from '../../../types/schemas';

export const systemApi = {
  info: () => api<S['SystemInfoDto']>('/system/info'),
  checks: () => api<S['CheckDto'][]>('/system/checks'),
  logs: (kind: 'app' | 'ssh' | 'update') => api<S['LogsDto']>('/system/logs', { query: { kind } }),
};
