import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../../stores/auth.store';
import { authApi } from '../api/auth.api';

export function useMe() {
  const status = useAuthStore((s) => s.status);
  return useQuery({ queryKey: ['me'], queryFn: authApi.me, enabled: status === 'authenticated', staleTime: 60_000 });
}
