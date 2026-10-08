<template>
  <div class="file-explorer-container">
    <!-- Parent Directory Navigation Button -->
    <div v-if="fileStore.currentRel" class="parent-nav-row" @click="handleGoParent">
      <i class="ri-arrow-up-line"></i>
      <span>.. (Parent folder)</span>
    </div>

    <!-- Loading / Error States -->
    <div v-if="fileStore.loading" class="state-box">
      <i class="ri-loader-4-line spin"></i> {{ t('fileExplorer.loading') }}
    </div>
    <div v-else-if="fileStore.error" class="state-box error">
      <i class="ri-error-warning-line"></i> {{ fileStore.error }}
    </div>

    <!-- Empty State -->
    <div v-else-if="fileStore.entries.length === 0" class="state-box">
      <i class="ri-folder-open-line"></i> {{ t('fileExplorer.empty') }}
    </div>

    <!-- File List -->
    <div v-else class="file-list">
      <div
        v-for="item in fileStore.entries"
        :key="item.relPath"
        class="file-row"
        @click="handleItemClick(item)"
      >
        <div class="file-left">
          <i
            class="item-icon"
            :class="item.isDirectory ? 'ri-folder-fill folder' : getFileIcon(item.ext)"
          ></i>
          <div class="item-details">
            <span class="item-name">{{ item.name }}</span>
            <span class="item-meta">
              {{ item.isDirectory ? t('fileExplorer.folder') : formatSize(item.size) }}
            </span>
          </div>
        </div>

        <div class="file-actions" @click.stop>
          <button class="btn-action-icon" @click="openRename(item)" :title="t('common.edit')">
            <i class="ri-edit-line"></i>
          </button>
          <button class="btn-action-icon danger" @click="openDelete(item)" :title="t('common.delete')">
            <i class="ri-delete-bin-line"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- Rename Modal -->
    <InputModal
      ref="renameModalRef"
      :is-open="isRenameModalOpen"
      :title="t('common.edit')"
      icon="ri-edit-line"
      :description="t('fileExplorer.renameDescription', { name: targetItem?.name || '' })"
      :placeholder="t('fileExplorer.renamePlaceholder')"
      :initial-value="targetItem?.name || ''"
      :confirm-label="t('fileExplorer.saveChanges')"
      @close="isRenameModalOpen = false"
      @confirm="executeRename"
    />

    <!-- Delete Confirmation Modal -->
    <ConfirmModal
      ref="deleteModalRef"
      :is-open="isDeleteModalOpen"
      :title="t('fileExplorer.deleteTitle')"
      icon="ri-delete-bin-line"
      :message="t('fileExplorer.deleteMessage', { type: targetItem?.isDirectory ? t('fileExplorer.folder').toLowerCase() : t('fileExplorer.file'), name: targetItem?.name || '' })"
      :confirm-label="t('fileExplorer.deleteNow')"
      :is-danger="true"
      @close="isDeleteModalOpen = false"
      @confirm="executeDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useFileStore, FileEntry } from '../stores/fileStore.js';
import InputModal from './InputModal.vue';
import ConfirmModal from './ConfirmModal.vue';
import { useI18n } from '../composables/useI18n.js';

const emit = defineEmits<{ (e: 'open-file', relPath: string): void }>();
const fileStore = useFileStore();
const { t } = useI18n();

const targetItem = ref<FileEntry | null>(null);
const isRenameModalOpen = ref(false);
const isDeleteModalOpen = ref(false);

const renameModalRef = ref<any>(null);
const deleteModalRef = ref<any>(null);

function handleItemClick(item: FileEntry) {
  if (item.isDirectory) {
    fileStore.fetchFiles(item.relPath);
  } else {
    emit('open-file', item.relPath);
  }
}

function handleGoParent() {
  const parts = fileStore.currentRel.split('/').filter(Boolean);
  parts.pop();
  fileStore.fetchFiles(parts.join('/'));
}

function openRename(item: FileEntry) {
  targetItem.value = item;
  isRenameModalOpen.value = true;
}

async function executeRename(newName: string) {
  if (!targetItem.value) return;
  const item = targetItem.value;
  if (!newName || newName === item.name) {
    isRenameModalOpen.value = false;
    return;
  }
  const parent = item.relPath.includes('/') ? item.relPath.substring(0, item.relPath.lastIndexOf('/')) : '';
  const newRel = parent ? `${parent}/${newName}` : newName;
  try {
    await fileStore.renameItem(item.relPath, newRel);
    isRenameModalOpen.value = false;
  } catch (err: any) {
    renameModalRef.value?.setError(`Lỗi đổi tên: ${err.message}`);
  }
}

function openDelete(item: FileEntry) {
  targetItem.value = item;
  isDeleteModalOpen.value = true;
}

async function executeDelete() {
  if (!targetItem.value) return;
  const item = targetItem.value;
  try {
    await fileStore.deleteItem(item.relPath);
    isDeleteModalOpen.value = false;
  } catch (err: any) {
    deleteModalRef.value?.setError(`Lỗi xóa: ${err.message}`);
  }
}

function getFileIcon(ext: string): string {
  switch (ext) {
    case '.js':
    case '.ts':
      return 'ri-javascript-line code-js';
    case '.json':
      return 'ri-braces-line code-json';
    case '.md':
      return 'ri-markdown-line code-md';
    case '.html':
    case '.vue':
      return 'ri-html5-line code-html';
    case '.css':
      return 'ri-css3-line code-css';
    case '.py':
      return 'ri-terminal-box-line code-py';
    default:
      return 'ri-file-text-line';
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
</script>

<style scoped>
.file-explorer-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  background: #090d16;
}

.parent-nav-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: #111827;
  border-bottom: 1px solid #1f2937;
  color: #60a5fa;
  font-family: monospace;
  font-size: 13px;
  cursor: pointer;
}

.state-box {
  padding: 30px;
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.state-box.error {
  color: #f87171;
}

.file-list {
  display: flex;
  flex-direction: column;
}

.file-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid #131b2e;
  cursor: pointer;
  touch-action: manipulation;
}
.file-row:active {
  background: #17223b;
}

.file-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

.item-icon {
  font-size: 20px;
  flex-shrink: 0;
}
.item-icon.folder { color: #f59e0b; }
.item-icon.code-js { color: #facc15; }
.item-icon.code-json { color: #38bdf8; }
.item-icon.code-md { color: #a78bfa; }
.item-icon.code-html { color: #f97316; }
.item-icon.code-css { color: #38bdf8; }
.item-icon.code-py { color: #3b82f6; }

.item-details {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.item-name {
  font-family: monospace;
  font-size: 13.5px;
  font-weight: 500;
  color: #f1f5f9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-meta {
  font-size: 11px;
  color: #64748b;
  margin-top: 2px;
}

.file-actions {
  display: flex;
  align-items: center;
  gap: 6px;
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

.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>