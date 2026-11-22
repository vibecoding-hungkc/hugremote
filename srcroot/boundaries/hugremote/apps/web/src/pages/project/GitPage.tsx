import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { pbase } from '../../app/shell/sessions';
import { GitView } from '../../features/git/components/GitView';

/** S9 — `…/git` và `…/git/history`. */
export function GitPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const [search] = useSearchParams();
  const { hostId = '', projectId = '' } = useParams();
  const base = `${pbase(hostId, projectId)}/git`;
  return (
    <GitView
      key={search.get('file') ?? ''}
      focusPath={search.get('file') ?? undefined}
      projectId={projectId}
      history={loc.pathname.endsWith('/history')}
      onHistory={(on) => nav(on ? `${base}/history` : base)}
      onOpenFile={(p) => nav(`${pbase(hostId, projectId)}/files/${p.split('/').map(encodeURIComponent).join('/')}`)}
    />
  );
}
