import { useEffect } from 'react';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { authApi, type Me } from '../../features/auth/api/auth.api';
import { useProject } from '../../features/workspace/hooks/useWorkspace';
import { ErrorBox, Skeleton } from '../../components/ui/States';
import { pbase } from '../../app/shell/sessions';

/** Khung trong dự án: nhớ tab đang dùng theo dự án (users.preferences.lastTab — AC-12). */
export function ProjectLayout() {
  const { t } = useTranslation();
  const { hostId = '', projectId = '' } = useParams();
  const loc = useLocation();
  const qc = useQueryClient();
  const project = useProject(projectId);
  useEffect(() => {
    const tail = loc.pathname.slice(pbase(hostId, projectId).length + 1);
    if (!tail || tail === 'sessions' || tail.endsWith('/new')) return;
    const tab = tail.startsWith('files') ? 'files' : tail.startsWith('git') ? 'git' : tail;
    // cập nhật luôn cache `me` — openProject đọc lastTab từ cache, không chờ refetch (dogfood smoke #22)
    qc.setQueryData<Me>(['me'], (m) => (m ? { ...m, preferences: { ...m.preferences, lastTab: { ...m.preferences.lastTab, [projectId]: tab } } } : m));
    void authApi.patchPreferences({ lastTab: { [projectId]: tab } }).catch(() => undefined);
  }, [loc.pathname, hostId, projectId, qc]);
  if (project.isLoading) return <div className="content"><Skeleton rows={3} /></div>;
  if (project.isError) return <div className="content"><ErrorBox title={t('errors.NOT_FOUND')} body={t('project.gone')} /></div>;
  return <Outlet />;
}
