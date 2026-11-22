import { useQuery, useQueryClient } from '@tanstack/react-query';
import { claudeApi } from '../api/claude.api';

export const ck = { sessions: ['claude', 'sessions'] as const };

/** Mọi phiên Claude mình được thấy (G-13: member chỉ phiên của mình) — nuôi cây, thanh phiên, chuông. */
export const useClaudeSessions = () => useQuery({ queryKey: ck.sessions, queryFn: claudeApi.all, staleTime: 5_000 });

export function useRefreshClaude() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ck.sessions });
}
