<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="$emit('close')">
    <div class="bottom-sheet" @click.stop>
      <div class="sheet-handle"></div>
      <div class="sheet-header">
        <div class="sheet-title">
          <i class="ri-sparkling-fill" style="color: #d97757;"></i> {{ t('claudeHub.title') }}
        </div>
        <div class="sheet-actions">
          <button class="btn-action-icon" @click="$emit('open-new-modal')" :title="t('claudeHub.new')">
            <i class="ri-add-line"></i>
          </button>
          <button class="btn-close-sheet" @click="$emit('close')"><i class="ri-close-line"></i></button>
        </div>
      </div>

      <!-- Tab Switcher -->
      <div class="hub-tabs">
        <button
          class="hub-tab"
          :class="{ active: activeTab === 'cli' }"
          @click="activeTab = 'cli'"
        >
          <i class="ri-terminal-box-line"></i>
          <span>{{ t('claudeHub.tabCliSessions') }}</span>
          <span class="hub-tab-badge">{{ claudeStore.projectSessions.length }}</span>
        </button>
        <button
          class="hub-tab"
          :class="{ active: activeTab === 'web' }"
          @click="activeTab = 'web'"
        >
          <i class="ri-chat-3-line"></i>
          <span>{{ t('claudeHub.tabWebSessions') }}</span>
          <span class="hub-tab-badge">{{ claudeStore.currentServerSessions.length }}</span>
        </button>
      </div>

      <!-- Tab 1: Claude Code CLI Project Sessions -->
      <div v-if="activeTab === 'cli'" class="tab-content">
        <div class="hub-toolbar">
          <div class="hub-search-wrap">
            <i class="ri-search-line"></i>
            <input
              v-model="cliSearchQuery"
              type="text"
              class="hub-search-input"
              :placeholder="t('claudeHub.searchPlaceholder')"
            />
            <button
              v-if="cliSearchQuery"
              class="hub-clear-search"
              @click="cliSearchQuery = ''"
            >
              <i class="ri-close-circle-fill"></i>
            </button>
          </div>
          <button
            class="hub-refresh-btn"
            :class="{ spinning: claudeStore.isLoadingProjectSessions }"
            :title="t('claudeHub.refresh')"
            @click="refreshCliSessions"
          >
            <i class="ri-refresh-line"></i>
          </button>
        </div>

        <div v-if="claudeStore.isLoadingProjectSessions && !claudeStore.projectSessions.length" class="empty-sessions">
          <i class="ri-loader-4-line spin-icon"></i> Đang đọc dữ liệu phiên từ ~/.claude/projects/...
        </div>

        <div v-else-if="!filteredCliSessions.length" class="empty-sessions">
          <i class="ri-folder-info-line empty-icon"></i>
          <p>{{ t('claudeHub.cliEmpty') }}</p>
          <span class="empty-sub">Đường dẫn: <code>{{ currentCwd }}</code></span>
        </div>

        <div v-else class="sessions-list">
          <div
            v-for="s in filteredCliSessions"
            :key="s.id"
            class="session-card cli-card"
            :class="{ active: isConnectedCli(s.id) }"
            @click="handleResumeCli(s)"
          >
            <div class="session-info">
              <div class="session-name-row">
                <div v-if="editingCliId === s.id" class="inline-rename-wrap" @click.stop>
                  <input
                    ref="renameInputRef"
                    v-model="editingCliName"
                    type="text"
                    class="inline-rename-input"
                    placeholder="Nhập tên phiên..."
                    @keydown.enter.stop="saveRenameCli(s.id)"
                    @keydown.esc.stop="cancelRenameCli"
                  />
                  <button class="btn-inline-action save" :disabled="isSavingRename" @click.stop="saveRenameCli(s.id)" title="Lưu">
                    <i v-if="isSavingRename" class="ri-loader-4-line spin-icon"></i>
                    <i v-else class="ri-check-line"></i>
                  </button>
                  <button class="btn-inline-action cancel" @click.stop="cancelRenameCli" title="Hủy">
                    <i class="ri-close-line"></i>
                  </button>
                </div>
                <span v-else class="session-name">{{ s.summary || 'Phiên chưa đặt tên' }}</span>
              </div>
              <div class="cli-meta-row">
                <span class="session-id-pill" :title="s.id">
                  <i class="ri-hashtag"></i> {{ s.id.slice(0, 8) }}
                </span>
                <span class="session-model-pill">{{ s.model }}</span>
                <span v-if="s.branch" class="session-branch-pill">
                  <i class="ri-git-branch-line"></i> {{ s.branch }}
                </span>
                <span class="cli-msg-count">
                  {{ s.userMsgs }} {{ t('claudeHub.messages') }}
                </span>
                <span v-if="s.contextTokens && s.contextTokens !== '0'" class="cli-msg-count" :title="`Context: ${s.contextTokens}`">
                  <i class="ri-cpu-line"></i> {{ s.contextTokens }}
                </span>
                <span v-if="s.totalCostUSD" class="cli-msg-count" :title="`Cost: $${s.totalCostUSD.toFixed(4)}`">
                  <i class="ri-money-dollar-circle-line"></i> ${{ s.totalCostUSD.toFixed(3) }}
                </span>
                <span class="cli-time">
                  {{ formatTime(s.updatedAt) }}
                </span>
              </div>
            </div>

            <div class="session-actions" @click.stop>
              <div v-if="isConnectedCli(s.id)" class="connected-badge">
                <span class="live-dot"></span>
                <span>{{ t('claudeHub.connected') }}</span>
              </div>
              <button
                v-else
                class="btn-resume-cli"
                :disabled="resumingId === s.id"
                @click="handleResumeCli(s)"
              >
                <i v-if="resumingId === s.id" class="ri-loader-4-line spin-icon"></i>
                <i v-else class="ri-play-circle-line"></i>
                <span>{{ t('claudeHub.resumeBtn') }}</span>
              </button>

              <button
                class="btn-action-icon"
                :title="t('claudeHub.edit') || 'Đổi tên'"
                @click.stop="startRenameCli(s)"
              >
                <i class="ri-edit-line"></i>
              </button>
              <button
                class="btn-action-icon danger"
                :disabled="deletingCliId === s.id"
                :title="t('claudeHub.delete') || 'Xóa phiên'"
                @click.stop="handleDeleteCli(s)"
              >
                <i v-if="deletingCliId === s.id" class="ri-loader-4-line spin-icon"></i>
                <i v-else class="ri-delete-bin-line"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab 2: HugRemote Web Sessions -->
      <div v-if="activeTab === 'web'" class="tab-content">
        <div class="sessions-list">
          <div v-if="!claudeStore.currentServerSessions.length" class="empty-sessions">
            {{ t('claudeHub.empty') }}
          </div>

          <div
            v-for="s in claudeStore.currentServerSessions"
            :key="s.id"
            class="session-card"
            :class="{ active: claudeStore.activeSessionId === s.id }"
            @click="selectSession(s.id)"
          >
            <div class="session-info">
              <div class="session-name-row">
                <span class="session-name">{{ s.name }}</span>
                <span class="session-model-pill">{{ s.model }}</span>
              </div>
              <div class="session-cwd">
                <i class="ri-folder-line"></i> {{ s.cwd }}
              </div>
              <div class="session-stats">
                {{ s.messages.length }} {{ t('claudeHub.messages') }} • {{ t('claudeHub.context') }}: {{ s.messages.length === 0 ? '0' : (s.contextTokens || '0') }}/{{ getModelContextLabel(s.model) }}
              </div>
            </div>

            <div class="session-actions" @click.stop>
              <button class="btn-action-icon" @click="$emit('edit-session', s)" :title="t('claudeHub.edit')">
                <i class="ri-edit-line"></i>
              </button>
              <button class="btn-action-icon danger" @click="$emit('delete-session', s)" :title="t('claudeHub.delete')">
                <i class="ri-delete-bin-line"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useClaudeStore } from '../stores/claudeStore.js';
import { useProjectStore } from '../stores/projectStore.js';
import { useServerStore } from '../stores/serverStore.js';
import { useI18n } from '../composables/useI18n.js';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'open-new-modal'): void;
  (e: 'edit-session', session: any): void;
  (e: 'delete-session', session: any): void;
}>();

const claudeStore = useClaudeStore();
const projectStore = useProjectStore();
const serverStore = useServerStore();
const { t } = useI18n();

const activeTab = ref<'cli' | 'web'>('cli');
const cliSearchQuery = ref('');
const resumingId = ref<string | null>(null);
const editingCliId = ref<string | null>(null);
const editingCliName = ref('');
const isSavingRename = ref(false);
const deletingCliId = ref<string | null>(null);
const renameInputRef = ref<HTMLInputElement | null>(null);

function getModelContextLabel(modelName?: string): string {
  const m = (modelName || '').toLowerCase();
  if (m.includes('1m') || m.includes('1000k')) return '1000k';
  return '200k';
}

const currentCwd = computed(() => {
  return projectStore.currentProject?.rootPath || claudeStore.activeSession?.cwd || serverStore.currentServer.workspace || '~';
});

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      refreshCliSessions();
    }
  },
  { immediate: true }
);

function refreshCliSessions() {
  claudeStore.fetchProjectSessions(currentCwd.value, serverStore.currentServerId);
}

const filteredCliSessions = computed(() => {
  const list = claudeStore.projectSessions;
  const q = cliSearchQuery.value.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (s) =>
      s.id.toLowerCase().includes(q) ||
      s.summary.toLowerCase().includes(q) ||
      (s.firstPrompt && s.firstPrompt.toLowerCase().includes(q)) ||
      (s.lastPrompt && s.lastPrompt.toLowerCase().includes(q)) ||
      (s.branch && s.branch.toLowerCase().includes(q))
  );
});

function isConnectedCli(id: string) {
  return claudeStore.activeSession?.cliSessionId === id;
}

function formatTime(timestamp: number) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (isToday) return `Hôm nay ${timeStr}`;
  const dateStr = `${d.getDate()}/${d.getMonth() + 1}`;
  return `${dateStr} ${timeStr}`;
}

async function handleResumeCli(sOrId: any) {
  const id = typeof sOrId === 'string' ? sOrId : sOrId.id;
  const sObj = typeof sOrId === 'object' ? sOrId : filteredCliSessions.value.find((x) => x.id === id);
  if (isConnectedCli(id)) {
    emit('close');
    return;
  }
  resumingId.value = id;
  try {
    const targetCwd = sObj?.cwd || currentCwd.value;
    await claudeStore.resumeProjectSession(
      id,
      targetCwd,
      claudeStore.activeSession?.id,
      serverStore.currentServerId
    );
    emit('close');
  } catch (err) {
    console.error('handleResumeCli error:', err);
  } finally {
    resumingId.value = null;
  }
}

function startRenameCli(s: any) {
  editingCliId.value = s.id;
  editingCliName.value = s.summary || '';
  setTimeout(() => {
    renameInputRef.value?.focus();
    renameInputRef.value?.select();
  }, 50);
}

function cancelRenameCli() {
  editingCliId.value = null;
  editingCliName.value = '';
}

async function saveRenameCli(id: string) {
  const name = editingCliName.value.trim();
  if (!name) return;
  isSavingRename.value = true;
  try {
    const ok = await claudeStore.renameProjectSession(
      id,
      name,
      currentCwd.value,
      serverStore.currentServerId
    );
    if (ok) {
      editingCliId.value = null;
      editingCliName.value = '';
    }
  } catch (err) {
    console.error('saveRenameCli error:', err);
  } finally {
    isSavingRename.value = false;
  }
}

async function handleDeleteCli(s: any) {
  const displayName = s.summary || s.id.slice(0, 8);
  if (!window.confirm(`Bạn có chắc chắn muốn xóa phiên "${displayName}" khỏi dự án không?`)) {
    return;
  }
  deletingCliId.value = s.id;
  try {
    await claudeStore.deleteProjectSession(
      s.id,
      currentCwd.value,
      serverStore.currentServerId
    );
  } catch (err) {
    console.error('handleDeleteCli error:', err);
  } finally {
    deletingCliId.value = null;
  }
}

function selectSession(id: string) {
  claudeStore.switchSession(id);
  emit('close');
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.bottom-sheet {
  width: 100%;
  max-width: 640px;
  background: #18181b;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px 16px 0 0;
  padding: 12px 16px 24px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
}

.sheet-handle {
  width: 36px;
  height: 4px;
  background: #3f3f46;
  border-radius: 2px;
  margin: 0 auto 10px;
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.sheet-title {
  font-size: 15px;
  font-weight: 600;
  color: #f1f5f9;
  display: flex;
  align-items: center;
  gap: 6px;
}

.sheet-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-close-sheet {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 16px;
  cursor: pointer;
  padding: 4px 6px;
}

/* Hub Tabs */
.hub-tabs {
  display: flex;
  gap: 6px;
  background: #1e1e24;
  padding: 3px;
  border-radius: 8px;
  margin-bottom: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.hub-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 10px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #94a3b8;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.hub-tab:hover {
  color: #e2e8f0;
}

.hub-tab.active {
  background: #27272a;
  color: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.hub-tab-badge {
  font-size: 10px;
  background: rgba(255, 255, 255, 0.1);
  padding: 1px 5px;
  border-radius: 10px;
}

.hub-tab.active .hub-tab-badge {
  background: rgba(217, 119, 87, 0.25);
  color: #f97316;
}

/* Tab content */
.tab-content {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}

/* Toolbar */
.hub-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.hub-search-wrap {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
}

.hub-search-wrap i.ri-search-line {
  position: absolute;
  left: 9px;
  color: #64748b;
  font-size: 13px;
  pointer-events: none;
}

.hub-search-input {
  width: 100%;
  background: #202024;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 7px;
  padding: 6px 28px 6px 28px;
  font-size: 12.5px;
  color: #f1f5f9;
  outline: none;
}

.hub-search-input:focus {
  border-color: #d97757;
}

.hub-clear-search {
  position: absolute;
  right: 8px;
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  font-size: 13px;
  padding: 0;
  display: flex;
  align-items: center;
}

.hub-refresh-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #202024;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 7px;
  color: #94a3b8;
  cursor: pointer;
  font-size: 14px;
}

.hub-refresh-btn:hover {
  background: #2a2a30;
  color: #f1f5f9;
}

.hub-refresh-btn.spinning i {
  animation: spin 0.8s linear infinite;
}

/* Sessions list */
.sessions-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  max-height: 55vh;
  padding-right: 2px;
}

.empty-sessions {
  text-align: center;
  color: #71717a;
  font-size: 13px;
  padding: 32px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.empty-icon {
  font-size: 32px;
  color: #475569;
}

.empty-sub {
  font-size: 11px;
  color: #64748b;
}

.empty-sub code {
  background: rgba(255, 255, 255, 0.06);
  padding: 2px 5px;
  border-radius: 4px;
  color: #cbd5e1;
}

.session-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #242428;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 9px;
  padding: 10px 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.session-card:hover {
  background: #2b2b30;
  border-color: rgba(255, 255, 255, 0.12);
}

.session-card.active {
  border-color: #d97757;
  background: #2d2422;
}

.session-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.session-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.session-name {
  font-size: 13.5px;
  font-weight: 600;
  color: #f8fafc;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-model-pill {
  font-size: 10px;
  background: rgba(217, 119, 87, 0.15);
  color: #f97316;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.session-id-pill {
  font-size: 10.5px;
  background: rgba(255, 255, 255, 0.07);
  color: #94a3b8;
  padding: 1px 5px;
  border-radius: 4px;
  font-family: monospace;
}

.session-branch-pill {
  font-size: 10.5px;
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
  padding: 1px 5px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.cli-meta-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 11px;
}

.cli-msg-count,
.cli-time {
  color: #71717a;
  font-size: 11px;
}

.session-cwd {
  font-size: 11px;
  color: #94a3b8;
  display: flex;
  align-items: center;
  gap: 4px;
}

.session-stats {
  font-size: 11px;
  color: #71717a;
}

.session-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 10px;
  flex-shrink: 0;
}

.connected-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 600;
  color: #34d399;
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.3);
  padding: 3px 8px;
  border-radius: 6px;
}

.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 6px #10b981;
}

.btn-resume-cli {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  background: #d97757;
  color: #fff;
  border: none;
  padding: 5px 11px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-resume-cli:hover {
  background: #e08365;
}

.btn-resume-cli:active {
  transform: scale(0.96);
}

.btn-resume-cli:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-action-icon {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 6px;
  color: #cbd5e1;
  font-size: 15px;
  cursor: pointer;
  touch-action: manipulation;
  flex-shrink: 0;
}

.btn-action-icon:hover {
  background: #273549;
  color: #f1f5f9;
}

.btn-action-icon.danger {
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.35);
  background: rgba(239, 68, 68, 0.08);
}

.btn-action-icon.danger:hover {
  background: rgba(239, 68, 68, 0.18);
  border-color: rgba(239, 68, 68, 0.5);
  color: #f87171;
}

.spin-icon {
  animation: spin 0.8s linear infinite;
}

.inline-rename-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
}

.inline-rename-input {
  flex: 1;
  min-width: 120px;
  background: #18181b;
  border: 1px solid #d97757;
  color: #f8fafc;
  font-size: 13px;
  padding: 3px 8px;
  border-radius: 6px;
  outline: none;
}

.inline-rename-input:focus {
  border-color: #f97316;
  box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.2);
}

.btn-inline-action {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: none;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.btn-inline-action.save {
  background: #10b981;
  color: #fff;
}

.btn-inline-action.save:hover {
  background: #059669;
}

.btn-inline-action.cancel {
  background: #334155;
  color: #94a3b8;
}

.btn-inline-action.cancel:hover {
  background: #475569;
  color: #f1f5f9;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>