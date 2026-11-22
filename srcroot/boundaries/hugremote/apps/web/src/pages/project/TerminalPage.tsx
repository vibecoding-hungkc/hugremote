import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useNewSession } from '../../app/shell/actions';
import { SessionBar } from '../../app/shell/SessionBar';
import { pbase, useSessions } from '../../app/shell/sessions';
import { Button } from '../../components/ui/Button';
import { ErrorBox, Skeleton } from '../../components/ui/States';
import { KeyBar } from '../../features/terminal/components/KeyBar';
import { TerminalPane } from '../../features/terminal/components/TerminalPane';
import type { PooledTerm } from '../../features/terminal/components/terminal-pool';

/** S6 — Phiên terminal: thanh phiên, xterm, thanh phím cảm ứng (mobile). */
export function TerminalPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { hostId = '', projectId = '', sid = '' } = useParams();
  const sessions = useSessions();
  const newSession = useNewSession();
  const target = useRef<PooledTerm | null>(null);
  const cur = sessions.all.find((s) => s.id === sid && s.kind === 'terminal');
  if (sessions.isLoading) return <div className="content"><Skeleton rows={2} /></div>;
  if (!cur) {
    // không thấy (đã đóng, hoặc phiên của người khác với member — G-13)
    if (!sessions.all.length || sessions.all.every((s) => s.projectId !== projectId)) return <Navigate to={`${pbase(hostId, projectId)}/sessions`} replace />;
    return (
      <div className="content" data-screen="S6">
        <ErrorBox title={t('session.notFound')} body={t('session.notFoundBody')} actions={<Button size="sm" onClick={() => nav('/')}>{t('nav.backToWorkspace')}</Button>} />
      </div>
    );
  }
  return (
    <div className="content flush" data-screen="S6" aria-label={t('term.title')}>
      <SessionBar hostId={hostId} projectId={projectId} currentId={sid} />
      <div className="panes">
        <TerminalPane key={sid} sessionId={sid} exited={cur.status === 'exited'} onNew={() => void newSession('terminal', hostId, projectId)} onKeyTarget={(p) => (target.current = p)} />
      </div>
      <KeyBar
        send={(d) => {
          target.current?.sock?.send(d);
          target.current?.term.focus();
        }}
      />
    </div>
  );
}
