import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate, type NavigateFunction } from 'react-router-dom';
import { toast, type MenuItem } from '../../components/ui/Overlay';
import { claudeApi } from '../../features/claude/api/claude.api';
import { ck } from '../../features/claude/hooks/useClaude';
import { desktop, webApi } from '../../features/web/web.api';
import { forwardsApi } from '../../features/forwards/forwards.api';
import type { QueryClient } from '@tanstack/react-query';
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
  return async (kind: 'terminal' | 'claude' | 'tmux' | 'web', hostId: string, projectId: string, opts: { cwd?: string; tmux?: string; url?: string } = {}) => {
    const base = pbase(hostId, projectId);
    if (kind === 'claude') return nav(`${base}/claude/new`);
    if (kind === 'web') {
      try {
        const w = await webApi.create(projectId, opts.url ?? (await defaultWebUrl(hostId)));
        await qc.invalidateQueries({ queryKey: qk.web });
        return nav(`${base}/web/${w.id}`);
      } catch (e) {
        return toast(t(`errors.${e instanceof ApiError ? e.code : 'INTERNAL'}`, { defaultValue: t('errors.INTERNAL') }));
      }
    }
    try {
      const fresh = kind === 'tmux' && !opts.tmux;
      const tmux = kind === 'tmux' ? (opts.tmux ?? (await tmuxBase(projectId))) : undefined;
      const term = await workspaceApi.createTerminal(projectId, { ...(opts.cwd ? { cwd: opts.cwd } : {}), ...(tmux ? { tmux } : {}), ...(fresh ? { tmuxFresh: true } : {}) });
      await qc.invalidateQueries({ queryKey: qk.terminals });
      nav(`${base}/terminal/${term.id}`);
    } catch (e) {
      toast(t(`errors.${e instanceof ApiError ? e.code : 'INTERNAL'}`, { defaultValue: t('errors.INTERNAL') }));
    }
  };
}

/** Tên gốc session tmux mới: tên dự án (đã lọc ký tự) — server thêm `-2`, `-3`… tới tên trống (AC-54, `tmuxFresh`). */
async function tmuxBase(projectId: string): Promise<string> {
  const p = await workspaceApi.project(projectId);
  return (p.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^[-]+|-+$/g, '') || 'tmux').slice(0, 56);
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
    const web: MenuItem[] = desktop() ? [{ icon: 'globe', label: t('session.newWeb'), kbd: '⌥⇧B', onSelect: () => void newSession('web', hostId, projectId) }] : [];
    if (hostId === 'local') return [...items, ...web];
    const ls = await workspaceApi.tmuxSessions(projectId).catch(() => null);
    if (!ls) return [...items, ...web];
    items.push({ icon: 'tmux', label: t('session.newTmux'), kbd: '⌥⇧M', onSelect: () => void newSession('tmux', hostId, projectId) }, ...web);
    for (const x of ls)
      items.push({
        group: t('session.tmuxOn', { host: hostId }), // hostId = alias trong ssh config (tên hiện ở cây)
        icon: 'tmux',
        label: `${x.name} · ${t('session.tmuxWindows', { n: x.windows })}${x.sessionId ? ' · ' + t('session.tmuxOpen') : ''}`,
        onSelect: () => (x.sessionId ? nav(`${pbase(hostId, projectId)}/terminal/${x.sessionId}`) : void newSession('tmux', hostId, projectId, { tmux: x.name })),
      });
    return items;
  };
}

/** Đóng / đổi tên theo loại phiên — một chỗ cho thanh phiên và cây (vòng 3 thêm loại `web`). */
export const sessionKey = (s: Pick<SessionItem, 'kind'>) => (s.kind === 'terminal' ? qk.terminals : s.kind === 'web' ? qk.web : ck.sessions);
export async function closeSessionApi(qc: QueryClient, s: SessionItem) {
  if (s.kind === 'terminal') await workspaceApi.closeTerminal(s.id);
  else if (s.kind === 'web') {
    await webApi.remove(s.id);
    desktop()?.web.close(s.id);
  } else await claudeApi.remove(s.id);
  await qc.invalidateQueries({ queryKey: sessionKey(s) });
}
export async function renameSessionApi(qc: QueryClient, s: SessionItem, name: string) {
  if (s.kind === 'terminal') await workspaceApi.renameTerminal(s.id, name);
  else if (s.kind === 'web') await webApi.patch(s.id, { name });
  else await claudeApi.patch(s.id, { name });
  await qc.invalidateQueries({ queryKey: sessionKey(s) });
}
/** Phiên trình duyệt không có tiến trình để dừng → không hỏi xác nhận khi đóng. */
export const closeNeedsConfirm = (s: SessionItem) => s.kind === 'claude' || (s.kind !== 'web' && (s.status === 'running' || s.status === 'awaiting'));

/** Trang mặc định của phiên trình duyệt mới: chuyển tiếp -L đầu tiên đang bật của máy, không có thì localhost:3000. */
async function defaultWebUrl(hostId: string) {
  if (hostId !== 'local') {
    const f = (await forwardsApi.list().catch(() => [])).find((x) => x.hostId === hostId && x.direction === 'L' && x.status === 'on');
    if (f) return `http://localhost:${f.localPort}/`;
  }
  return 'http://localhost:3000/';
}
