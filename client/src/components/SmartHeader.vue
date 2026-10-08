<template>
  <header class="smart-header">
    <!-- Left: Server Management Selector Pill -->
    <div class="smart-header-left">
      <button class="server-selector-btn" @click="$emit('open-server-modal')" title="Quản lý Server & SSH">
        <span class="server-status-dot" :class="serverStore.currentServer.type === 'local' ? 'local' : 'remote'"></span>
        <span class="server-name">{{ serverStore.currentServer.name }}</span>
        <i class="ri-arrow-down-s-line" style="font-size:12px; color:#94a3b8;"></i>
      </button>
    </div>

    <!-- Center: Contextual Info -->
    <div class="smart-header-center">
      <!-- Context: Files (Displaying ONLY last 3 directory levels) -->
      <div v-if="activeTab === 'files'" class="ctx-header-item">
        <div class="breadcrumb-bar">
          <button class="crumb-home-btn" @click="fileStore.fetchFiles('')" title="Về thư mục gốc">
            <i class="ri-folder-open-line"></i>
          </button>
          
          <template v-if="!fileBreadcrumbs.parts.length">
            <span class="crumb-segment current">/</span>
          </template>

          <template v-else>
            <template v-if="fileBreadcrumbs.hasMore">
              <span class="crumb-more" @click="fileStore.fetchFiles(fileBreadcrumbs.parentPath)" title="Thư mục cấp trên">...</span>
              <span class="crumb-sep">/</span>
            </template>
            <template v-for="(part, idx) in fileBreadcrumbs.parts" :key="part.path">
              <span
                class="crumb-segment"
                :class="{ current: part.isLast }"
                @click="fileStore.fetchFiles(part.path)"
              >
                {{ part.name }}
              </span>
              <span v-if="idx < fileBreadcrumbs.parts.length - 1" class="crumb-sep">/</span>
            </template>
          </template>
        </div>
      </div>

      <!-- Context: Editor -->
      <div v-else-if="activeTab === 'editor'" class="ctx-header-item">
        <span class="editor-file-title" :title="fileStore.activeFile?.relPath">
          <i class="ri-file-text-line"></i> {{ fileStore.activeFile?.name || 'Editor' }}
        </span>
        <span v-if="fileStore.activeFile?.isDirty" class="dirty-pill">● Sửa</span>
      </div>

      <!-- Context: Terminal (Displaying last 2 directory levels by default) -->
      <div v-else-if="activeTab === 'terminal'" class="ctx-header-item">
        <button class="term-session-pill" @click="$emit('open-session-hub')" title="Danh sách cửa sổ terminal">
          <i class="ri-terminal-box-line"></i>
          <span class="term-session-name">{{ terminalStore.activeSession?.name || 'terminal' }}</span>
          <span class="badge-count">{{ terminalStore.currentServerSessions.length }}</span>
          <i class="ri-arrow-down-s-line" style="font-size:10px; color:#c084fc;"></i>
        </button>
      </div>

      <!-- Context: Claude -->
      <div v-else-if="activeTab === 'claude'" class="ctx-header-item">
        <button class="claude-session-pill" @click="$emit('open-claude-hub')" title="Danh sách phiên Claude">
          <i class="ri-sparkling-fill" style="color: #d97757;"></i>
          <span class="claude-session-name">{{ claudeStore.activeSession?.name || 'claude' }}</span>
          <span class="badge-count claude-badge">{{ claudeStore.currentServerSessions.length }}</span>
          <i class="ri-arrow-down-s-line" style="font-size:10px; color:#d97757;"></i>
        </button>
      </div>
    </div>

    <!-- Right: Contextual Action Buttons -->
    <div class="smart-header-right">
      <!-- Actions: Files -->
      <template v-if="activeTab === 'files'">
        <button class="btn-icon-action" @click="$emit('prompt-create-item')" title="Tạo mới">
          <i class="ri-add-line"></i>
        </button>
        <button class="btn-icon-action" @click="fileStore.fetchFiles(fileStore.currentRel)" title="Tải lại">
          <i class="ri-refresh-line"></i>
        </button>
      </template>

      <!-- Actions: Editor -->
      <template v-else-if="activeTab === 'editor'">
        <button
          v-if="fileStore.activeFile?.name.endsWith('.md')"
          class="btn-icon-action"
          @click="fileStore.fileMode = fileStore.fileMode === 'code' ? 'preview' : 'code'"
          :title="fileStore.fileMode === 'code' ? 'Xem Preview' : 'Chỉnh sửa Code'"
        >
          <i :class="fileStore.fileMode === 'code' ? 'ri-eye-line' : 'ri-edit-line'"></i>
        </button>
        <button class="btn-icon-action" @click="fileStore.saveActiveFile" title="Lưu (Ctrl+S)">
          <i class="ri-save-line"></i>
        </button>
        <button class="btn-icon-action" @click="fileStore.closeActiveFile(); $emit('change-tab', 'files')" title="Đóng file">
          <i class="ri-close-line"></i>
        </button>
      </template>

      <!-- Actions: Terminal -->
      <template v-else-if="activeTab === 'terminal'">
        <button class="btn-icon-action" @click="$emit('open-new-terminal-modal')" title="Tạo cửa sổ mới">
          <i class="ri-add-line"></i>
        </button>
      </template>

      <!-- Actions: Claude -->
      <template v-else-if="activeTab === 'claude'">
        <button
          class="btn-icon-action"
          :class="{ active: claudeStore.compactTaskMode }"
          @click.stop="claudeStore.toggleCompactTaskMode()"
          :title="claudeStore.compactTaskMode ? 'Tắt chế độ chỉ hiện task hiện tại' : 'Bật chế độ chỉ hiện task hiện tại'"
        >
          <i class="ri-focus-3-line"></i>
        </button>
        <button
          class="btn-icon-action"
          @click.stop="claudeStore.isLimitsPopupOpen = true"
          title="Xem hạn mức 5h & Tuần"
        >
          <i class="ri-dashboard-3-line" style="color: #f59e0b;"></i>
        </button>
        <button class="btn-icon-action" @click="$emit('open-new-claude-modal')" title="Tạo phiên Claude mới">
          <i class="ri-add-line"></i>
        </button>
      </template>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useServerStore } from '../stores/serverStore.js';
import { useFileStore } from '../stores/fileStore.js';
import { useTerminalStore } from '../stores/terminalStore.js';
import { useClaudeStore } from '../stores/claudeStore.js';

defineProps<{
  activeTab: 'files' | 'editor' | 'terminal' | 'claude';
}>();

defineEmits<{
  (e: 'open-server-modal'): void;
  (e: 'open-session-hub'): void;
  (e: 'open-new-terminal-modal'): void;
  (e: 'open-claude-hub'): void;
  (e: 'open-new-claude-modal'): void;
  (e: 'prompt-create-item'): void;
  (e: 'change-tab', tab: 'files' | 'editor' | 'terminal' | 'claude'): void;
}>();

const serverStore = useServerStore();
const fileStore = useFileStore();
const terminalStore = useTerminalStore();
const claudeStore = useClaudeStore();

interface BreadcrumbPart {
  name: string;
  path: string;
  isLast: boolean;
}

// Compute ONLY the last 3 levels of the current directory path
const fileBreadcrumbs = computed(() => {
  const rel = (fileStore.currentRel || '').trim();
  if (!rel) return { hasMore: false, parentPath: '', parts: [] };

  const isAbsolute = rel.startsWith('/');
  const allParts = rel.split('/').filter(Boolean);
  if (allParts.length === 0) return { hasMore: false, parentPath: '', parts: [] };

  const partItems: BreadcrumbPart[] = allParts.map((name, index) => {
    let p = '';
    if (isAbsolute) {
      p = '/' + allParts.slice(0, index + 1).join('/');
    } else {
      p = allParts.slice(0, index + 1).join('/');
    }
    return {
      name,
      path: p,
      isLast: index === allParts.length - 1,
    };
  });

  if (partItems.length <= 3) {
    return {
      hasMore: false,
      parentPath: '',
      parts: partItems,
    };
  }

  // More than 3 levels -> slice last 3, provide parent path for '...'
  const parentOfLast3 = partItems[partItems.length - 4].path;
  return {
    hasMore: true,
    parentPath: parentOfLast3,
    parts: partItems.slice(-3),
  };
});
</script>

<style scoped>
.smart-header {
  height: 40px;
  background: #0f172a;
  border-bottom: 1px solid #1e293b;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  gap: 8px;
  flex-shrink: 0;
  z-index: 40;
}

.smart-header-left {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.server-selector-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 8px;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 6px;
  color: #f1f5f9;
  font-family: monospace;
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
}

.server-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.server-status-dot.local {
  background: #3b82f6;
  box-shadow: 0 0 6px rgba(59, 130, 246, 0.7);
}
.server-status-dot.remote {
  background: #10b981;
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.7);
}

.server-name {
  max-width: 95px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.smart-header-center {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  overflow: hidden;
}

.ctx-header-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  overflow: hidden;
}

.breadcrumb-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-family: monospace;
  white-space: nowrap;
  overflow-x: auto;
  color: #94a3b8;
}

.crumb-home-btn {
  background: transparent;
  border: none;
  color: #60a5fa;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 2px 4px;
}

.crumb-more {
  color: #64748b;
  cursor: pointer;
  padding: 0 2px;
}

.crumb-segment {
  color: #94a3b8;
  cursor: pointer;
  white-space: nowrap;
}
.crumb-segment.current {
  color: #f1f5f9;
  font-weight: 700;
  max-width: 110px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.crumb-sep {
  color: #475569;
  font-size: 11px;
}

.editor-file-title {
  font-size: 12px;
  font-family: monospace;
  font-weight: 600;
  color: #e2e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 4px;
}

.dirty-pill {
  font-size: 9.5px;
  background: rgba(234, 179, 8, 0.2);
  color: #fbbf24;
  border: 1px solid rgba(234, 179, 8, 0.4);
  padding: 1px 5px;
  border-radius: 4px;
  font-weight: 600;
}

.term-session-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 8px;
  background: #1e1b4b;
  border: 1px solid #4338ca;
  border-radius: 6px;
  color: #e0e7ff;
  font-size: 11.5px;
  font-family: monospace;
  font-weight: 600;
  cursor: pointer;
  max-width: 100%;
}

.term-session-name {
  max-width: 130px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge-count {
  background: #6366f1;
  color: #fff;
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 10px;
  flex-shrink: 0;
}

.claude-session-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 8px;
  background: #2a201c;
  border: 1px solid rgba(217, 119, 87, 0.4);
  border-radius: 6px;
  color: #f8fafc;
  font-size: 11.5px;
  font-family: monospace;
  font-weight: 600;
  cursor: pointer;
  max-width: 100%;
}

.claude-session-pill:hover {
  background: #382924;
  border-color: #d97757;
}

.claude-session-name {
  max-width: 130px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge-count.claude-badge {
  background: #d97757;
}

.smart-header-right {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.btn-icon-action {
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
}
.btn-icon-action:active {
  background: #334155;
}

.btn-icon-action.active {
  color: #d97757;
  background: rgba(217, 119, 87, 0.14);
  border-color: rgba(217, 119, 87, 0.32);
}

.btn-icon-action.danger {
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.35);
  background: rgba(239, 68, 68, 0.08);
}
.btn-icon-action.danger:hover {
  background: rgba(239, 68, 68, 0.18);
  border-color: rgba(239, 68, 68, 0.5);
  color: #f87171;
}
.btn-icon-action.danger:active {
  background: rgba(239, 68, 68, 0.28);
}
</style>
