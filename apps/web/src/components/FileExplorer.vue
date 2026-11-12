<template>
  <div
    class="file-explorer-container"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <!-- File Explorer Action Toolbar -->
    <div class="file-action-toolbar">
      <!-- Breadcrumb / Path Navigation -->
      <div class="toolbar-left">
        <button
          v-if="fileStore.currentRel"
          class="btn-tool-icon"
          @click="handleGoParent"
          :title="t('fileExplorer.folder') + ' (..)'"
        >
          <i class="ri-arrow-up-line"></i>
        </button>
        <div class="path-display" :title="fileStore.currentRel || '/'">
          <i class="ri-folder-line"></i>
          <span>{{ fileStore.currentRel ? '/' + fileStore.currentRel : '/' }}</span>
        </div>
      </div>

      <!-- Action buttons: Upload, Download Zip, Cleanup -->
      <div class="toolbar-right">
        <!-- Upload Dropdown -->
        <div class="toolbar-dropdown-wrapper">
          <button
            class="btn-tool-action upload"
            @click.stop="toggleUploadDropdown"
            :title="t('fileExplorer.upload')"
          >
            <i class="ri-upload-2-line"></i>
            <span>{{ t('fileExplorer.upload') }}</span>
            <i class="ri-arrow-down-s-line arrow"></i>
          </button>
          <div v-if="isUploadDropdownOpen" class="toolbar-dropdown-menu" @click.stop>
            <button class="menu-item" @click="triggerUploadFiles">
              <i class="ri-file-upload-line"></i>
              <span>{{ t('fileExplorer.uploadFiles') }}</span>
            </button>
            <button class="menu-item" @click="triggerUploadFolder">
              <i class="ri-folder-upload-line"></i>
              <span>{{ t('fileExplorer.uploadFolder') }}</span>
            </button>
          </div>
        </div>

        <!-- Download Zip of Current Folder -->
        <button
          type="button"
          class="btn-tool-action download"
          @click="handleDownloadCurrentFolder"
          :title="t('fileExplorer.downloadZip')"
          :aria-label="t('fileExplorer.downloadZip')"
        >
          <i class="ri-download-2-line" aria-hidden="true"></i>
        </button>

        <!-- Temp Archives Modal Trigger -->
        <button
          class="btn-tool-action cleanup"
          @click="openCleanupModal"
          :title="t('fileExplorer.cleanupTitle')"
        >
          <i class="ri-archive-line"></i>
          <span v-if="fileStore.tempArchives.length > 0" class="zip-cache-badge">
            {{ fileStore.tempArchives.length }}
          </span>
        </button>
      </div>
    </div>

    <!-- Upload Progress Banner -->
    <div v-if="fileStore.isUploading" class="upload-progress-banner">
      <i class="ri-loader-4-line spin"></i>
      <span>{{ fileStore.uploadProgressText || 'Đang tải lên...' }}</span>
    </div>

    <!-- Drag & Drop Overlay -->
    <div v-if="isDraggingOver" class="file-drop-overlay">
      <div class="drop-card">
        <i class="ri-upload-cloud-2-line drop-icon"></i>
        <div class="drop-title">{{ t('fileExplorer.dragDropTitle') }}</div>
        <div class="drop-subtitle">{{ t('fileExplorer.dragDropSubtitle', { path: fileStore.currentRel || '' }) }}</div>
      </div>
    </div>

    <!-- Loading / Error States -->
    <div v-if="fileStore.loading" class="state-box">
      <i class="ri-loader-4-line spin"></i> {{ t('fileExplorer.loading') }}
    </div>
    <div v-else-if="fileStore.error" class="state-box error">
      <i class="ri-error-warning-line"></i>
      <span>{{ fileStore.error }}</span>
      <div class="state-actions" style="margin-top: 10px; display: flex; gap: 8px;">
        <button type="button" class="btn-tool-action" @click="fileStore.fetchFiles('')">
          <i class="ri-home-4-line"></i> Về thư mục gốc
        </button>
        <button type="button" class="btn-tool-action" @click="fileStore.fetchFiles()">
          <i class="ri-refresh-line"></i> Thử lại
        </button>
      </div>
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
            :class="item.isDirectory ? 'ri-folder-2-line folder' : getFileIcon(item.ext)"
          ></i>
          <div class="item-details">
            <span class="item-name">{{ item.name }}</span>
            <span class="item-meta">
              {{ item.isDirectory ? t('fileExplorer.folder') : formatSize(item.size) }}
            </span>
          </div>
        </div>

        <div class="file-actions" @click.stop>
          <div class="file-actions-inline">
            <!-- Download Button -->
            <button
              v-if="item.isDirectory"
              class="btn-action-icon download"
              @click="handleDownloadFolder(item)"
              :title="t('fileExplorer.downloadFolderZip')"
            >
              <i class="ri-download-2-line"></i>
            </button>
            <button
              v-else
              class="btn-action-icon download"
              @click="handleDownloadFile(item)"
              :title="t('fileExplorer.downloadFile')"
            >
              <i class="ri-download-2-line"></i>
            </button>

            <button
              v-if="item.isDirectory"
              class="btn-action-icon project"
              :class="{ 'is-in-workspace': isExistingProject(item.relPath) }"
              @click="emit('open-folder-as-project', item.relPath)"
              :title="isExistingProject(item.relPath) ? 'Chuyển tới dự án' : 'Mở làm dự án'"
            >
              <i :class="isExistingProject(item.relPath) ? 'ri-folder-shared-line' : 'ri-folder-add-line'"></i>
            </button>
            <button class="btn-action-icon" @click="openRename(item)" :title="t('common.edit')">
              <i class="ri-edit-line"></i>
            </button>
            <button class="btn-action-icon danger" @click="openDelete(item)" :title="t('common.delete')">
              <i class="ri-delete-bin-line"></i>
            </button>
          </div>

          <div class="file-actions-mobile">
            <button
              type="button"
              class="btn-action-icon btn-file-more"
              :class="{ active: openActionMenuPath === item.relPath }"
              :data-file-more="item.relPath"
              :title="t('common.edit') || 'Tùy chọn'"
              :aria-expanded="openActionMenuPath === item.relPath ? 'true' : 'false'"
              @click.stop="toggleRowActionMenu(item.relPath)"
            >
              <i class="ri-more-2-fill"></i>
            </button>

            <div
              v-if="openActionMenuPath === item.relPath"
              class="file-row-dropdown-menu"
              :data-file-menu="item.relPath"
              @click.stop
            >
              <button
                v-if="item.isDirectory"
                type="button"
                class="menu-item download"
                @click="onMobileRowAction(() => handleDownloadFolder(item))"
              >
                <i class="ri-download-2-line"></i>
                <span>{{ t('fileExplorer.downloadFolderZip') || 'Tải thư mục (.zip)' }}</span>
              </button>
              <button
                v-else
                type="button"
                class="menu-item download"
                @click="onMobileRowAction(() => handleDownloadFile(item))"
              >
                <i class="ri-download-2-line"></i>
                <span>{{ t('fileExplorer.downloadFile') || 'Tải xuống' }}</span>
              </button>

              <button
                v-if="item.isDirectory"
                type="button"
                class="menu-item project"
                :class="{ 'is-in-workspace': isExistingProject(item.relPath) }"
                @click="onMobileRowAction(() => emit('open-folder-as-project', item.relPath))"
              >
                <i :class="isExistingProject(item.relPath) ? 'ri-folder-shared-line' : 'ri-folder-add-line'"></i>
                <span>{{ isExistingProject(item.relPath) ? 'Chuyển tới dự án' : 'Mở làm dự án' }}</span>
              </button>

              <button
                type="button"
                class="menu-item"
                @click="onMobileRowAction(() => openRename(item))"
              >
                <i class="ri-edit-line"></i>
                <span>{{ t('common.edit') || 'Đổi tên' }}</span>
              </button>

              <button
                type="button"
                class="menu-item danger"
                @click="onMobileRowAction(() => openDelete(item))"
              >
                <i class="ri-delete-bin-line"></i>
                <span>{{ t('common.delete') || 'Xóa' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Hidden file inputs for toolbar -->
    <input ref="uploadFilesInput" type="file" multiple style="display: none" @change="onFilesChosen" />
    <input ref="uploadFolderInput" type="file" webkitdirectory directory multiple style="display: none" @change="onFolderChosen" />

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

    <!-- Cleanup Modal (Downloads Cache) -->
    <div v-if="isCleanupModalOpen" class="modal-backdrop" @click="isCleanupModalOpen = false">
      <div class="modal-content cleanup-modal" @click.stop>
        <div class="modal-header">
          <h3><i class="ri-archive-line"></i> {{ t('fileExplorer.cleanupTitle') }}</h3>
          <button class="modal-close-btn" @click="isCleanupModalOpen = false">
            <i class="ri-close-line"></i>
          </button>
        </div>
        <div class="modal-body">
          <p class="cleanup-hint">{{ t('fileExplorer.cleanupHint') }}</p>
          <div v-if="fileStore.tempArchives.length === 0" class="empty-archives">
            <i class="ri-inbox-line"></i>
            <span>{{ t('fileExplorer.noArchives') }}</span>
          </div>
          <div v-else class="archives-list">
            <div v-for="arch in fileStore.tempArchives" :key="arch.id" class="archive-row">
              <div class="arch-left">
                <i class="ri-file-zip-line zip-icon"></i>
                <div class="arch-info">
                  <div class="arch-name">{{ arch.name }}</div>
                  <div class="arch-meta">
                    <span class="arch-size">{{ arch.sizeStr }}</span>
                    <span class="arch-time">{{ formatRemainingTime(arch.expiresAt) }}</span>
                  </div>
                </div>
              </div>
              <button class="btn-action-icon danger" @click="requestDeleteArchive(arch)" :title="t('common.delete')">
                <i class="ri-delete-bin-line"></i>
              </button>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button v-if="fileStore.tempArchives.length > 0" class="btn-danger" @click="requestPurgeAll">
            <i class="ri-delete-bin-7-line"></i> {{ t('fileExplorer.purgeAll') }}
          </button>
          <button class="btn-secondary" @click="isCleanupModalOpen = false">{{ t('common.close') || 'Đóng' }}</button>
        </div>
      </div>
    </div>

    <ConfirmModal
      :is-open="isArchiveConfirmOpen"
      :title="t('fileExplorer.deleteTitle')"
      icon="ri-delete-bin-line"
      :message="archiveConfirmMessage"
      :confirm-label="t('fileExplorer.deleteNow')"
      :is-danger="true"
      @close="isArchiveConfirmOpen = false"
      @confirm="executeArchiveConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useFileStore, FileEntry } from '../stores/fileStore.js';
import { useProjectStore } from '../stores/projectStore.js';
import { useServerStore } from '../stores/serverStore.js';
import InputModal from './InputModal.vue';
import ConfirmModal from './ConfirmModal.vue';
import { useI18n } from '../composables/useI18n.js';

const props = withDefaults(
  defineProps<{
    initialOpenActionMenuPath?: string | null;
  }>(),
  {
    initialOpenActionMenuPath: null,
  }
);

const emit = defineEmits<{
  (e: 'open-file', relPath: string): void;
  (e: 'open-folder-as-project', relPath: string): void;
}>();
const fileStore = useFileStore();
const projectStore = useProjectStore();
const serverStore = useServerStore();
const { t } = useI18n();

function isExistingProject(relPath: string): boolean {
  const root = (serverStore.currentServer?.workspace || '~').trim().replace(/\/+$/, '');
  const cleanRel = (relPath || '').trim().replace(/^\/+|\/+$/g, '');
  const fullPath = `${root}/${cleanRel}`.replace(/\/+$/, '');
  const srvId = serverStore.currentServerId;
  return projectStore.projectsForServer(srvId).some((p) => {
    const pRoot = p.rootPath.trim().replace(/\/+$/, '');
    return (
      pRoot === fullPath ||
      (fullPath.startsWith('~/') && pRoot === fullPath) ||
      (pRoot.startsWith('~/') && fullPath.endsWith(pRoot.slice(2))) ||
      (cleanRel && p.name === cleanRel && (pRoot.endsWith(`/${cleanRel}`) || pRoot === fullPath))
    );
  });
}

const targetItem = ref<FileEntry | null>(null);
const isRenameModalOpen = ref(false);
const isDeleteModalOpen = ref(false);
const isCleanupModalOpen = ref(false);
const isUploadDropdownOpen = ref(false);
const openActionMenuPath = ref<string | null>(props.initialOpenActionMenuPath);
const isDraggingOver = ref(false);

const renameModalRef = ref<any>(null);
const deleteModalRef = ref<any>(null);
const uploadFilesInput = ref<HTMLInputElement | null>(null);
const uploadFolderInput = ref<HTMLInputElement | null>(null);

let dragCounter = 0;

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

function toggleUploadDropdown() {
  isUploadDropdownOpen.value = !isUploadDropdownOpen.value;
}

function triggerUploadFiles() {
  isUploadDropdownOpen.value = false;
  uploadFilesInput.value?.click();
}

function triggerUploadFolder() {
  isUploadDropdownOpen.value = false;
  uploadFolderInput.value?.click();
}

async function onFilesChosen(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    await fileStore.uploadFiles(target.files);
    target.value = '';
  }
}

async function onFolderChosen(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    await fileStore.uploadFiles(target.files);
    target.value = '';
  }
}

function handleDownloadFile(item: FileEntry) {
  fileStore.downloadItem(item.relPath, item.name);
}

function handleDownloadFolder(item: FileEntry) {
  fileStore.downloadItem(item.relPath);
}

function handleDownloadCurrentFolder() {
  fileStore.downloadItem(fileStore.currentRel);
}

async function openCleanupModal() {
  await fileStore.fetchTempArchives();
  isCleanupModalOpen.value = true;
}

const isArchiveConfirmOpen = ref(false);
const archiveConfirmMessage = ref('');
let pendingArchiveConfirmAction: (() => Promise<void>) | null = null;

function requestPurgeAll() {
  archiveConfirmMessage.value = 'Bạn có chắc chắn muốn xóa toàn bộ các bản nén .zip tạm thời không?';
  pendingArchiveConfirmAction = async () => {
    await handlePurgeAll();
  };
  isArchiveConfirmOpen.value = true;
}

function requestDeleteArchive(arch: { id: string; name: string }) {
  archiveConfirmMessage.value = `Bạn có chắc chắn muốn xóa tệp nén tạm "${arch.name}" không?`;
  pendingArchiveConfirmAction = async () => {
    await handleDeleteArchive(arch.id);
  };
  isArchiveConfirmOpen.value = true;
}

async function executeArchiveConfirm() {
  const action = pendingArchiveConfirmAction;
  pendingArchiveConfirmAction = null;
  isArchiveConfirmOpen.value = false;
  if (action) await action();
}

async function handlePurgeAll() {
  await fileStore.purgeTempArchives();
}

async function handleDeleteArchive(id: string) {
  await fileStore.deleteTempArchive(id);
}

function formatRemainingTime(expiresAt: number): string {
  const diffMs = expiresAt - Date.now();
  if (diffMs <= 0) return t('fileExplorer.expired');
  const minutes = Math.ceil(diffMs / 60000);
  return t('fileExplorer.expiresIn', { time: `${minutes}m` });
}

// Drag & Drop handlers
function onDragEnter() {
  dragCounter++;
  isDraggingOver.value = true;
}

function onDragOver(e: DragEvent) {
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'copy';
  }
  isDraggingOver.value = true;
}

function onDragLeave() {
  dragCounter--;
  if (dragCounter <= 0) {
    dragCounter = 0;
    isDraggingOver.value = false;
  }
}

async function onDrop(e: DragEvent) {
  dragCounter = 0;
  isDraggingOver.value = false;

  if (!e.dataTransfer) return;

  // Try recursive webkitGetAsEntry traversal if available
  const items = e.dataTransfer.items;
  if (items && items.length > 0) {
    try {
      const extractedFiles = await scanDataTransferItems(items);
      if (extractedFiles.length > 0) {
        await fileStore.uploadFiles(extractedFiles);
        return;
      }
    } catch (_) {}
  }

  // Fallback to standard files list
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    await fileStore.uploadFiles(e.dataTransfer.files);
  }
}

async function scanDataTransferItems(items: DataTransferItemList): Promise<File[]> {
  const files: File[] = [];
  const entries: any[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (typeof (item as any).webkitGetAsEntry === 'function') {
      const entry = (item as any).webkitGetAsEntry();
      if (entry) entries.push(entry);
    } else {
      const f = item.getAsFile();
      if (f) files.push(f);
    }
  }

  async function traverse(entry: any, currentPath = ''): Promise<void> {
    if (entry.isFile) {
      await new Promise<void>((resolve) => {
        entry.file(
          (file: File) => {
            const rel = currentPath ? `${currentPath}/${file.name}` : file.name;
            try {
              Object.defineProperty(file, 'webkitRelativePath', {
                value: rel,
                writable: false,
              });
            } catch (_) {}
            files.push(file);
            resolve();
          },
          () => resolve()
        );
      });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const readBatch = (): Promise<any[]> =>
        new Promise((resolve) => {
          reader.readEntries(
            (batch: any[]) => resolve(batch),
            () => resolve([])
          );
        });

      let batch = await readBatch();
      while (batch.length > 0) {
        for (const child of batch) {
          const nextPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
          await traverse(child, nextPath);
        }
        batch = await readBatch();
      }
    }
  }

  for (const ent of entries) {
    await traverse(ent, '');
  }

  return files;
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
    case '.zip':
    case '.tar':
    case '.gz':
      return 'ri-folder-zip-line code-json';
    default:
      return 'ri-file-text-line';
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function toggleRowActionMenu(relPath: string) {
  openActionMenuPath.value = openActionMenuPath.value === relPath ? null : relPath;
}

function onMobileRowAction(action: () => void) {
  openActionMenuPath.value = null;
  action();
}

function handleGlobalClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (!target.closest('.toolbar-dropdown-wrapper')) {
    isUploadDropdownOpen.value = false;
  }
  if (!target.closest('.file-actions-mobile')) {
    openActionMenuPath.value = null;
  }
}

onMounted(() => {
  window.addEventListener('click', handleGlobalClick);
  fileStore.fetchTempArchives();
});

onBeforeUnmount(() => {
  window.removeEventListener('click', handleGlobalClick);
});

defineExpose({
  openUploadMenu: () => { isUploadDropdownOpen.value = true; },
  openCleanupModal,
  handleDownloadCurrentFolder,
});
</script>

<style scoped>
.file-explorer-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  background: #161616;
  position: relative;
  width: 100%;
  height: 100%;
}

/* Action Toolbar */
.file-action-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  background: #161616;
  border-bottom: 1px solid #323232;
  gap: 10px;
  position: sticky;
  top: 0;
  z-index: 20;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.btn-tool-icon {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #282828;
  border: 1px solid #3f3f3f;
  border-radius: 6px;
  color: #a5a5a5;
  cursor: pointer;
  flex-shrink: 0;
  font-size: 15px;
}

.btn-tool-icon:hover {
  background: #333333;
  color: #c4c4c4;
}

.path-display {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: monospace;
  font-size: 13px;
  color: #a1a1a1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.path-display i {
  color: #a6a6a6;
  font-size: 15px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.toolbar-dropdown-wrapper {
  position: relative;
  display: inline-flex;
}

.btn-tool-action {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid #3f3f3f;
  background: #282828;
  color: #e7e7e7;
  transition: all 0.15s ease;
}

.btn-tool-action:hover {
  background: #333333;
}

.btn-tool-action.upload {
  color: #a5a5a5;
  border-color: rgba(125, 125, 125, 0.4);
  background: rgba(64, 64, 64, 0.08);
}

.btn-tool-action.upload:hover {
  background: rgba(64, 64, 64, 0.18);
  border-color: #7d7d7d;
}

.btn-tool-action.download {
  width: 30px;
  height: 30px;
  padding: 0;
  justify-content: center;
  flex-shrink: 0;
  color: #adadad;
  border-color: rgba(125, 125, 125, 0.4);
  background: rgba(64, 64, 64, 0.08);
}

.btn-tool-action.download:hover {
  background: rgba(64, 64, 64, 0.18);
  border-color: #7d7d7d;
}

.btn-tool-action.cleanup {
  position: relative;
  padding: 5px 8px;
  color: #999999;
  border-color: rgba(125, 125, 125, 0.4);
  background: rgba(64, 64, 64, 0.08);
}

.btn-tool-action.cleanup:hover {
  background: rgba(64, 64, 64, 0.18);
  border-color: #7d7d7d;
}

.zip-cache-badge {
  background: #404040;
  color: white;
  border-radius: 8px;
  padding: 1px 5px;
  font-size: 9px;
  font-weight: bold;
}

.toolbar-dropdown-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: #181818;
  border: 1px solid #323232;
  border-radius: 8px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
  min-width: 170px;
  padding: 5px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.toolbar-dropdown-menu .menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #e7e7e7;
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  width: 100%;
  white-space: nowrap;
}

.toolbar-dropdown-menu .menu-item:hover {
  background: #282828;
  color: #a5a5a5;
}

/* Upload Progress Banner */
.upload-progress-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: #0369a1;
  color: #e0f2fe;
  font-size: 12.5px;
  font-weight: 600;
}

/* Drag & Drop Overlay */
.file-drop-overlay {
  position: absolute;
  inset: 0;
  background: rgba(22, 22, 22, 0.85);
  border: 2px dashed #7d7d7d;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  pointer-events: none;
}

.drop-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  background: #181818;
  padding: 24px 32px;
  border-radius: 12px;
  border: 1px solid #323232;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}

.drop-icon {
  font-size: 40px;
  color: #38bdf8;
  animation: bounce 1s infinite alternate;
}

@keyframes bounce {
  from { transform: translateY(0); }
  to { transform: translateY(-8px); }
}

.drop-title {
  font-size: 16px;
  font-weight: 700;
  color: #eeeeee;
}

.drop-subtitle {
  font-size: 12px;
  color: #a1a1a1;
  font-family: monospace;
}

/* States */
.state-box {
  padding: 40px;
  text-align: center;
  color: #a1a1a1;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.state-box.error {
  color: #f87171;
}

/* File List */
.file-list {
  display: flex;
  flex-direction: column;
}

.file-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid #323232;
  cursor: pointer;
  touch-action: manipulation;
  transition: background 0.1s ease;
}

.file-row:hover {
  background: #171717;
}

.file-row:active {
  background: #212121;
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
  color: #eeeeee;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-meta {
  font-size: 11px;
  color: #989898;
  margin-top: 2px;
}

.file-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 8px;
  position: relative;
}

.file-actions-inline {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.file-actions-mobile {
  display: none;
  position: relative;
}

.btn-file-more.active {
  background: #333333;
  border-color: #7d7d7d;
  color: #a5a5a5;
}

.file-row-dropdown-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: #181818;
  border: 1px solid #3f3f3f;
  border-radius: 8px;
  box-shadow: 0 12px 28px -4px rgba(0, 0, 0, 0.65);
  min-width: 176px;
  padding: 5px;
  z-index: 120;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.file-row-dropdown-menu .menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 11px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #e7e7e7;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  width: 100%;
  white-space: nowrap;
}

.file-row-dropdown-menu .menu-item:hover {
  background: #282828;
}

.file-row-dropdown-menu .menu-item.download i,
.file-row-dropdown-menu .menu-item.project i {
  color: #a5a5a5;
}

.file-row-dropdown-menu .menu-item.danger {
  color: #f87171;
}

.file-row-dropdown-menu .menu-item.danger i {
  color: #ef4444;
}

.btn-action-icon {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #282828;
  border: 1px solid #3f3f3f;
  border-radius: 6px;
  color: #d4d4d4;
  font-size: 15px;
  cursor: pointer;
  touch-action: manipulation;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.btn-action-icon:hover {
  background: #333333;
  color: #eeeeee;
}

.btn-action-icon:active {
  background: #3f3f3f;
  transform: scale(0.96);
}

.btn-action-icon.download {
  color: #a5a5a5;
  border-color: rgba(125, 125, 125, 0.35);
  background: rgba(64, 64, 64, 0.08);
}

.btn-action-icon.download:hover {
  background: rgba(64, 64, 64, 0.2);
  border-color: #7d7d7d;
}

.btn-action-icon.danger {
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.35);
  background: rgba(239, 68, 68, 0.08);
}

.btn-action-icon.project {
  color: #a5a5a5;
  border-color: rgba(125, 125, 125, 0.35);
  background: rgba(64, 64, 64, 0.08);
}

.btn-action-icon.project.is-in-workspace {
  color: #e5e5e5;
  border-color: rgba(229, 229, 229, 0.4);
  background: rgba(255, 255, 255, 0.08);
}

.btn-action-icon.danger:hover {
  background: rgba(239, 68, 68, 0.18);
  border-color: rgba(239, 68, 68, 0.5);
  color: #f87171;
}

/* Modals */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
  padding: 16px;
}

.modal-content.cleanup-modal {
  background: #181818;
  border: 1px solid #323232;
  border-radius: 12px;
  width: 100%;
  max-width: 520px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid #323232;
}

.modal-header h3 {
  margin: 0;
  font-size: 15px;
  color: #eeeeee;
  display: flex;
  align-items: center;
  gap: 8px;
}

.modal-header h3 i {
  color: #999999;
}

.modal-close-btn {
  background: transparent;
  border: none;
  color: #a1a1a1;
  font-size: 18px;
  cursor: pointer;
}

.modal-close-btn:hover {
  color: #eeeeee;
}

.modal-body {
  padding: 16px 18px;
  max-height: 380px;
  overflow-y: auto;
}

.cleanup-hint {
  font-size: 12.5px;
  color: #a1a1a1;
  line-height: 1.5;
  margin-top: 0;
  margin-bottom: 16px;
  background: #171717;
  padding: 10px 12px;
  border-radius: 6px;
  border: 1px solid #323232;
}

.cleanup-hint code {
  color: #a5a5a5;
}

.empty-archives {
  text-align: center;
  padding: 30px;
  color: #989898;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.empty-archives i {
  font-size: 28px;
}

.archives-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.archive-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #282828;
  border: 1px solid #3f3f3f;
  border-radius: 8px;
}

.arch-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}

.zip-icon {
  font-size: 22px;
  color: #38bdf8;
  flex-shrink: 0;
}

.arch-info {
  min-width: 0;
}

.arch-name {
  font-family: monospace;
  font-size: 12.5px;
  font-weight: 600;
  color: #eeeeee;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.arch-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 11px;
  color: #a1a1a1;
  margin-top: 2px;
}

.arch-size {
  color: #adadad;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 18px;
  border-top: 1px solid #323232;
  background: #171717;
}

.btn-secondary {
  padding: 7px 14px;
  background: #282828;
  border: 1px solid #3f3f3f;
  border-radius: 6px;
  color: #d4d4d4;
  font-size: 13px;
  cursor: pointer;
}

.btn-secondary:hover {
  background: #333333;
  color: #eeeeee;
}

.btn-danger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  background: #404040;
  border: 1px solid #4d4d4d;
  border-radius: 6px;
  color: white;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.btn-danger:hover {
  background: #404040;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (max-width: 640px) {
  .file-actions-inline { display: none; }
  .file-actions-mobile { display: inline-flex; }
}

@media (max-width: 600px) {
  .btn-tool-action span {
    display: none;
  }
  .btn-tool-action {
    padding: 6px 8px;
  }
}
</style>
