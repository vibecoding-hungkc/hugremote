import { create } from 'zustand';

/** Access token chỉ nằm trong bộ nhớ (không localStorage — skill §7). Refresh token là cookie httpOnly. */
interface AuthState {
  accessToken: string | null;
  status: 'unknown' | 'anonymous' | 'authenticated';
  setToken: (t: string | null) => void;
  setStatus: (s: AuthState['status']) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  status: 'unknown',
  setToken: (accessToken) => set({ accessToken, status: accessToken ? 'authenticated' : 'anonymous' }),
  setStatus: (status) => set({ status }),
}));
