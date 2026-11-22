import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { Menu, toast } from '../../components/ui/Overlay';
import { claudeApi } from '../../features/claude/api/claude.api';
import { ck, useClaudeSessions } from '../../features/claude/hooks/useClaude';
import { useHosts, useProjectsOf } from '../../features/workspace/hooks/useWorkspace';
import { ApiError } from '../../lib/api-client';
import { pbase } from './sessions';

const RECENT_MS = 10 * 60_000;

/**
 * C38 — Chuông: phiên Claude đang chờ duyệt trên mọi dự án mình thấy (G-13) + phiên vừa xong lượt.
 * ✓/✗ trả lời ngay trong danh sách; bấm dòng → vào phiên; cập nhật qua kênh events.v1 (AC-38).
 */
export function NotifBell({ hostId, projectId, onAllSessions }: { hostId?: string; projectId?: string; onAllSessions?: () => void }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const sessions = useClaudeSessions().data ?? [];
  const hosts = useHosts().data?.hosts ?? [];
  const projects = useProjectsOf(hosts.map((h) => h.id));
  const [anchor, setAnchor] = useState<DOMRect | null>(null);

  const where = useMemo(() => {
    const m = new Map<string, { hostId: string; hostName: string; name: string }>();
    projects.forEach((q, i) => {
      for (const p of q.data ?? []) m.set(p.id, { hostId: hosts[i].id, hostName: hosts[i].name, name: p.name });
    });
    return m;
  }, [projects, hosts]);

  const rows = useMemo(() => {
    const now = Date.now();
    const out = sessions
      .filter((s) => s.pending.length > 0 || (s.status === 'done' && now - Date.parse(s.updatedAt) < RECENT_MS))
      .map((s) => ({ s, ask: s.pending[0] }));
    return out.sort((a, b) => Number(!!b.ask) - Number(!!a.ask) || b.s.updatedAt.localeCompare(a.s.updatedAt));
  }, [sessions]);
  const n = rows.filter((r) => r.ask).length;

  const answer = async (sid: string, iid: string, d: 'allow' | 'deny') => {
    try {
      await claudeApi.answer(sid, iid, d);
    } catch (e) {
      toast(t(`errors.${e instanceof ApiError ? e.code : 'INTERNAL'}`, { defaultValue: t('errors.INTERNAL') }));
    }
    void qc.invalidateQueries({ queryKey: ck.sessions });
  };

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <Button
        variant="ghost"
        size="sm"
        iconOnly
        icon="bell"
        tone={n ? 'primary' : undefined}
        label={n ? t('notif.waiting', { count: n }) : t('notif.title')}
        onClick={(e) => setAnchor(e.currentTarget.getBoundingClientRect())}
      />
      {n > 0 && (
        <span className="cnt" style={{ position: 'absolute', top: -2, right: -4, pointerEvents: 'none' }}>
          {n}
        </span>
      )}
      {anchor && (
        <Menu anchor={anchor} width={360} onClose={() => setAnchor(null)}>
          <div className="grp">{t('notif.title')}</div>
          {rows.length ? (
            rows.map(({ s, ask }) => {
              const w = where.get(s.projectId);
              return (
                <div
                  key={s.id}
                  className="mi notif"
                  style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}
                  role="menuitem"
                  tabIndex={0}
                  onClick={() => {
                    setAnchor(null);
                    if (w) nav(`${pbase(w.hostId, s.projectId)}/claude/${s.id}`);
                  }}
                >
                  <b>
                    <Icon name="claude" className="claude-ic" />
                    <span className="grow ell" style={{ minWidth: 0 }}>
                      {s.name}
                    </span>
                    {ask ? (
                      <>
                        {ask.tool === 'AskUserQuestion' ? (
                          <span className="badge">
                            <span className="dot warn" />
                            {t('claude.askPick')}
                          </span>
                        ) : (
                          <Button
                            variant="primary"
                            size="sm"
                            iconOnly
                            icon="check"
                            write
                            label={`${t('claude.allow')} (⌥Y)`}
                            onClick={(e) => {
                              e.stopPropagation();
                              void answer(s.id, ask.id, 'allow');
                            }}
                          />
                        )}
                        <Button
                          size="sm"
                          iconOnly
                          icon="x"
                          write
                          label={`${t('claude.deny')} (⌥N)`}
                          onClick={(e) => {
                            e.stopPropagation();
                            void answer(s.id, ask.id, 'deny');
                          }}
                        />
                      </>
                    ) : (
                      <span className="badge">
                        <span className="dot ok" />
                        {t('status.done')}
                      </span>
                    )}
                  </b>
                  <span className="d ell" style={{ display: 'block' }}>
                    {ask ? <span className="mono">{ask.summary.replace(/\S*\//, '')}</span> : t('notif.justDone')}
                    {w && ` · ${w.hostName} › ${w.name}`}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="mi" style={{ cursor: 'default' }}>
              <span className="d">{t('notif.empty')}</span>
            </div>
          )}
          {hostId && projectId && (
            <>
              <div className="grp" />
              <div
                className="mi"
                role="menuitem"
                tabIndex={0}
                onClick={() => {
                  setAnchor(null);
                  if (onAllSessions) onAllSessions();
                  else nav(`${pbase(hostId, projectId)}/sessions`);
                }}
              >
                <b>
                  <Icon name="list" />
                  <span className="grow">{t('notif.allSessions')}</span>
                </b>
              </div>
            </>
          )}
        </Menu>
      )}
    </span>
  );
}
