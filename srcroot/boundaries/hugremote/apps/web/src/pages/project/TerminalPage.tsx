import { useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { SessionBar } from '../../app/shell/SessionBar';
import { pbase, useMissingSession, useSessions } from '../../app/shell/sessions';
import { workspaceApi } from '../../features/workspace/api/workspace.api';
import { qk } from '../../features/workspace/hooks/useWorkspace';
import { Skeleton } from '../../components/ui/States';
import { KeyBar } from '../../features/terminal/components/KeyBar';
import { TerminalPane } from '../../features/terminal/components/TerminalPane';
import { SplitView } from './SplitView';
import type { PooledTerm } from '../../features/terminal/components/terminal-pool';

/** S6 — Phiên terminal: thanh phiên, xterm, thanh phím cảm ứng (mobile). */
export function TerminalPage() {
  const { t } = useTranslation();
  const { hostId = '', projectId = '', sid = '' } = useParams();
  const sessions = useSessions();
  const nav = useNavigate();
  const qc = useQueryClient();
  const target = useRef<PooledTerm | null>(null);
  const cur = sessions.all.find((s) => s.id === sid && s.kind === 'terminal');
  const missing = useMissingSession(sid, !!cur, sessions.isLoading);
  if (missing === 'gone') return <Navigate to="/" replace state={{ notice: 'sessionGone' }} />;
  if (sessions.isLoading || !cur) return <div className="content"><Skeleton rows={2} /></div>;
  return (
    <div className="content flush" data-screen="S6" aria-label={t('term.title')}>
      <SessionBar hostId={hostId} projectId={projectId} currentId={sid} />
      <SplitView hostId={hostId} projectId={projectId} currentId={sid}>
        <TerminalPane
          key={sid}
          sessionId={sid}
          exited={cur.status === 'exited'}
          exitCode={cur.exitCode}
          tmuxName={cur.tmux}
          onClose={() =>
            void workspaceApi.closeTerminal(sid).then(async () => {
              await qc.invalidateQueries({ queryKey: qk.terminals });
              nav(`${pbase(hostId, projectId)}/sessions`);
            })
          }
          onKeyTarget={(p) => (target.current = p)}
        />
      </SplitView>
      <KeyBar
        send={(d) => {
          target.current?.sock?.send(d);
          target.current?.term.focus();
        }}
      />
    </div>
  );
}
