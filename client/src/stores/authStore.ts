import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { apiUrl, getBasePath } from '../utils/api.js';
import { useI18nStore } from './i18nStore.js';

type AuthMode = 'none' | 'password' | 'google';

interface AuthUser {
  provider: AuthMode;
  email?: string;
  name?: string;
  avatar?: string;
}

export const useAuthStore = defineStore('auth', () => {
  const i18n = useI18nStore();
  const mode = ref<AuthMode>('none');
  const authenticated = ref(false);
  const user = ref<AuthUser | null>(null);
  const loading = ref(true);
  const error = ref('');
  const attemptsLeft = ref<number | null>(null);
  const retryAfterSeconds = ref(0);

  const needsLogin = computed(() => !loading.value && mode.value !== 'none' && !authenticated.value);

  async function fetchMe() {
    loading.value = true;
    error.value = '';
    try {
      const res = await fetch(apiUrl('/api/auth/me'), { credentials: 'include' });
      const data = await res.json();
      mode.value = data.mode || 'none';
      authenticated.value = Boolean(data.authenticated);
      user.value = data.user || null;
    } catch (_) {
      error.value = i18n.t('auth.cannotReach');
      authenticated.value = false;
    } finally {
      loading.value = false;
    }
  }

  async function loginPassword(password: string) {
    error.value = '';
    attemptsLeft.value = null;
    retryAfterSeconds.value = 0;

    const res = await fetch(apiUrl('/api/auth/password'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok && data.success) {
      await fetchMe();
      return true;
    }

    if (data.error === 'locked') {
      retryAfterSeconds.value = Number(data.retryAfterSeconds || 900);
      error.value = i18n.t('auth.locked', { time: formatRetry(retryAfterSeconds.value) });
    } else if (data.error === 'wrong_password') {
      attemptsLeft.value = Number(data.attemptsLeft || 0);
      error.value = i18n.t('auth.wrongPassword', { count: attemptsLeft.value });
    } else {
      error.value = data.error || 'Login failed.';
    }
    return false;
  }

  async function logout() {
    await fetch(apiUrl('/api/auth/logout'), {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {});
    await fetchMe();
  }

  function googleLoginUrl() {
    return `${getBasePath()}/auth/google`;
  }

  return {
    mode,
    authenticated,
    user,
    loading,
    error,
    attemptsLeft,
    retryAfterSeconds,
    needsLogin,
    fetchMe,
    loginPassword,
    logout,
    googleLoginUrl,
  };
});

function formatRetry(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins <= 0) return `${secs}s`;
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}
