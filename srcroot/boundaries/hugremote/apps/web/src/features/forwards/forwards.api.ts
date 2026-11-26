import { api } from '../../lib/api-client';
import type { S } from '../../types/schemas';

export type Forward = S['ForwardDto'];
export type ListeningPort = S['ListeningPortDto'];

/** forwards-api.v1 (owner-only) — AC-57/58. */
export const forwardsApi = {
  list: (check = false) => api<Forward[]>('/port-forwards', check ? { query: { check: 1 } } : {}),
  create: (b: S['CreateForwardDto']) => api<Forward>('/port-forwards', { body: b }),
  update: (id: string, b: S['UpdateForwardDto']) => api<Forward>(`/port-forwards/${id}`, { method: 'PATCH', body: b }),
  remove: (id: string) => api<void>(`/port-forwards/${id}`, { method: 'DELETE' }),
  listening: (hostId: string) => api<ListeningPort[]>(`/hosts/${encodeURIComponent(hostId)}/listening-ports`),
};

/** Cổng gợi ý trên Mac: = cổng phía máy SSH, bận thì +10000 (AC-57). */
export function freeLocal(port: number, used: number[]) {
  let n = port;
  while (used.includes(n) || n < 1024) n += 10000;
  return n <= 65535 ? n : port;
}
