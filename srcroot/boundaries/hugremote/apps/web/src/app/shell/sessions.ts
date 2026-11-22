import { useMemo } from 'react';
import type { Status } from '../../components/ui/Status';
import { useClaudeSessions } from '../../features/claude/hooks/useClaude';
import { useTerminals } from '../../features/workspace/hooks/useWorkspace';

/** Phiên trong cây/thanh phiên — Claude trước, terminal sau (AC-35). */
export interface SessionItem {
  id: string;
  kind: 'terminal' | 'claude';
  projectId: string;
  name: string;
  status: Status;
  at: string;
  /** Thứ tự tab cố định theo lúc tạo. */
  created: string;
  bypass?: boolean;
  /** Số yêu cầu quyền đang chờ (Claude). */
  pending?: number;
}

const CLAUDE_STATUS: Record<string, Status> = { running: 'running', awaiting_input: 'awaiting', done: 'done', cancelled: 'stopped', error: 'err', idle: 'idle' };

export const pbase = (hostId: string, projectId: string) => `/s/${encodeURIComponent(hostId)}/p/${projectId}`;
export const sessionHref = (hostId: string, s: SessionItem) => `${pbase(hostId, s.projectId)}/${s.kind}/${s.id}`;

export function useSessions() {
  const terms = useTerminals();
  const claudes = useClaudeSessions();
  const all = useMemo<SessionItem[]>(
    () => [
      ...(claudes.data ?? []).map((c) => ({
        id: c.id,
        kind: 'claude' as const,
        projectId: c.projectId,
        name: c.name,
        status: CLAUDE_STATUS[c.status] ?? 'idle',
        at: c.updatedAt,
        created: c.createdAt,
        bypass: c.permissionMode === 'bypassPermissions',
        pending: c.pendingInteractions,
      })),
      ...(terms.data ?? []).map((t) => ({
        id: t.id,
        kind: 'terminal' as const,
        projectId: t.projectId,
        name: t.name,
        status: (t.status === 'running' ? 'running' : 'exited') as Status,
        at: t.lastAttachedAt ?? t.createdAt,
        created: t.createdAt,
      })),
    ],
    [terms.data, claudes.data],
  );
  const byProject = useMemo(() => {
    const m = new Map<string, SessionItem[]>();
    for (const s of all) m.set(s.projectId, [...(m.get(s.projectId) ?? []), s]);
    for (const [k, v] of m) m.set(k, v.sort((a, b) => (a.kind === b.kind ? a.created.localeCompare(b.created) : a.kind === 'claude' ? -1 : 1)));
    return m;
  }, [all]);
  return { all, byProject, isLoading: terms.isLoading || claudes.isLoading };
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
