import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { pbase } from '../../app/shell/sessions';
import { GitView } from '../../features/git/components/GitView';

/** S9 — `…/git` và `…/git/history`. */
export function GitPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const { hostId = '', projectId = '' } = useParams();
  const base = `${pbase(hostId, projectId)}/git`;
  return (
    <GitView
      projectId={projectId}
      history={loc.pathname.endsWith('/history')}
      onHistory={(on) => nav(on ? `${base}/history` : base)}
      onOpenFile={(p) => nav(`${pbase(hostId, projectId)}/files/${p.split('/').map(encodeURIComponent).join('/')}`)}
    />
  );
}
