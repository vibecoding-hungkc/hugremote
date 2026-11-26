import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import i18n from '../../i18n';
import type { Status } from '../../components/ui/Status';
import { useClaudeSessions } from '../../features/claude/hooks/useClaude';
import { useNotes } from '../../features/notes/notes';
import { useTerminals, useWebSessions } from '../../features/workspace/hooks/useWorkspace';

/** Phiên trong cây/thanh phiên — Claude trước, terminal sau (AC-35). */
export interface SessionItem {
  id: string;
  kind: 'terminal' | 'claude' | 'web';
  projectId: string;
  name: string;
  status: Status;
  at: string;
  /** Thứ tự tab cố định theo lúc tạo. */
  created: string;
  bypass?: boolean;
  /** Số yêu cầu quyền đang chờ (Claude). */
  pending?: number;
  /** Vòng 3: phiên terminal chạy trong tmux (biểu tượng riêng, tên = tên session). */
  tmux?: string;
  /** Terminal đã thoát: mã thoát; không có = đóng vì mất kết nối (SSH rớt), không phải tự thoát. */
  exitCode?: number;
  /** Vòng 3: địa chỉ trang của phiên trình duyệt. */
  url?: string;
  /** Ghi chú của phiên (Authority 2026-11-26) — hiện ở dải dưới thanh tab, cây, trang tổng, ⌘K. */
  note?: { text: string; updatedAt: string };
}

/** Biểu tượng + class của một phiên — một chỗ cho tab, cây, bộ chọn, chuyển nhanh. */
export const sessionIcon = (s: Pick<SessionItem, 'kind' | 'tmux'>) =>
  s.kind === 'claude' ? ({ name: 'claude', cls: 'claude-ic' } as const) : s.kind === 'web' ? ({ name: 'globe' as const, cls: '' as const }) : ({ name: s.tmux ? ('tmux' as const) : ('term' as const), cls: 'term-ic' as const });

/** Thứ tự trong thanh phiên/cây: Claude → terminal → trình duyệt. */
const ORDER = { claude: 0, terminal: 1, web: 2 } as const;

const CLAUDE_STATUS: Record<string, Status> = { running: 'running', awaiting_input: 'awaiting', done: 'done', cancelled: 'stopped', error: 'err', idle: 'idle' };

export const pbase = (hostId: string, projectId: string) => `/s/${encodeURIComponent(hostId)}/p/${projectId}`;
export const sessionHref = (hostId: string, s: SessionItem) => `${pbase(hostId, s.projectId)}/${s.kind}/${s.id}`;

export function useSessions() {
  const terms = useTerminals();
  const webs = useWebSessions();
  const claudes = useClaudeSessions();
  const notes = useNotes().data;
  const all = useMemo<SessionItem[]>(
    () =>
      [
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
        tmux: t.tmuxName ?? undefined,
        exitCode: t.exitCode,
      })),
      ...(webs.data ?? []).map((w) => ({
        id: w.id,
        kind: 'web' as const,
        projectId: w.projectId,
        name: w.name,
        status: 'running' as Status,
        at: w.lastOpenedAt ?? w.createdAt,
        created: w.createdAt,
        url: w.url,
      })),
      ].map((s) => (notes?.has(s.id) ? { ...s, note: notes.get(s.id) } : s)),
    [terms.data, claudes.data, webs.data, notes],
  );
  const byProject = useMemo(() => {
    const m = new Map<string, SessionItem[]>();
    for (const s of all) m.set(s.projectId, [...(m.get(s.projectId) ?? []), s]);
    for (const [k, v] of m) m.set(k, v.sort((a, b) => (a.kind === b.kind ? a.created.localeCompare(b.created) : ORDER[a.kind] - ORDER[b.kind])));
    return m;
  }, [all]);
  return { all, byProject, isLoading: terms.isLoading || claudes.isLoading || webs.isLoading };
}

/** Thời gian rút gọn ở cây: 35p · 2g · 1 ngày · 10:42 (G-9 — giờ máy người xem). */
export function shortAgo(iso: string, now = Date.now()) {
  const d = new Date(iso);
  const m = Math.floor((now - d.getTime()) / 60_000);
  const en = i18n.language.startsWith('en');
  if (m < 1) return en ? 'now' : 'vừa';
  if (m < 60) return `${m}${en ? 'm' : 'p'}`;
  if (m < 24 * 60) return `${Math.floor(m / 60)}${en ? 'h' : 'g'}`;
  if (m < 7 * 24 * 60) return `${Math.floor(m / 1440)}${en ? 'd' : ' ngày'}`;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * URL trỏ tới phiên không có trong danh sách: có thể vừa tạo ở tab/thiết bị khác → tải lại danh sách một lần.
 * Vẫn không thấy (đã đóng, hoặc phiên của người khác — G-13) → `gone`: trang về S2 kèm câu báo (AC-33).
 */
export function useMissingSession(id: string, present: boolean, loading: boolean): 'ok' | 'checking' | 'gone' {
  const qc = useQueryClient();
  const [checked, setChecked] = useState<string | null>(null);
  useEffect(() => {
    if (present || loading || checked === id) return;
    void Promise.all([qc.refetchQueries({ queryKey: ['terminals'] }), qc.refetchQueries({ queryKey: ['claude', 'sessions'] })]).finally(() => setChecked(id));
  }, [id, present, loading, checked, qc]);
  if (present) return 'ok';
  return checked === id ? 'gone' : 'checking';
}
