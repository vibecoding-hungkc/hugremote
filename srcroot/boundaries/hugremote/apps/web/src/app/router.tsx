import { createHashRouter, Navigate } from 'react-router-dom';
import { AppShell } from './shell/AppShell';
import { RequireAuth } from './RequireAuth';
import { HostsPage } from '../pages/HostsPage';
import { LoginPage } from '../pages/LoginPage';
import { NewProjectPage } from '../pages/NewProjectPage';
import { WorkspacePage } from '../pages/WorkspacePage';
import { ProjectLayout } from '../pages/project/ProjectLayout';
import { SessionsPage } from '../pages/project/SessionsPage';
import { TerminalPage } from '../pages/project/TerminalPage';

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
      { path: '/s/:hostId/new-project/:path?', element: <NewProjectPage /> },
      {
        path: '/s/:hostId/p/:projectId',
        element: <ProjectLayout />,
        children: [
          { index: true, element: <Navigate to="sessions" replace /> },
          { path: 'sessions', element: <SessionsPage /> },
          { path: 'terminal/:sid', element: <TerminalPage /> },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
