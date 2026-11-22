import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useMe } from '../features/auth/hooks/useMe';
import { saveReturnTo } from '../lib/return-to';
import { useAuthStore } from '../stores/auth.store';

/** Chưa đăng nhập → lưu đích rồi về S1 (AC-48). Còn phải đổi mật khẩu → S1 bước đặt mật khẩu. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const loc = useLocation();
  const me = useMe();
  if (status === 'unknown') return null;
  if (status === 'anonymous') {
    saveReturnTo('#' + loc.pathname + loc.search);
    return <Navigate to="/login" replace />;
  }
  if (me.data?.mustChangePassword) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
