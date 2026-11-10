import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { apiUrl, getBasePath } from '../utils/api.js';
import { useI18nStore } from './i18nStore.js';

type AuthMode = 'none' | 'password' | 'google' | 'oidc' | 'both';

interface AuthUser {
  provider: AuthMode;
  email?: string;
  name?: string;
  avatar?: string;
  mustChangePassword?: boolean;
  twoFactorVerified?: boolean;
}

export const useAuthStore = defineStore('auth', () => {
  const i18n = useI18nStore();
  const mode = ref<AuthMode>('none');
  const authenticated = ref(false);
  const user = ref<AuthUser | null>(null);
  const mustChangePassword = ref(false);
  const twoFactorEnabled = ref(false);
  const requiresTwoFactor = ref(false);
  const oidcButtonLabel = ref('Tiếp tục với Single Sign-On · OIDC');
  const oidcConfigured = ref(false);
  const oidcCallbackUrl = ref('');
  const loading = ref(true);
  const error = ref('');
  const attemptsLeft = ref<number | null>(null);
  const retryAfterSeconds = ref(0);

  const needsLogin = computed(() => {
    if (loading.value) return false;
    if (requiresTwoFactor.value) return true;
    if (mode.value === 'none' && !twoFactorEnabled.value) return false;
    if (!authenticated.value) return true;
    if (mustChangePassword.value) return true;
    return false;
  });

  async function fetchMe() {
    loading.value = true;
    error.value = '';
    try {
      const res = await fetch(apiUrl('/api/auth/me'), { credentials: 'include' });
      const data = await res.json();
      mode.value = data.mode || 'none';
      authenticated.value = Boolean(data.authenticated);
      user.value = data.user || null;
      mustChangePassword.value = Boolean(data.mustChangePassword || data.user?.mustChangePassword);
      twoFactorEnabled.value = Boolean(data.twoFactorEnabled);
      requiresTwoFactor.value = Boolean(data.requiresTwoFactor);
      oidcButtonLabel.value = data.oidcButtonLabel || 'Tiếp tục với Single Sign-On · OIDC';
      oidcConfigured.value = Boolean(data.oidcConfigured);
      oidcCallbackUrl.value = data.oidcCallbackUrl || '';
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
      mustChangePassword.value = Boolean(data.mustChangePassword);
      requiresTwoFactor.value = Boolean(data.requiresTwoFactor);
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

  async function verifyTwoFactor(code: string): Promise<boolean> {
    error.value = '';
    try {
      const res = await fetch(apiUrl('/api/auth/2fa/verify'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        requiresTwoFactor.value = false;
        await fetchMe();
        return true;
      }
      error.value = data.message || i18n.t('auth.invalidTwoFactorCode');
      return false;
    } catch (_) {
      error.value = i18n.t('auth.cannotReach');
      return false;
    }
  }

  async function changePassword(newPassword: string, currentPassword?: string): Promise<boolean> {
    error.value = '';
    try {
      const res = await fetch(apiUrl('/api/auth/change-password'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword, currentPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        mustChangePassword.value = false;
        await fetchMe();
        return true;
      }
      if (data.error === 'password_too_short') {
        error.value = i18n.t('auth.passwordTooShort');
      } else if (data.error === 'cannot_use_default_password') {
        error.value = i18n.t('auth.cannotUseDefault');
      } else {
        error.value = data.error || 'Failed to change password.';
      }
      return false;
    } catch (_) {
      error.value = i18n.t('auth.cannotReach');
      return false;
    }
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

  function oidcLoginUrl() {
    return `${getBasePath()}/auth/oidc`;
  }

  return {
    mode,
    authenticated,
    user,
    mustChangePassword,
    twoFactorEnabled,
    requiresTwoFactor,
    oidcButtonLabel,
    oidcConfigured,
    oidcCallbackUrl,
    changePassword,
    verifyTwoFactor,
    loading,
    error,
    attemptsLeft,
    retryAfterSeconds,
    needsLogin,
    fetchMe,
    loginPassword,
    logout,
    googleLoginUrl,
    oidcLoginUrl,
  };
});

function formatRetry(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins <= 0) return `${secs}s`;
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}
