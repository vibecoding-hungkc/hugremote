<template>
  <div v-if="isOpen" class="hub-overlay" @click.self="$emit('close')">
    <div class="hub-sheet">
      <div class="hub-header">
        <div class="hub-title">
          <i class="ri-terminal-box-line"></i>
          Cửa sổ Terminal ({{ serverStore.currentServer.name }})
        </div>
        <div class="hub-header-actions">
          <button class="btn-action-icon" @click="$emit('open-new')" title="Tạo cửa sổ mới">
            <i class="ri-add-line"></i>
          </button>
          <button class="btn-hub-close" @click="$emit('close')"><i class="ri-close-line"></i></button>
        </div>
      </div>

      <div class="hub-cards">
        <div
          v-for="s in terminalStore.currentServerSessions"
          :key="s.id"
          class="hub-card"
          :class="{ active: s.id === terminalStore.activeSessionId }"
          @click="selectSession(s.id)"
        >
          <div class="hub-card-top">
            <span class="hub-card-name"><i class="ri-terminal-line"></i> {{ s.name }}</span>
            <span v-if="s.id === terminalStore.activeSessionId" class="hub-badge-active">● Đang chọn</span>
          </div>
          <div class="hub-card-actions" @click.stop>
            <button class="btn-action-icon" @click="$emit('edit-session', s)" title="Chỉnh sửa">
              <i class="ri-edit-line"></i>
            </button>
            <button
              v-if="terminalStore.currentServerSessions.length > 1"
              class="btn-action-icon danger"
              @click="terminalStore.closeSession(s.id)"
              title="Đóng / Xóa cửa sổ"
            >
              <i class="ri-delete-bin-line"></i>
            </button>
          </div>
        </div>
      </div>

      <button class="btn-hub-create" @click="$emit('open-new')">
        <i class="ri-add-line"></i> Tạo cửa sổ Terminal mới
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useServerStore } from '../stores/serverStore.js';
import { useTerminalStore } from '../stores/terminalStore.js';

defineProps<{ isOpen: boolean }>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'open-new'): void;
  (e: 'edit-session', session: any): void;
  (e: 'select'): void;
}>();

const serverStore = useServerStore();
const terminalStore = useTerminalStore();

function selectSession(id: string) {
  terminalStore.switchSession(id);
  emit('select');
  emit('close');
}
</script>
