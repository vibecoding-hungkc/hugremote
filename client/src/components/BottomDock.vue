<template>
  <nav class="bottom-dock">
    <button
      class="dock-item"
      :class="{ active: activeTab === 'files' || activeTab === 'editor' }"
      @click="$emit('change-tab', 'files')"
    >
      <i class="ri-folder-2-line dock-icon"></i>
      <span class="dock-label">Files</span>
    </button>

    <button
      class="dock-item"
      :class="{ active: activeTab === 'terminal' }"
      @click="$emit('change-tab', 'terminal')"
    >
      <i class="ri-terminal-box-line dock-icon"></i>
      <span class="dock-label">Terminal</span>
      <span class="dock-badge">{{ terminalStore.currentServerSessions.length }}</span>
    </button>

    <button
      class="dock-item"
      :class="{ active: activeTab === 'claude' }"
      @click="$emit('change-tab', 'claude')"
    >
      <i class="ri-sparkling-fill dock-icon" style="color: #d97757;"></i>
      <span class="dock-label">Claude</span>
      <span class="dock-badge claude-badge">{{ claudeStore.currentServerSessions.length }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import { useTerminalStore } from '../stores/terminalStore.js';
import { useClaudeStore } from '../stores/claudeStore.js';

defineProps<{
  activeTab: 'files' | 'editor' | 'terminal' | 'claude';
}>();

defineEmits<{
  (e: 'change-tab', tab: 'files' | 'editor' | 'terminal' | 'claude'): void;
}>();

const terminalStore = useTerminalStore();
const claudeStore = useClaudeStore();
</script>

<style scoped>
.bottom-dock {
  height: calc(42px + env(safe-area-inset-bottom, 0px));
  padding-bottom: env(safe-area-inset-bottom, 0px);
  background: #090e1a;
  border-top: 1px solid #1e293b;
  display: flex;
  align-items: center;
  justify-content: space-around;
  flex-shrink: 0;
  z-index: 40;
}

.dock-item {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: transparent;
  border: none;
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  position: relative;
  touch-action: manipulation;
}
.dock-item.active {
  color: #38bdf8;
  background: #0f172a;
}
.dock-item.active::after {
  content: '';
  position: absolute;
  top: 0;
  left: 20%;
  right: 20%;
  height: 2px;
  background: #38bdf8;
}

.dock-icon {
  font-size: 16px;
}

.dock-badge {
  background: #6366f1;
  color: #fff;
  font-size: 9.5px;
  font-family: monospace;
  padding: 1px 5px;
  border-radius: 10px;
  margin-left: 2px;
}

.dock-badge.claude-badge {
  background: #d97757;
}
</style>
