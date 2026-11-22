import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api-client';
import { LoginView } from '../features/auth/components/LoginView';
import { authApi } from '../features/auth/api/auth.api';
import { useMe } from '../features/auth/hooks/useMe';
import { saveReturnTo, takeReturnTo } from '../lib/return-to';
import { useAuthStore } from '../stores/auth.store';

export function LoginPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const status = useAuthStore((s) => s.status);
  const me = useMe();
  const shown = useRef(false);
  const [search] = useSearchParams();
  const sso = useQuery({ queryKey: ['ssopublic'], queryFn: () => api<{ enabled: boolean; provider?: string; label?: string }>('/auth/sso'), staleTime: 60_000 });
  // về từ callback SSO: refresh cookie đã có → Boot đã xin access token; đích nằm ở `to`
  const to = search.get('to');
  if (to) saveReturnTo(to);
  if (!shown.current) {
    if (status === 'unknown' || (status === 'authenticated' && me.isLoading)) return null;
    // Vào #/login khi đã đăng nhập đủ (F5) → về trang định mở
    if (status === 'authenticated' && me.data && !me.data.mustChangePassword) return <Navigate to={takeReturnTo()} replace />;
    shown.current = true;
  }
  // Đăng nhập rồi nhưng còn phải đổi mật khẩu → vào thẳng bước đặt mật khẩu
  const ssoInfo = sso.data?.enabled && sso.data.provider ? { provider: sso.data.provider, label: sso.data.label ?? 'SSO' } : null;
  return <LoginGate status={status} mustChange={!!me.data?.mustChangePassword} sso={ssoInfo} ssoError={search.get('sso_error')} onDone={async () => {
    qc.removeQueries({ queryKey: ['me'] });
    await qc.fetchQuery({ queryKey: ['me'], queryFn: authApi.me });
    nav(takeReturnTo(), { replace: true });
  }} />;
}

/** Bước đầu chỉ tính MỘT lần khi vào trang — đăng nhập xong không dựng lại form (giữ mật khẩu vừa nhập). */
function LoginGate({
  status,
  mustChange,
  onDone,
  sso,
  ssoError,
}: {
  status: string;
  mustChange: boolean;
  onDone: () => void;
  sso: { provider: string; label: string } | null;
  ssoError: string | null;
}) {
  const [initial] = useState(status === 'authenticated' && mustChange ? 'newpass' : 'password');
  return (
    <LoginView
      initialStep={initial as 'newpass' | 'password'}
      onDone={onDone}
      sso={sso}
      ssoError={ssoError}
    />
  );
}
