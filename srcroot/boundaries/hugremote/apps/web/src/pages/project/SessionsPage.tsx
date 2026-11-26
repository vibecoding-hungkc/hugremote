import { useTranslation } from 'react-i18next';
import { Navigate, useParams } from 'react-router-dom';
import { useNewSession } from '../../app/shell/actions';
import { SessionBar } from '../../app/shell/SessionBar';
import { useSessions } from '../../app/shell/sessions';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/States';
import { useHosts, useProject } from '../../features/workspace/hooks/useWorkspace';

/** Dự án chưa có phiên → đúng hai nút tạo (Authority lượt 2); có phiên → chuyển vào phiên đầu. */
export function SessionsPage() {
  const { t } = useTranslation();
  const { hostId = '', projectId = '' } = useParams();
  const project = useProject(projectId).data;
  const host = useHosts().data?.hosts.find((h) => h.id === hostId);
  const newSession = useNewSession();
  // dự án đã có phiên (vd vừa đóng/xoá phiên đang đứng) → vào phiên đầu thay vì báo "chưa có phiên" (dogfood smoke V1)
  const ss = useSessions();
  const first = ss.byProject.get(projectId)?.[0];
  if (ss.isLoading) return <div className="content flush" data-screen="S6" />;
  if (first) return <Navigate to={`/s/${encodeURIComponent(hostId)}/p/${projectId}/${first.kind}/${first.id}`} replace />;
  return (
    <div className="content flush" data-screen="S6" aria-label={t('tabs.sessions')}>
      <SessionBar hostId={hostId} projectId={projectId} />
      <div className="content">
        <EmptyState
          icon="sessions"
          message={t('session.emptyProject', { project: project?.name ?? '', path: project?.rootPath ?? '', host: host?.name ?? hostId })}
          action={
            <>
              <Button variant="primary" icon="claude" onClick={() => void newSession('claude', hostId, projectId)}>
                {t('session.newClaude')}
              </Button>
              <Button icon="term" write onClick={() => void newSession('terminal', hostId, projectId)}>
                {t('session.newTerminal')}
              </Button>
            </>
          }
        />
      </div>
    </div>
  );
}
