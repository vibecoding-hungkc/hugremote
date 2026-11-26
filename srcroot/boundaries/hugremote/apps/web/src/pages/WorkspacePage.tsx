import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from '../components/ui/Overlay';
import { WorkspaceTree } from '../app/shell/WorkspaceTree';
import { sessionHref, sessionIcon, useSessions, type SessionItem } from '../app/shell/sessions';
import { Icon } from '../components/ui/Icon';
import { StatusBadge } from '../components/ui/Status';
import { EmptyState, ErrorBox, Skeleton } from '../components/ui/States';
import { useHosts, usePins, useProjectsOf } from '../features/workspace/hooks/useWorkspace';
import { StartCard } from '../features/workspace/components/StartCard';
import { shortAgo } from '../app/shell/sessions';

/** S2 — Không gian làm việc: "Cần bạn" → cây (mobile) → "Đang chạy"; thẻ Bắt đầu khi còn trống (AC-12, AC-28). */
export function WorkspacePage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const loc = useLocation();
  // về đây vì link phiên đã đóng / của người khác (AC-33, G-13)
  useEffect(() => {
    if ((loc.state as { notice?: string } | null)?.notice === 'sessionGone') toast(t('session.goneNotice'));
  }, [loc.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const hosts = useHosts();
  const pins = usePins();
  const sessions = useSessions();
  const hostIds = hosts.data?.hosts.map((h) => h.id) ?? [];
  const projectQs = useProjectsOf(hostIds);
  const projects = projectQs.flatMap((q) => q.data ?? []);
  const where = (s: SessionItem) => {
    const p = projects.find((x) => x.id === s.projectId);
    const h = hosts.data?.hosts.find((x) => x.id === p?.hostId);
    return { p, h };
  };
  if (hosts.isLoading || pins.isLoading)
    return (
      <div className="content" data-screen="S2">
        <div className="wrap">
          <Skeleton rows={4} />
        </div>
      </div>
    );
  if (hosts.isError)
    return (
      <div className="content" data-screen="S2">
        <div className="wrap">
          <ErrorBox title={t('ws.loadError')} body={t('ws.loadErrorBody')} onRetry={() => void hosts.refetch()} />
        </div>
      </div>
    );
  const need = sessions.all.filter((s) => s.status === 'awaiting');
  const running = sessions.all.filter((s) => s.status === 'running');
  const card = (s: SessionItem) => {
    const { p, h } = where(s);
    if (!p || !h) return null;
    return (
      <div className="list" key={s.id}>
        <button className="row" style={{ width: '100%', border: 0, background: 'none', textAlign: 'left' }} onClick={() => nav(sessionHref(h.id, s))}>
          <Icon name={sessionIcon(s).name} className={sessionIcon(s).cls} />
          <span className="t">
            <span className="t1" style={{ display: 'block' }}>
              {s.name}
            </span>
            <span className="t2" style={{ display: 'block' }}>
              {h.kind === 'local' ? t('hosts.thisMachineShort') : h.name} › {p.name} · {shortAgo(s.at)}
            </span>
            {s.note && (
              <span className="t2 cnote">
                <Icon name="note" className="note-ic" />
                <span className="ell">{s.note.text}</span>
              </span>
            )}
          </span>
          <StatusBadge status={s.status} />
        </button>
      </div>
    );
  };
  const start = <StartCard hostCount={hostIds.length} projectCount={projects.filter((p) => !p.isHome).length} sessionCount={sessions.all.length} />;
  return (
    <div className="content" data-screen="S2" aria-label={t('nav.workspace')}>
      <div className="wrap">
        {start}
        {!!need.length && (
          <>
            <div className="section-title">{t('ws.needYou')}</div>
            <div className="overview">{need.map(card)}</div>
          </>
        )}
        <div className="only-mobile" style={{ marginTop: 'var(--space-lg)' }}>
          <div className="list">
            <WorkspaceTree />
          </div>
        </div>
        {!!running.length && (
          <>
            <div className="section-title">{t('ws.running')}</div>
            <div className="overview">{running.map(card)}</div>
          </>
        )}
        {!need.length && !running.length && projects.filter((p) => !p.isHome).length > 0 && (
          <div className="hide-mobile">
            <EmptyState icon="sessions" message={t('ws.nothingRunning')} />
          </div>
        )}
      </div>
    </div>
  );
}
