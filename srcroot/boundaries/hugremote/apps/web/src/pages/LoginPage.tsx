import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { LoginView } from '../features/auth/components/LoginView';
import { authApi } from '../features/auth/api/auth.api';
import { useMe } from '../features/auth/hooks/useMe';
import { takeReturnTo } from '../lib/return-to';
import { useAuthStore } from '../stores/auth.store';

export function LoginPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const status = useAuthStore((s) => s.status);
  const me = useMe();
  const shown = useRef(false);
  if (!shown.current) {
    if (status === 'unknown' || (status === 'authenticated' && me.isLoading)) return null;
    // Vào #/login khi đã đăng nhập đủ (F5) → về trang định mở
    if (status === 'authenticated' && me.data && !me.data.mustChangePassword) return <Navigate to={takeReturnTo()} replace />;
    shown.current = true;
  }
  // Đăng nhập rồi nhưng còn phải đổi mật khẩu → vào thẳng bước đặt mật khẩu
  return <LoginGate status={status} mustChange={!!me.data?.mustChangePassword} onDone={async () => {
    qc.removeQueries({ queryKey: ['me'] });
    await qc.fetchQuery({ queryKey: ['me'], queryFn: authApi.me });
    nav(takeReturnTo(), { replace: true });
  }} />;
}

/** Bước đầu chỉ tính MỘT lần khi vào trang — đăng nhập xong không dựng lại form (giữ mật khẩu vừa nhập). */
function LoginGate({ status, mustChange, onDone }: { status: string; mustChange: boolean; onDone: () => void }) {
  const [initial] = useState(status === 'authenticated' && mustChange ? 'newpass' : 'password');
  return (
    <LoginView
      initialStep={initial as 'newpass' | 'password'}
      onDone={onDone}
    />
  );
}
