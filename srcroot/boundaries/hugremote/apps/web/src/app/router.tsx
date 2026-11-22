import { createHashRouter } from 'react-router-dom';
import { LoginPage } from '../pages/LoginPage';
import { WorkspacePage } from '../pages/WorkspacePage';
import { RequireAuth } from './RequireAuth';

/** Hash router — chạy dưới mọi BASE_PATH, view chính gắn URL (G-11). */
export const router = createHashRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <WorkspacePage />
      </RequireAuth>
    ),
  },
  { path: '*', element: <RequireAuth><WorkspacePage /></RequireAuth> },
]);
