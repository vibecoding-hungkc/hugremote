import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate, type NavigateFunction } from 'react-router-dom';
import { toast, type MenuItem } from '../../components/ui/Overlay';
import { workspaceApi } from '../../features/workspace/api/workspace.api';
import { qk } from '../../features/workspace/hooks/useWorkspace';
import { ApiError } from '../../lib/api-client';
import { pbase, type SessionItem } from './sessions';

/**
 * Bấm dự án → về tab đang dùng lần trước (không có màn tổng quan dự án — Authority lượt 2).
 * `lastTab` lưu theo người dùng (`users.preferences.lastTab`); phiên đã đóng → phiên đầu tiên; chưa có phiên → tab Phiên rỗng.
 */
export function openProject(nav: NavigateFunction, hostId: string, projectId: string, lastTab: string | undefined, sessions: SessionItem[]) {
  const base = pbase(hostId, projectId);
  if (lastTab) {
    const m = /^(terminal|claude)\/(.+)$/.exec(lastTab);
    if (!m || sessions.some((s) => s.id === m[2])) return nav(`${base}/${lastTab}`);
  }
  const first = sessions.find((s) => s.status === 'running' || s.status === 'awaiting') ?? sessions[0];
  nav(first ? `${base}/${first.kind}/${first.id}` : `${base}/sessions`);
}

export function useNewSession() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { t } = useTranslation();
  return async (kind: 'terminal' | 'claude' | 'tmux', hostId: string, projectId: string, opts: { cwd?: string; tmux?: string } = {}) => {
    const base = pbase(hostId, projectId);
    if (kind === 'claude') return nav(`${base}/claude/new`);
    try {
      const tmux = kind === 'tmux' ? (opts.tmux ?? (await nextTmuxName(projectId))) : undefined;
      const term = await workspaceApi.createTerminal(projectId, { ...(opts.cwd ? { cwd: opts.cwd } : {}), ...(tmux ? { tmux } : {}) });
      await qc.invalidateQueries({ queryKey: qk.terminals });
      nav(`${base}/terminal/${term.id}`);
    } catch (e) {
      toast(t(`errors.${e instanceof ApiError ? e.code : 'INTERNAL'}`, { defaultValue: t('errors.INTERNAL') }));
    }
  };
}

/** Tên session tmux mới: tên dự án (đã lọc ký tự), trùng `tmux ls` thì thêm `-2`, `-3`… (AC-54). */
async function nextTmuxName(projectId: string): Promise<string> {
  const [p, ls] = await Promise.all([workspaceApi.project(projectId), workspaceApi.tmuxSessions(projectId)]);
  const base = (p.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'tmux').slice(0, 56);
  const taken = new Set(ls.map((x) => x.name));
  let n = base;
  for (let i = 2; taken.has(n); i++) n = `${base}-${i}`;
  return n;
}

/**
 * Mục của nút + (thanh phiên, cây dự án): Claude · Terminal · tmux mới (chỉ máy SSH, Q-6) + nhóm session tmux có sẵn.
 * tmux ls lấy lúc mở menu; máy chưa cài tmux → không có mục tmux.
 */
export function usePlusMenu() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const newSession = useNewSession();
  return async (hostId: string, projectId: string): Promise<MenuItem[]> => {
    const items: MenuItem[] = [
      { icon: 'claude', label: t('session.newClaude'), kbd: '⌥⇧N', onSelect: () => void newSession('claude', hostId, projectId) },
      { icon: 'term', label: t('session.newTerminal'), kbd: '⌥⇧T', onSelect: () => void newSession('terminal', hostId, projectId) },
    ];
    if (hostId === 'local') return items;
    const ls = await workspaceApi.tmuxSessions(projectId).catch(() => null);
    if (!ls) return items;
    items.push({ icon: 'tmux', label: t('session.newTmux'), kbd: '⌥⇧M', onSelect: () => void newSession('tmux', hostId, projectId) });
    for (const x of ls)
      items.push({
        group: t('session.tmuxOn'),
        icon: 'tmux',
        label: `${x.name} · ${t('session.tmuxWindows', { n: x.windows })}${x.sessionId ? ' · ' + t('session.tmuxOpen') : ''}`,
        onSelect: () => (x.sessionId ? nav(`${pbase(hostId, projectId)}/terminal/${x.sessionId}`) : void newSession('tmux', hostId, projectId, { tmux: x.name })),
      });
    return items;
  };
}
