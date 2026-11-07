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
const shortcutStore = useShortcutStore();
const recordingGroupKey = ref<ShortcutCategory | 'toggleLabels' | null>(null);
const statusNotice = ref('');
let noticeTimer: ReturnType<typeof setTimeout> | null = null;

const checkingVersion = ref(false);
const updatingVersion = ref(false);
const versionState = ref({
  currentVersion: '1.6.7',
  currentCommit: '',
  latestVersion: '1.6.7',
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
}
</style>
