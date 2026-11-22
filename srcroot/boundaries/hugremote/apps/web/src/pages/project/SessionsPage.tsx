import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useNewSession } from '../../app/shell/actions';
import { SessionBar } from '../../app/shell/SessionBar';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/States';
import { useHosts, useProject } from '../../features/workspace/hooks/useWorkspace';

/** Dự án chưa có phiên → đúng hai nút tạo (Authority lượt 2). */
export function SessionsPage() {
  const { t } = useTranslation();
  const { hostId = '', projectId = '' } = useParams();
  const project = useProject(projectId).data;
  const host = useHosts().data?.hosts.find((h) => h.id === hostId);
  const newSession = useNewSession();
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
