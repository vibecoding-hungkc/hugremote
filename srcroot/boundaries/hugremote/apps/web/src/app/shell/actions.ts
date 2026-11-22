import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate, type NavigateFunction } from 'react-router-dom';
import { toast } from '../../components/ui/Overlay';
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
  return async (kind: 'terminal' | 'claude', hostId: string, projectId: string, opts: { cwd?: string } = {}) => {
    const base = pbase(hostId, projectId);
    if (kind === 'claude') return nav(`${base}/claude/new`);
    try {
      const term = await workspaceApi.createTerminal(projectId, opts.cwd ? { cwd: opts.cwd } : {});
      await qc.invalidateQueries({ queryKey: qk.terminals });
      nav(`${base}/terminal/${term.id}`);
    } catch (e) {
      toast(t(`errors.${e instanceof ApiError ? e.code : 'INTERNAL'}`, { defaultValue: t('errors.INTERNAL') }));
    }
  };
}
