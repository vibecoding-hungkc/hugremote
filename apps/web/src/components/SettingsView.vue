<template>
  <section id="view-settings" class="settings-view">
    <div id="settings-language-card" class="settings-card settings-language-card">
      <div class="settings-card-header">
        <div class="settings-card-title-group">
          <div class="settings-card-title">
            <i class="ri-translate-2" style="color: #a3a3a3"></i>
            <span>Ngôn ngữ giao diện</span>
          </div>
          <div class="settings-card-desc">
            Chọn ngôn ngữ hiển thị cho toàn bộ giao diện ứng dụng.
          </div>
        </div>

        <div id="settings-language-selector" class="settings-toolbar-row">
          <button
            v-for="loc in i18n.availableLocales"
            :key="loc"
            type="button"
            class="settings-toggle-pill settings-lang-btn"
            :class="{ active: i18n.locale === loc }"
            :data-locale="loc"
            :aria-pressed="i18n.locale === loc ? 'true' : 'false'"
            @click="onSelectLocale(loc)"
          >
            <span class="settings-lang-flag">{{ i18n.localeLabels[loc].flag }}</span>
            <span>{{ i18n.localeLabels[loc].nativeName }}</span>
          </button>
        </div>
      </div>
    </div>

    <div id="settings-2fa-card" class="settings-card settings-2fa-card">
      <div class="settings-card-header">
        <div class="settings-card-title-group">
          <div class="settings-card-title">
            <i class="ri-shield-keyhole-line" style="color: #a3a3a3"></i>
            <span>Bảo mật 2 lớp · 2FA</span>
            <span
              id="two-factor-status-badge"
              class="version-status-badge"
              :class="twoFactorState.enabled ? 'ok status-indicator' : ''"
            >
              {{ twoFactorState.enabled ? 'Đang bật' : 'Đang tắt' }}
            </span>
            <span v-if="twoFactorState.enabled" class="version-code-pill">
              {{ twoFactorState.remainingRecoveryCodes }} mã khôi phục
            </span>
          </div>
          <div id="two-factor-summary-text" class="settings-card-desc">
            {{
              twoFactorState.enabled
                ? 'Yêu cầu mã 6 số từ ứng dụng Authenticator hoặc mã khôi phục dự phòng khi mở khóa giao diện Web.'
                : 'Tùy chọn bật xác thực 2 lớp bằng ứng dụng Authenticator 6 số kèm 8 mã khôi phục dự phòng cho bản Web.'
            }}
          </div>
        </div>

        <div class="settings-toolbar-row">
          <button
            id="btn-toggle-2fa-setup"
            type="button"
            class="settings-toggle-pill"
            :class="{ active: twoFactorState.enabled || showTwoFactorPanel }"
            :disabled="twoFactorBusy"
            @click="onToggleTwoFactorPanel"
          >
            <i :class="twoFactorState.enabled ? 'ri-shield-check-line' : 'ri-qr-code-line'"></i>
            <span>
              {{
                showTwoFactorPanel
                  ? 'Đóng thiết lập'
                  : twoFactorState.enabled
                  ? 'Tắt 2FA'
                  : 'Thiết lập 2FA'
              }}
            </span>
          </button>
        </div>
      </div>

      <!-- Setup Flow when 2FA is currently disabled -->
      <div
        v-if="showTwoFactorPanel && !twoFactorState.enabled && pendingSetup"
        id="two-factor-setup-panel"
        class="two-factor-panel"
      >
        <div class="two-factor-setup-grid">
          <div id="two-factor-qr-box" class="two-factor-qr-box" v-html="pendingSetup.qrSvg"></div>

          <div class="two-factor-setup-details">
            <div class="two-factor-step-title">
              1. Quét mã QR bằng Google Authenticator, Authy hoặc 1Password
            </div>
            <div class="settings-card-desc">
              Hoặc nhập khóa thiết lập thủ công dưới đây vào ứng dụng Authenticator:
            </div>
            <div class="two-factor-secret-row">
              <code id="two-factor-secret-text" class="two-factor-secret-code">{{ pendingSetup.secret }}</code>
              <button type="button" class="settings-reset-btn" @click="copyText(pendingSetup.secret, 'Đã sao chép khóa 2FA')">
                <i class="ri-file-copy-line"></i>
                <span>Sao chép</span>
              </button>
            </div>

            <div class="two-factor-step-title" style="margin-top: 4px">
              2. Lưu 8 mã khôi phục dự phòng dùng một lần khi mất thiết bị
            </div>
            <div id="two-factor-recovery-list" class="two-factor-recovery-grid">
              <code
                v-for="code in pendingSetup.recoveryCodes"
                :key="code"
                class="two-factor-recovery-item"
              >
                {{ code }}
              </code>
            </div>

            <div class="two-factor-verify-row">
              <input
                id="two-factor-verify-input"
                v-model="twoFactorCodeInput"
                type="text"
                inputmode="numeric"
                maxlength="6"
                placeholder="Nhập mã 6 số từ ứng dụng..."
                class="two-factor-code-input"
                @keyup.enter="handleConfirmEnable2fa"
              />
              <button
                id="btn-confirm-enable-2fa"
                type="button"
                class="settings-toggle-pill active"
                :disabled="twoFactorBusy || twoFactorCodeInput.trim().length < 6"
                @click="handleConfirmEnable2fa"
              >
                <i class="ri-check-line"></i>
                <span>Kích hoạt 2FA</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Disable / Manage Flow when 2FA is currently enabled -->
      <div
        v-if="showTwoFactorPanel && twoFactorState.enabled"
        id="two-factor-disable-panel"
        class="two-factor-panel"
      >
        <div class="two-factor-step-title">
          Nhập mã 6 số từ ứng dụng Authenticator hoặc mã khôi phục để tắt 2FA hoặc tạo lại mã dự phòng
        </div>
        <div class="two-factor-verify-row">
          <input
            id="two-factor-disable-input"
            v-model="twoFactorCodeInput"
            type="text"
            placeholder="Mã 6 số hoặc XXXX-XXXX"
            class="two-factor-code-input"
            @keyup.enter="handleConfirmDisable2fa"
          />
          <button
            id="btn-regenerate-recovery-codes"
            type="button"
            class="settings-reset-btn"
            :disabled="twoFactorBusy || !twoFactorCodeInput.trim()"
            @click="handleRegenerateRecoveryCodes"
          >
            <i class="ri-key-2-line"></i>
            <span>Tạo mới mã dự phòng</span>
          </button>
          <button
            id="btn-confirm-disable-2fa"
            type="button"
            class="settings-reset-btn"
            :disabled="twoFactorBusy || !twoFactorCodeInput.trim()"
            @click="handleConfirmDisable2fa"
          >
            <i class="ri-lock-unlock-line"></i>
            <span>Xác nhận tắt 2FA</span>
          </button>
        </div>

        <div
          v-if="regeneratedRecoveryCodes.length > 0"
          id="two-factor-regenerated-list"
          class="two-factor-recovery-grid"
        >
          <code
            v-for="code in regeneratedRecoveryCodes"
            :key="code"
            class="two-factor-recovery-item"
          >
            {{ code }}
          </code>
        </div>
      </div>

      <div v-if="twoFactorError" id="two-factor-error-text" class="settings-shortcut-notice">
        {{ twoFactorError }}
      </div>
    </div>

    <div id="settings-version-card" class="settings-card settings-version-card">
      <div class="settings-card-header">
        <div class="settings-card-title-group">
          <div class="settings-card-title">
            <i class="ri-rocket-line" style="color: #a3a3a3"></i>
            <span>Phiên bản & Cập nhật</span>
            <span id="current-version-text" class="version-code-pill">
              v{{ versionState.currentVersion }}{{ versionState.currentCommit ? ` · ${versionState.currentCommit}` : '' }}
            </span>
            <span
              id="version-status-badge"
              class="version-status-badge"
              :class="versionState.hasUpdate ? 'warning status-indicator' : 'ok'"
            >
              {{
                versionState.hasUpdate
                  ? `Có bản mới · v${versionState.latestVersion}`
                  : 'Bản mới nhất'
              }}
            </span>
          </div>
          <div id="version-summary-text" class="settings-card-desc">
            {{ versionState.summary }}
          </div>
        </div>

        <div class="settings-toolbar-row">
          <button
            id="btn-check-update"
            type="button"
            class="settings-reset-btn"
            :disabled="checkingVersion || updatingVersion"
            @click="fetchVersionStatus"
          >
            <i class="ri-refresh-line" :class="{ 'spin-anim': checkingVersion }"></i>
            <span>{{ checkingVersion ? 'Đang kiểm tra...' : 'Kiểm tra' }}</span>
          </button>

          <button
            id="btn-quick-update"
            type="button"
            class="settings-toggle-pill"
            :class="{ active: versionState.hasUpdate }"
            :disabled="updatingVersion"
            @click="handleQuickUpdate"
          >
            <i :class="updatingVersion ? 'ri-loader-4-line spin-anim' : 'ri-download-cloud-2-line'"></i>
            <span>
              {{
                updatingVersion
                  ? 'Đang cập nhật...'
                  : versionState.hasUpdate
                  ? 'Cập nhật ngay'
                  : 'Cập nhật nhanh'
              }}
            </span>
          </button>
        </div>
      </div>
    </div>

    <div id="settings-shortcut-card" class="settings-card">
      <div class="settings-card-header">
        <div class="settings-card-title-group">
          <div class="settings-card-title">
            <i class="ri-keyboard-box-line" style="color: #a3a3a3"></i>
            <span>Cài đặt phím tắt</span>
          </div>
          <div class="settings-card-desc">
            Tổ hợp phím dùng chung kết hợp với số thứ tự 1 đến 9 của từng mục. Nhấn tổ hợp phím hiện nhãn để bật hoặc tắt nhãn phím tắt trên cột Workspace.
          </div>
        </div>

        <div class="settings-toolbar-row">
          <button
            id="shortcut-labels-toggle-btn"
            type="button"
            class="settings-toggle-pill"
            :class="{ active: shortcutStore.showLabels }"
            :aria-pressed="shortcutStore.showLabels ? 'true' : 'false'"
            @click="onToggleLabelsClick"
          >
            <i class="ri-price-tag-3-line"></i>
            <span id="shortcut-labels-toggle-text">
              {{
                shortcutStore.showLabels
                  ? `Nhãn phím tắt: Đang hiện · ${shortcutStore.toggleLabelsCombo}`
                  : `Nhãn phím tắt: Đang ẩn · ${shortcutStore.toggleLabelsCombo}`
              }}
            </span>
          </button>

          <button
            id="shortcut-enabled-toggle"
            type="button"
            class="settings-toggle-pill"
            :class="{ active: shortcutStore.enabled }"
            :aria-pressed="shortcutStore.enabled ? 'true' : 'false'"
            @click="onToggleEnabledClick"
          >
            <span class="toggle-dot"></span>
            <span id="shortcut-enabled-label">
              {{ shortcutStore.enabled ? 'Đang bật' : 'Đang tắt' }}
            </span>
          </button>

          <button
            id="btn-reset-shortcuts-default"
            type="button"
            class="settings-reset-btn"
            @click="onResetClick"
          >
            <i class="ri-restart-line"></i>
            <span>Mặc định</span>
          </button>
        </div>
      </div>

      <div id="settings-shortcut-group-list" class="shortcut-group-grid">
        <div
          v-for="meta in groupMetaList"
          :key="meta.key"
          class="shortcut-rule-card"
          :data-shortcut-group="meta.key"
        >
          <div class="shortcut-rule-top">
            <span class="shortcut-rule-name">
              <i :class="meta.icon" :style="{ color: meta.color }"></i>
              <span>{{ meta.title }}</span>
            </span>
            <kbd class="shortcut-rule-preview">{{ getPreviewText(meta) }}</kbd>
          </div>

          <div class="shortcut-preset-row">
            <button
              v-for="preset in meta.presets"
              :key="preset"
              type="button"
              class="shortcut-preset-btn"
              :class="{ active: getCurrentValue(meta) === preset }"
              :data-preset="preset"
              @click="selectPreset(meta, preset)"
            >
              {{ preset }}
            </button>

            <button
              type="button"
              class="shortcut-record-btn"
              :class="{ recording: recordingGroupKey === meta.key }"
              :data-record-group="meta.key"
              @click="toggleRecording(meta.key)"
            >
              <i class="ri-keyboard-line"></i>
              <span>{{ recordingGroupKey === meta.key ? 'Nhấn tổ hợp...' : 'Thu phím' }}</span>
            </button>
          </div>
        </div>
      </div>

      <div v-if="statusNotice" id="settings-shortcut-notice" class="settings-shortcut-notice">
        {{ statusNotice }}
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { apiUrl } from '../utils/api.js';
import { useI18n } from '../composables/useI18n.js';
import { useAuthStore } from '../stores/authStore.js';
import type { Locale } from '../i18n/messages.js';
import {
  normalizeKeyComboFromEvent,
  normalizeKeyToken,
  normalizeModifierPrefix,
  useShortcutStore,
  type ShortcutCategory,
} from '../stores/shortcutStore.js';

interface GroupMetaItem {
  key: ShortcutCategory | 'toggleLabels';
  title: string;
  icon: string;
  color: string;
  presets: string[];
  isSingleCombo: boolean;
}

const { i18n } = useI18n();
const authStore = useAuthStore();
const shortcutStore = useShortcutStore();
const recordingGroupKey = ref<ShortcutCategory | 'toggleLabels' | null>(null);
const statusNotice = ref('');
let noticeTimer: ReturnType<typeof setTimeout> | null = null;

// --- 2FA STATE & HANDLERS ---
const twoFactorState = ref({
  enabled: false,
  remainingRecoveryCodes: 0,
});
const showTwoFactorPanel = ref(false);
const twoFactorBusy = ref(false);
const twoFactorError = ref('');
const twoFactorCodeInput = ref('');
const pendingSetup = ref<{
  secret: string;
  otpauthUrl: string;
  qrSvg: string;
  recoveryCodes: string[];
} | null>(null);
const regeneratedRecoveryCodes = ref<string[]>([]);

async function fetchTwoFactorStatus() {
  try {
    const res = await fetch(apiUrl('/api/auth/2fa/status'), { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();
    if (data && typeof data.enabled === 'boolean') {
      twoFactorState.value = {
        enabled: data.enabled,
        remainingRecoveryCodes: Number(data.remainingRecoveryCodes || 0),
      };
    }
  } catch {
    // Ignore status fetch error in SSR / offline
  }
}

async function onToggleTwoFactorPanel() {
  twoFactorError.value = '';
  twoFactorCodeInput.value = '';
  regeneratedRecoveryCodes.value = [];

  if (showTwoFactorPanel.value) {
    showTwoFactorPanel.value = false;
    pendingSetup.value = null;
    return;
  }

  if (twoFactorState.value.enabled) {
    showTwoFactorPanel.value = true;
    return;
  }

  twoFactorBusy.value = true;
  try {
    const res = await fetch(apiUrl('/api/auth/2fa/setup'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.secret) {
      throw new Error(data.error || 'Không thể khởi tạo thiết lập 2FA');
    }
    pendingSetup.value = {
      secret: data.secret,
      otpauthUrl: data.otpauthUrl || '',
      qrSvg: data.qrSvg || '',
      recoveryCodes: Array.isArray(data.recoveryCodes) ? data.recoveryCodes : [],
    };
    showTwoFactorPanel.value = true;
  } catch (err: any) {
    twoFactorError.value = err?.message || 'Không thể khởi tạo thiết lập 2FA';
  } finally {
    twoFactorBusy.value = false;
  }
}

async function handleConfirmEnable2fa() {
  const code = twoFactorCodeInput.value.trim();
  if (!code || twoFactorBusy.value) return;
  twoFactorBusy.value = true;
  twoFactorError.value = '';
  try {
    const res = await fetch(apiUrl('/api/auth/2fa/enable'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Mã xác thực 6 số không chính xác');
    }
    twoFactorState.value.enabled = true;
    twoFactorState.value.remainingRecoveryCodes = Number(data.remainingRecoveryCodes || 8);
    showTwoFactorPanel.value = false;
    pendingSetup.value = null;
    twoFactorCodeInput.value = '';
    await authStore.fetchMe();
    flashNotice('Đã kích hoạt bảo mật 2 lớp 2FA thành công');
  } catch (err: any) {
    twoFactorError.value = err?.message || 'Không thể kích hoạt 2FA';
  } finally {
    twoFactorBusy.value = false;
  }
}

async function handleConfirmDisable2fa() {
  const code = twoFactorCodeInput.value.trim();
  if (!code || twoFactorBusy.value) return;
  twoFactorBusy.value = true;
  twoFactorError.value = '';
  try {
    const res = await fetch(apiUrl('/api/auth/2fa/disable'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Mã xác thực 2FA hoặc mã khôi phục không hợp lệ');
    }
    twoFactorState.value.enabled = false;
    twoFactorState.value.remainingRecoveryCodes = 0;
    showTwoFactorPanel.value = false;
    twoFactorCodeInput.value = '';
    regeneratedRecoveryCodes.value = [];
    await authStore.fetchMe();
    flashNotice('Đã tắt bảo mật 2 lớp 2FA');
  } catch (err: any) {
    twoFactorError.value = err?.message || 'Không thể tắt 2FA';
  } finally {
    twoFactorBusy.value = false;
  }
}

async function handleRegenerateRecoveryCodes() {
  const code = twoFactorCodeInput.value.trim();
  if (!code || twoFactorBusy.value) return;
  twoFactorBusy.value = true;
  twoFactorError.value = '';
  try {
    const res = await fetch(apiUrl('/api/auth/2fa/recovery-codes'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Mã xác thực 2FA không hợp lệ');
    }
    regeneratedRecoveryCodes.value = Array.isArray(data.recoveryCodes) ? data.recoveryCodes : [];
    twoFactorState.value.remainingRecoveryCodes = Number(data.remainingRecoveryCodes || 8);
    twoFactorCodeInput.value = '';
    flashNotice('Đã tạo mới 8 mã khôi phục dự phòng');
  } catch (err: any) {
    twoFactorError.value = err?.message || 'Không thể tạo mới mã dự phòng';
  } finally {
    twoFactorBusy.value = false;
  }
}

async function copyText(text: string, message: string) {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    }
    flashNotice(message);
  } catch {
    flashNotice(message);
  }
}

// --- VERSION UPDATER STATE & HANDLERS ---
const checkingVersion = ref(false);
const updatingVersion = ref(false);
const versionState = ref({
  currentVersion: '1.6.10',
  currentCommit: '',
  latestVersion: '1.6.10',
  latestCommit: '',
  channel: 'beta' as 'stable' | 'beta',
  hasUpdate: false,
  summary: 'Kiểm tra phiên bản mới từ GitHub để cập nhật nhanh.',
});

async function fetchVersionStatus() {
  checkingVersion.value = true;
  try {
    const res = await fetch(apiUrl('/api/system/version'));
    if (!res.ok) return;
    const data = await res.json();
    if (data && typeof data.currentVersion === 'string') {
      versionState.value = {
        currentVersion: data.currentVersion,
        currentCommit: data.currentCommit || '',
        latestVersion: data.latestVersion || data.currentVersion,
        latestCommit: data.latestCommit || '',
        channel: data.channel === 'stable' ? 'stable' : 'beta',
        hasUpdate: Boolean(data.hasUpdate),
        summary: data.summary || `Đang ở phiên bản v${data.currentVersion}`,
      };
    }
  } catch {
    // Ignore transient network errors during version check
  } finally {
    checkingVersion.value = false;
  }
}

async function handleQuickUpdate() {
  if (updatingVersion.value) return;
  updatingVersion.value = true;
  versionState.value.summary = 'Đang tải mã nguồn mới và biên dịch bản cập nhật...';
  try {
    const res = await fetch(apiUrl('/api/system/update'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: versionState.value.channel }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Cập nhật thất bại');
    }
    const nextVer = data.updatedVersion || versionState.value.latestVersion;
    const nextCommit = data.updatedCommit || versionState.value.latestCommit;
    versionState.value.currentVersion = nextVer;
    versionState.value.currentCommit = nextCommit;
    versionState.value.hasUpdate = false;
    versionState.value.summary = data.message || `Đã cập nhật lên v${nextVer}`;
    flashNotice(versionState.value.summary);

    if (data.restarting && typeof window !== 'undefined') {
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }
  } catch (err: any) {
    const msg = err?.message || 'Không thể cập nhật phiên bản';
    versionState.value.summary = msg;
    flashNotice(msg);
  } finally {
    updatingVersion.value = false;
  }
}

function onSelectLocale(loc: Locale) {
  i18n.setLocale(loc);
  flashNotice(`Đã chuyển ngôn ngữ sang ${i18n.localeLabels[loc].nativeName}`);
}

const groupMetaList: GroupMetaItem[] = [
  {
    key: 'project',
    title: 'Chuyển nhanh Project',
    icon: 'ri-folder-2-line',
    color: '#38bdf8',
    presets: ['Alt', 'Ctrl+Alt', 'Alt+Shift', 'Ctrl+Shift', 'Meta+Alt'],
    isSingleCombo: false,
  },
  {
    key: 'claude',
    title: 'Chuyển nhanh Phiên Claude',
    icon: 'ri-sparkling-fill',
    color: '#f59e0b',
    presets: ['Alt+Shift', 'Alt', 'Ctrl+Alt', 'Ctrl+Shift', 'Meta+Shift'],
    isSingleCombo: false,
  },
  {
    key: 'terminal',
    title: 'Chuyển nhanh Phiên Terminal',
    icon: 'ri-terminal-box-line',
    color: '#c084fc',
    presets: ['Ctrl+Alt', 'Alt', 'Alt+Shift', 'Ctrl+Shift', 'Meta+Alt'],
    isSingleCombo: false,
  },
  {
    key: 'server',
    title: 'Chuyển nhanh Server',
    icon: 'ri-server-line',
    color: '#34d399',
    presets: ['Ctrl+Shift', 'Alt+Shift', 'Ctrl+Alt', 'Meta+Shift'],
    isSingleCombo: false,
  },
  {
    key: 'toggleLabels',
    title: 'Hiện / ẩn nhãn phím tắt trên Sidebar',
    icon: 'ri-price-tag-3-line',
    color: '#a3a3a3',
    presets: ['Alt+K', 'Alt+L', 'Ctrl+Shift+K', 'Alt+/'],
    isSingleCombo: true,
  },
];

function flashNotice(message: string) {
  statusNotice.value = message;
  if (noticeTimer) clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    statusNotice.value = '';
  }, 2400);
}

function getCurrentValue(meta: GroupMetaItem): string {
  if (meta.isSingleCombo) return shortcutStore.toggleLabelsCombo;
  return shortcutStore.groupPrefixes[meta.key as ShortcutCategory];
}

function getPreviewText(meta: GroupMetaItem): string {
  const val = getCurrentValue(meta);
  return meta.isSingleCombo ? val : `${val} + 1..9`;
}

function selectPreset(meta: GroupMetaItem, preset: string) {
  recordingGroupKey.value = null;
  if (meta.isSingleCombo) {
    shortcutStore.setToggleLabelsCombo(preset);
    flashNotice(`Đã đặt phím bật/tắt nhãn: ${preset}`);
  } else {
    shortcutStore.setGroupPrefix(meta.key as ShortcutCategory, preset);
    flashNotice(`Đã đặt bộ phím ${meta.title}: ${preset} + 1..9`);
  }
}

function toggleRecording(key: ShortcutCategory | 'toggleLabels') {
  recordingGroupKey.value = recordingGroupKey.value === key ? null : key;
}

function onToggleLabelsClick() {
  const next = shortcutStore.toggleLabelsVisibility();
  flashNotice(next ? 'Đã hiện nhãn tổ hợp phím tắt trên Sidebar' : 'Đã ẩn nhãn tổ hợp phím tắt, chỉ giữ thin index');
}

function onToggleEnabledClick() {
  const next = shortcutStore.toggleEnabled();
  flashNotice(next ? 'Đã bật phím tắt điều hướng nhanh' : 'Đã tạm tắt phím tắt điều hướng');
}

function onResetClick() {
  recordingGroupKey.value = null;
  shortcutStore.resetToDefaults();
  flashNotice('Đã khôi phục cấu hình phím tắt mặc định');
}

function onRecordKeyDown(event: KeyboardEvent) {
  if (!recordingGroupKey.value) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    recordingGroupKey.value = null;
    return;
  }

  const meta = groupMetaList.find(m => m.key === recordingGroupKey.value);
  if (!meta) return;

  if (meta.isSingleCombo) {
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return;
    const combo = normalizeKeyComboFromEvent(event);
    if (!combo) return;
    event.preventDefault();
    event.stopPropagation();
    shortcutStore.setToggleLabelsCombo(combo);
    recordingGroupKey.value = null;
    flashNotice(`Đã đặt phím bật/tắt nhãn: ${combo}`);
    return;
  }

  const prefix = normalizeModifierPrefix(event);
  const token = normalizeKeyToken(event);
  if (prefix && (token || prefix.includes('+'))) {
    event.preventDefault();
    event.stopPropagation();
    shortcutStore.setGroupPrefix(meta.key as ShortcutCategory, prefix);
    recordingGroupKey.value = null;
    flashNotice(`Đã lưu bộ phím ${meta.title}: ${prefix} + 1..9`);
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onRecordKeyDown, true);
  }
  void fetchTwoFactorStatus();
  void fetchVersionStatus();
});

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onRecordKeyDown, true);
  }
  if (noticeTimer) clearTimeout(noticeTimer);
});
</script>

<style scoped>
.settings-view {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px 16px 28px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 780px;
  width: 100%;
  margin: 0 auto;
}

.settings-card {
  background: #202020;
  border: 1px solid #333333;
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.settings-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.settings-card-title-group {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.settings-card-title {
  font-size: 13.5px;
  font-weight: 700;
  color: #eeeeee;
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
}

.settings-card-desc {
  font-size: 11.5px;
  color: #989898;
  line-height: 1.45;
}

.settings-toolbar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.settings-toggle-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid #383838;
  background: #1b1b1b;
  color: #d4d4d4;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
}

.settings-toggle-pill.active {
  border-color: #525252;
  color: #ffffff;
  background: #2b2b2b;
}

.settings-toggle-pill .toggle-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #666666;
}

.settings-toggle-pill.active .toggle-dot {
  background: #e5e5e5;
}

.settings-reset-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid #383838;
  background: #1b1b1b;
  color: #d4d4d4;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
}

.settings-reset-btn:hover {
  background: #282828;
  color: #ffffff;
}

.two-factor-panel {
  background: #191919;
  border: 1px solid #2e2e2e;
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.two-factor-setup-grid {
  display: grid;
  grid-template-columns: 148px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}

.two-factor-qr-box {
  width: 148px;
  height: 148px;
  background: #ffffff;
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.two-factor-qr-box :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}

.two-factor-setup-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.two-factor-step-title {
  font-size: 12px;
  font-weight: 700;
  color: #e5e5e5;
}

.two-factor-secret-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.two-factor-secret-code {
  font-family: monospace;
  font-size: 11.5px;
  color: #f4f4f4;
  background: #242424;
  border: 1px solid #383838;
  border-radius: 6px;
  padding: 5px 9px;
  letter-spacing: 0.06em;
  word-break: break-all;
}

.two-factor-recovery-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.two-factor-recovery-item {
  font-family: monospace;
  font-size: 11px;
  color: #d4d4d4;
  background: #222222;
  border: 1px solid #343434;
  border-radius: 5px;
  padding: 4px 6px;
  text-align: center;
}

.two-factor-verify-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 2px;
}

.two-factor-code-input {
  height: 32px;
  min-width: 180px;
  flex: 1;
  background: #141414;
  border: 1px solid #3a3a3a;
  border-radius: 6px;
  color: #f4f4f4;
  font-family: monospace;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.12em;
  padding: 0 10px;
  outline: none;
}

.two-factor-code-input:focus {
  border-color: #666666;
}

.shortcut-group-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.shortcut-rule-card {
  background: #191919;
  border: 1px solid #2e2e2e;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shortcut-rule-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.shortcut-rule-name {
  font-size: 12px;
  font-weight: 600;
  color: #e5e5e5;
  display: flex;
  align-items: center;
  gap: 6px;
}

.shortcut-rule-preview {
  font-family: monospace;
  font-size: 11px;
  color: #d4d4d4;
  background: #242424;
  border: 1px solid #3a3a3a;
  border-radius: 5px;
  padding: 2px 7px;
}

.shortcut-preset-row {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
}

.shortcut-preset-btn,
.shortcut-record-btn {
  height: 24px;
  padding: 0 8px;
  border-radius: 5px;
  border: 1px solid #343434;
  background: #222222;
  color: #a8a8a8;
  font-size: 11px;
  font-family: monospace;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.shortcut-preset-btn:hover,
.shortcut-record-btn:hover {
  background: #2c2c2c;
  color: #eeeeee;
}

.shortcut-preset-btn.active {
  background: #333333;
  color: #ffffff;
  border-color: #525252;
  font-weight: 700;
}

.shortcut-record-btn.recording {
  background: #333333;
  color: #ffffff;
  border-color: #737373;
}

.settings-shortcut-notice {
  font-size: 11.5px;
  color: #d4d4d4;
  background: #191919;
  border: 1px solid #333333;
  border-radius: 6px;
  padding: 7px 10px;
}

.version-code-pill {
  font-family: monospace;
  font-size: 11px;
  font-weight: 600;
  color: #d4d4d4;
  background: #181818;
  border: 1px solid #333333;
  border-radius: 5px;
  padding: 1px 7px;
}

.version-status-badge {
  font-family: monospace;
  font-size: 10.5px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid #353535;
  background: #242424;
  color: #d4d4d4;
}

.version-status-badge.ok {
  color: #4ade80;
  background: rgba(34, 197, 94, 0.12);
  border-color: rgba(34, 197, 94, 0.32);
}

.version-status-badge.warning {
  color: #fbbf24;
  background: rgba(245, 158, 11, 0.16);
  border-color: rgba(245, 158, 11, 0.38);
}

.spin-anim {
  animation: settings-spin 0.9s linear infinite;
}

@keyframes settings-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 720px) {
  .shortcut-group-grid {
    grid-template-columns: 1fr;
  }

  .two-factor-setup-grid {
    grid-template-columns: 1fr;
  }

  .two-factor-recovery-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
