<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="$emit('close')">
    <div class="bottom-sheet" @click.stop>
      <div class="sheet-handle"></div>
      <div class="sheet-header">
        <div class="sheet-title">
          <i class="ri-sparkling-fill" style="color: #d97757;"></i> Quản lý Phiên Claude
        </div>
        <div class="sheet-actions">
          <button class="btn-action-icon" @click="$emit('open-new-modal')" title="Tạo phiên mới">
            <i class="ri-add-line"></i>
          </button>
          <button class="btn-close-sheet" @click="$emit('close')"><i class="ri-close-line"></i></button>
        </div>
      </div>

      <div class="sessions-list">
        <div v-if="!claudeStore.currentServerSessions.length" class="empty-sessions">
          Chưa có phiên Claude nào. Nhấn "+ Tạo mới" để bắt đầu.
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
              {{ s.messages.length }} tin nhắn • Context: {{ s.messages.length === 0 ? '0' : (s.contextTokens || '0') }}/1000k
            </div>
          </div>

          <div class="session-actions" @click.stop>
            <button class="btn-action-icon" @click="$emit('edit-session', s)" title="Chỉnh sửa đầy đủ">
              <i class="ri-edit-line"></i>
            </button>
            <button class="btn-action-icon danger" @click="$emit('delete-session', s)" title="Xóa">
              <i class="ri-delete-bin-line"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useClaudeStore } from '../stores/claudeStore.js';

defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'open-new-modal'): void;
  (e: 'edit-session', session: any): void;
  (e: 'delete-session', session: any): void;
}>();

const claudeStore = useClaudeStore();

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
  max-width: 600px;
  background: #18181b;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px 16px 0 0;
  padding: 12px 16px 24px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.sheet-handle {
  width: 36px;
  height: 4px;
  background: #3f3f46;
  border-radius: 2px;
  margin: 0 auto 12px;
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
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

.btn-new-session {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  background: #d97757;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

.btn-close-sheet {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 16px;
  cursor: pointer;
  padding: 4px 6px;
}

.sessions-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  max-height: 60vh;
}

.empty-sessions {
  text-align: center;
  color: #71717a;
  font-size: 13px;
  padding: 24px 0;
}

.session-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #27272a;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 10px 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.session-card.active {
  border-color: #d97757;
  background: #2e2624;
}

.session-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
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
}

.session-model-pill {
  font-size: 10.5px;
  background: rgba(217, 119, 87, 0.15);
  color: #f97316;
  padding: 1px 6px;
  border-radius: 4px;
}

.session-cwd {
  font-size: 11.5px;
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
  gap: 4px;
  margin-left: 8px;
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

.btn-action-icon:active {
  background: #334155;
  transform: scale(0.96);
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

.btn-action-icon.danger:active {
  background: rgba(239, 68, 68, 0.28);
}
</style>
