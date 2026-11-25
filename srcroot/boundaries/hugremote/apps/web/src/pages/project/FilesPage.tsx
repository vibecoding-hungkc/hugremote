import { desktop } from '../../features/web/web.api';
import { useNavigate, useParams } from 'react-router-dom';
import { useNewSession } from '../../app/shell/actions';
import { pbase } from '../../app/shell/sessions';
import { FilesView } from '../../features/files/components/FilesView';
import { useProject } from '../../features/workspace/hooks/useWorkspace';

/** S8 — URL `…/files/<đường dẫn>/<dòng>`: F5 mở lại đúng file, đúng dòng (G-11, AC-48). */
export function FilesPage() {
  const nav = useNavigate();
  const { hostId = '', projectId = '', '*': splat = '' } = useParams();
  const project = useProject(projectId).data;
  const newSession = useNewSession();
  const segs = splat.split('/').filter(Boolean).map(decodeURIComponent);
  const line = segs.length > 1 && /^\d+$/.test(segs[segs.length - 1]) ? Number(segs.pop()) : undefined;
  const path = segs.join('/') || undefined;
  const base = `${pbase(hostId, projectId)}/files`;
  if (!project) return null;
  return (
    <FilesView
      projectId={projectId}
      rootPath={project.rootPath}
      isHome={project.isHome}
      path={path}
      line={line}
      onRoute={(p, l) => nav(p ? `${base}/${p.split('/').map(encodeURIComponent).join('/')}${l ? `/${l}` : ''}` : base, { replace: !!path && p === path })}
      actions={{
        openTerminalAt: (dir) => void newSession('terminal', hostId, projectId, { cwd: dir || undefined }),
              openInBrowser: desktop() ? (rel) => void newSession('web', hostId, projectId, { url: `file://${project.rootPath}/${rel}` }) : undefined,
        sendToClaude: (p) => nav(`${pbase(hostId, projectId)}/claude/new?attach=${encodeURIComponent(p)}`),
      }}
    />
  );
}
