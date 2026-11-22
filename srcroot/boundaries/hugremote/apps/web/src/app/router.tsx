import { createHashRouter, Navigate } from 'react-router-dom';
import { AppShell } from './shell/AppShell';
import { RequireAuth } from './RequireAuth';
import { HostsPage } from '../pages/HostsPage';
import { LoginPage } from '../pages/LoginPage';
import { NewProjectPage } from '../pages/NewProjectPage';
import { WorkspacePage } from '../pages/WorkspacePage';
import { ProjectLayout } from '../pages/project/ProjectLayout';
import { SessionsPage } from '../pages/project/SessionsPage';

/** Hash router — chạy dưới mọi BASE_PATH, view chính gắn URL (G-11). */
export const router = createHashRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { path: '/', element: <WorkspacePage /> },
      { path: '/hosts', element: <HostsPage /> },
      { path: '/settings', lazy: () => import('../pages/SettingsPage').then((m) => ({ Component: m.SettingsPage })) },
      { path: '/s/:hostId/new-project/:path?', element: <NewProjectPage /> },
      {
        path: '/s/:hostId/p/:projectId',
        element: <ProjectLayout />,
        children: [
          { index: true, element: <Navigate to="sessions" replace /> },
          { path: 'sessions', element: <SessionsPage /> },
          { path: 'terminal/:sid', lazy: () => import('../pages/project/TerminalPage').then((m) => ({ Component: m.TerminalPage })) },
          { path: 'claude/:sid', lazy: () => import('../pages/project/ClaudePage').then((m) => ({ Component: m.ClaudePage })) },
          { path: 'files/*', lazy: () => import('../pages/project/FilesPage').then((m) => ({ Component: m.FilesPage })) },
          { path: 'git', lazy: () => import('../pages/project/GitPage').then((m) => ({ Component: m.GitPage })) },
          { path: 'git/history', lazy: () => import('../pages/project/GitPage').then((m) => ({ Component: m.GitPage })) },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
