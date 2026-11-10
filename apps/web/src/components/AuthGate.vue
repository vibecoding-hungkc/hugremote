<template>
  <div class="auth-gate">
    <div class="auth-card">
      <div class="auth-logo">
        <div class="auth-logo-mark">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="34" height="34">
            <defs>
              <linearGradient id="gate-logo-bg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#1e293b"/>
                <stop offset="1" stop-color="#090d16"/>
              </linearGradient>
              <linearGradient id="gate-logo-code" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#7dd3fc"/>
                <stop offset="1" stop-color="#38bdf8"/>
              </linearGradient>
            </defs>
            <rect x="2" y="2" width="60" height="60" rx="15" fill="url(#gate-logo-bg)"/>
            <rect x="2" y="2" width="60" height="60" rx="15" fill="none" stroke="#334155" stroke-width="2"/>
            <path d="M24 22 L15 32 L24 42" fill="none" stroke="url(#gate-logo-code)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M40 22 L49 32 L40 42" fill="none" stroke="#d97757" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
            <line x1="36" y1="20" x2="28" y2="44" stroke="#e2e8f0" stroke-width="4.5" stroke-linecap="round"/>
          </svg>
        </div>
        <div>
          <h1>HugRemote</h1>
          <p>{{ t('auth.subtitle') }}</p>
        </div>
      </div>

      <!-- Mandatory first-time password change -->
      <div v-if="auth.mustChangePassword" class="auth-form" @keyup.enter="submitNewPassword">
        <div class="must-change-badge">
          <i class="ri-shield-keyhole-line"></i>
          <span>{{ t('auth.changePasswordTitle') }}</span>
        </div>
        <p class="must-change-desc">{{ t('auth.changePasswordDesc') }}</p>

        <label class="auth-label" for="auth-new-password">{{ t('auth.newPasswordLabel') }}</label>
        <input
          id="auth-new-password"
          ref="newPasswordInput"
          v-model="newPassword"
          class="auth-input"
          type="password"
          autocomplete="new-password"
          :placeholder="t('auth.newPasswordPlaceholder')"
          :disabled="submitting"
        />

        <label class="auth-label" for="auth-confirm-password">{{ t('auth.confirmPasswordLabel') }}</label>
        <input
          id="auth-confirm-password"
          v-model="confirmPassword"
          class="auth-input"
          type="password"
          autocomplete="new-password"
          :placeholder="t('auth.confirmPasswordPlaceholder')"
          :disabled="submitting"
        />

        <button
          class="auth-button"
          :disabled="submitting || !newPassword || !confirmPassword"
          @click="submitNewPassword"
        >
          <span v-if="submitting" class="auth-spinner"></span>
          <span>{{ submitting ? t('auth.unlocking') : t('auth.saveNewPassword') }}</span>
        </button>
      </div>

      <!-- Step 2: Two-Factor Authentication (TOTP 6-digit or Recovery Code) -->
      <div v-else-if="auth.requiresTwoFactor" class="auth-form" @keyup.enter="submitTwoFactor">
        <div class="must-change-badge">
          <i class="ri-shield-check-line"></i>
          <span>{{ t('auth.twoFactorTitle') }}</span>
        </div>
        <p class="must-change-desc">{{ t('auth.twoFactorDesc') }}</p>

        <label class="auth-label" for="auth-2fa-code">{{ t('auth.twoFactorCodeLabel') }}</label>
        <input
          id="auth-2fa-code"
          ref="twoFactorInput"
          v-model="twoFactorCode"
          class="auth-input auth-2fa-input"
          type="text"
          inputmode="text"
          autocomplete="one-time-code"
          :placeholder="t('auth.twoFactorPlaceholder')"
          :disabled="submitting"
        />

        <button
          id="btn-verify-2fa"
          class="auth-button"
          :disabled="submitting || !twoFactorCode.trim()"
          @click="submitTwoFactor"
        >
          <span v-if="submitting" class="auth-spinner"></span>
          <span>{{ submitting ? t('auth.unlocking') : t('auth.verifyTwoFactorBtn') }}</span>
        </button>
      </div>

      <div v-else-if="auth.mode === 'password' || auth.mode === 'both'" class="auth-form" @keyup.enter="submitPassword">
        <label class="auth-label" for="auth-password">{{ t('auth.passwordLabel') }}</label>
        <input
          id="auth-password"
          ref="passwordInput"
          v-model="password"
          class="auth-input"
          type="password"
          inputmode="text"
          autocomplete="current-password"
          :placeholder="t('auth.passwordPlaceholder')"
          :disabled="submitting || auth.retryAfterSeconds > 0"
        />
        <button
          class="auth-button"
          :disabled="submitting || !password || auth.retryAfterSeconds > 0"
          @click="submitPassword"
        >
          <span v-if="submitting" class="auth-spinner"></span>
          <span>{{ submitting ? t('auth.unlocking') : t('auth.unlock') }}</span>
        </button>

        <template v-if="auth.mode === 'both'">
          <div class="auth-divider">
            <span>{{ t('auth.or') || 'Hoặc' }}</span>
          </div>
          <a class="auth-button oidc" :href="auth.oidcLoginUrl()">
            <i class="ri-shield-user-line"></i>
            <span>{{ auth.oidcButtonLabel }}</span>
          </a>
        </template>
      </div>

      <div v-else-if="auth.mode === 'oidc'" class="auth-form">
        <a class="auth-button oidc" :href="auth.oidcLoginUrl()">
          <i class="ri-shield-user-line"></i>
          <span>{{ auth.oidcButtonLabel }}</span>
        </a>
      </div>

      <div v-else-if="auth.mode === 'google'" class="auth-form">
        <a class="auth-button google" :href="auth.googleLoginUrl()">
          <i class="ri-google-fill"></i>
          <span>{{ t('auth.google') }}</span>
        </a>
      </div>

      <div v-else class="auth-form">
        <button class="auth-button" @click="auth.fetchMe">{{ t('common.retry') }}</button>
      </div>

      <p v-if="displayError" class="auth-error">{{ displayError }}</p>
      <p v-else class="auth-hint">
        {{
          auth.requiresTwoFactor
            ? t('auth.twoFactorHint')
            : auth.mode === 'google'
            ? t('auth.googleHint')
            : auth.mode === 'oidc'
            ? t('auth.oidcHint')
            : auth.mode === 'both'
            ? t('auth.bothHint')
            : t('auth.passwordHint')
        }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useAuthStore } from '../stores/authStore.js';
import { useI18n } from '../composables/useI18n.js';

const auth = useAuthStore();
const { t } = useI18n();
const password = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const twoFactorCode = ref('');
const validationError = ref('');
const submitting = ref(false);
const passwordInput = ref<HTMLInputElement | null>(null);
const newPasswordInput = ref<HTMLInputElement | null>(null);
const twoFactorInput = ref<HTMLInputElement | null>(null);
let lockTimer: ReturnType<typeof setInterval> | null = null;

const displayError = computed(() => validationError.value || auth.error);

async function submitPassword() {
  validationError.value = '';
  if (!password.value || submitting.value || auth.retryAfterSeconds > 0) return;
  submitting.value = true;
  const ok = await auth.loginPassword(password.value);
  submitting.value = false;
  password.value = '';
  if (!ok) {
    focusActiveField();
  } else if (auth.mustChangePassword) {
    nextTick(() => newPasswordInput.value?.focus());
  } else if (auth.requiresTwoFactor) {
    nextTick(() => twoFactorInput.value?.focus());
  }
}

async function submitTwoFactor() {
  validationError.value = '';
  const code = twoFactorCode.value.trim();
  if (!code || submitting.value) return;
  submitting.value = true;
  const ok = await auth.verifyTwoFactor(code);
  submitting.value = false;
  if (!ok) {
    twoFactorCode.value = '';
    nextTick(() => twoFactorInput.value?.focus());
  }
}

async function submitNewPassword() {
  validationError.value = '';
  if (newPassword.value.length < 6) {
    validationError.value = t('auth.passwordTooShort');
    return;
  }
  if (newPassword.value === '123456') {
    validationError.value = t('auth.cannotUseDefault');
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    validationError.value = t('auth.passwordMismatch');
    return;
  }

  submitting.value = true;
  const ok = await auth.changePassword(newPassword.value);
  submitting.value = false;
  if (!ok) {
    newPassword.value = '';
    confirmPassword.value = '';
    nextTick(() => newPasswordInput.value?.focus());
  } else if (auth.requiresTwoFactor) {
    nextTick(() => twoFactorInput.value?.focus());
  }
}

function focusActiveField() {
  nextTick(() => {
    if (auth.mustChangePassword) {
      newPasswordInput.value?.focus();
    } else if (auth.requiresTwoFactor) {
      twoFactorInput.value?.focus();
    } else {
      passwordInput.value?.focus();
    }
  });
}

watch(
  () => [auth.mustChangePassword, auth.requiresTwoFactor],
  () => {
    focusActiveField();
  }
);

watch(() => auth.retryAfterSeconds, (seconds) => {
  if (lockTimer) {
    clearInterval(lockTimer);
    lockTimer = null;
  }
  if (seconds > 0) {
    lockTimer = setInterval(() => {
      if (auth.retryAfterSeconds > 0) auth.retryAfterSeconds -= 1;
      if (auth.retryAfterSeconds <= 0 && lockTimer) {
        clearInterval(lockTimer);
        lockTimer = null;
        auth.error = '';
      }
    }, 1000);
  }
});

onMounted(() => {
  const params = new URLSearchParams(window.location.search);
  const err = params.get('error');
  if (err) {
    auth.error = err === 'email_not_allowed'
      ? t('auth.googleDenied')
      : t('auth.loginFailed', { error: err });
    window.history.replaceState({}, '', window.location.pathname);
  }
  focusActiveField();
});

onUnmounted(() => {
  if (lockTimer) clearInterval(lockTimer);
});
</script>

<style scoped>
.auth-gate {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px max(24px, env(safe-area-inset-bottom));
  background:
    radial-gradient(circle at 50% 0%, rgba(64, 64, 64, 0.16), transparent 36%),
    #161616;
  z-index: 9999;
}

.auth-card {
  width: min(100%, 390px);
  background: rgba(23, 23, 23, 0.96);
  border: 1px solid rgba(125, 125, 125, 0.2);
  border-radius: 18px;
  padding: 22px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
}

.auth-logo {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 22px;
}

.auth-logo-mark {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: rgba(64, 64, 64, 0.14);
  border: 1px solid rgba(125, 125, 125, 0.35);
  font-size: 25px;
}

.auth-logo h1 {
  font-size: 22px;
  line-height: 1.1;
  color: #f8fafc;
}

.auth-logo p {
  margin-top: 4px;
  color: #a1a1a1;
  font-size: 13px;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.auth-label {
  color: #d4d4d4;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.auth-input {
  height: 46px;
  border-radius: 12px;
  border: 1px solid #3f3f3f;
  background: #161616;
  color: #f8fafc;
  padding: 0 14px;
  font-size: 16px;
  outline: none;
}

.auth-2fa-input {
  font-family: monospace;
  letter-spacing: 0.14em;
  text-align: center;
  font-weight: 700;
}

.auth-input:focus {
  border-color: #7d7d7d;
  box-shadow: 0 0 0 3px rgba(64, 64, 64, 0.16);
}

.auth-button {
  height: 46px;
  border: 0;
  border-radius: 12px;
  background: #404040;
  color: #fff;
  font-weight: 800;
  font-size: 15px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  text-decoration: none;
}

.auth-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.auth-button.google {
  background: #f8fafc;
  color: #989898;
}

.auth-button.oidc {
  background: #262626;
  color: #eeeeee;
  border: 1px solid #3d3d3d;
}

.auth-button.oidc:hover {
  background: #333333;
}

.auth-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #737373;
  font-size: 11.5px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 4px 0;
}

.auth-divider::before,
.auth-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #333333;
}

.must-change-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(64, 64, 64, 0.14);
  border: 1px solid rgba(125, 125, 125, 0.35);
  color: #c1c1c1;
  font-size: 13px;
  font-weight: 700;
  padding: 6px 10px;
  border-radius: 8px;
  margin-bottom: 4px;
}

.must-change-desc {
  font-size: 12.5px;
  line-height: 1.45;
  color: #d4d4d4;
  margin-bottom: 8px;
}

.auth-error {
  margin-top: 14px;
  color: #b7b7b7;
  font-size: 13px;
  line-height: 1.45;
}

.auth-hint {
  margin-top: 14px;
  color: #989898;
  font-size: 12.5px;
  line-height: 1.45;
}

.auth-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.45);
  border-top-color: #fff;
  border-radius: 999px;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
