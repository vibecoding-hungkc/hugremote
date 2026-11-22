import { useMemo } from 'react';
import type { Status } from '../../components/ui/Status';
import { useTerminals } from '../../features/workspace/hooks/useWorkspace';

/** Phiên trong cây/thanh phiên — Claude trước, terminal sau (AC-35). Claude nối vào ở lát 5. */
export interface SessionItem {
  id: string;
  kind: 'terminal' | 'claude';
  projectId: string;
  name: string;
  status: Status;
  at: string;
  bypass?: boolean;
}

export const pbase = (hostId: string, projectId: string) => `/s/${encodeURIComponent(hostId)}/p/${projectId}`;
export const sessionHref = (hostId: string, s: SessionItem) => `${pbase(hostId, s.projectId)}/${s.kind}/${s.id}`;

export function useSessions() {
  const terms = useTerminals();
  const all = useMemo<SessionItem[]>(
    () =>
      (terms.data ?? []).map((t) => ({
        id: t.id,
        kind: 'terminal' as const,
        projectId: t.projectId,
        name: t.name,
        status: t.status === 'running' ? 'running' : 'exited',
        at: t.lastAttachedAt ?? t.createdAt,
      })),
    [terms.data],
  );
  const byProject = useMemo(() => {
    const m = new Map<string, SessionItem[]>();
    for (const s of all) m.set(s.projectId, [...(m.get(s.projectId) ?? []), s]);
    for (const [k, v] of m) m.set(k, v.sort((a, b) => (a.kind === b.kind ? a.at.localeCompare(b.at) : a.kind === 'claude' ? -1 : 1)));
    return m;
  }, [all]);
  return { all, byProject, isLoading: terms.isLoading };
}

/** Thời gian rút gọn ở cây: 35p · 2g · 1 ngày · 10:42 (G-9 — giờ máy người xem). */
export function shortAgo(iso: string, now = Date.now()) {
  const d = new Date(iso);
  const m = Math.floor((now - d.getTime()) / 60_000);
  if (m < 1) return 'vừa';
  if (m < 60) return `${m}p`;
  if (m < 24 * 60) return `${Math.floor(m / 60)}g`;
  if (m < 7 * 24 * 60) return `${Math.floor(m / 1440)} ngày`;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}
