<template>
  <div
    id="quick-tree-backdrop"
    class="quick-tree-backdrop"
    :class="{ open: isOpen }"
    @click="requestClosePanel"
  ></div>

  <aside
    id="quick-tree-panel"
    class="quick-tree-panel"
    :class="{ open: isOpen, resizing: isResizing, fullscreen: isFullscreen }"
    :data-panel-mode="mode"
    :aria-label="mode === 'git' ? t('quickPanel.gitTitle') : t('quickPanel.filesTitle')"
    :style="{ width: `${panelWidth}px` }"
  >
    <div
      id="quick-tree-resize"
      class="quick-tree-resize"
      role="separator"
      aria-orientation="vertical"
      :aria-label="t('quickPanel.resizeLabel')"
      :aria-valuemin="minWidth"
      :aria-valuemax="effectiveMaxWidth"
      :aria-valuenow="panelWidth"
      tabindex="0"
      :title="t('quickPanel.resizeTitle')"
      @pointerdown="onResizePointerDown"
      @keydown="onResizeKeyDown"
    ></div>

    <div class="quick-tree-header">
      <div class="quick-tree-title">
        <i :class="mode === 'git' ? 'ri-git-branch-line' : 'ri-folder-2-line'" id="quick-panel-icon"></i>
        <span id="quick-panel-title">
          {{ mode === 'git' ? t('quickPanel.gitTitle') : t('quickPanel.filesTitle') }}
        </span>
        <div class="quick-panel-tabs" role="tablist" :aria-label="t('quickPanel.modeTabsLabel')">
          <button
            type="button"
            class="quick-panel-tab"
            :class="{ active: mode === 'files' }"
            data-panel-tab="files"
            :title="t('quickPanel.filesTitle')"
            :aria-label="t('quickPanel.filesTitle')"
            @click="$emit('update:mode', 'files')"
          >
            <i class="ri-folder-2-line"></i>
          </button>
          <button
            type="button"
            class="quick-panel-tab"
            :class="{ active: mode === 'git' }"
            data-panel-tab="git"
            :title="t('quickPanel.gitTitle')"
            :aria-label="t('quickPanel.gitTitle')"
            @click="$emit('update:mode', 'git')"
          >
            <i class="ri-git-branch-line"></i>
          </button>
        </div>
      </div>

      <div class="quick-tree-actions">
        <button
          id="quick-tree-fullscreen"
          type="button"
          class="quick-tree-btn"
          :class="{ active: isFullscreen }"
          :aria-pressed="isFullscreen ? 'true' : 'false'"
          :title="isFullscreen ? 'Thu nhỏ về sidebar' : 'Mở toàn màn hình'"
          :aria-label="isFullscreen ? 'Thu nhỏ về sidebar' : 'Mở toàn màn hình'"
          @click="toggleFullscreen"
        >
          <i :class="isFullscreen ? 'ri-fullscreen-exit-line' : 'ri-fullscreen-line'"></i>
        </button>
        <button
          id="quick-panel-refresh"
          type="button"
          class="quick-tree-btn"
          :title="t('quickPanel.refresh')"
          :aria-label="t('quickPanel.refresh')"
          @click="handleRefresh"
        >
          <i class="ri-refresh-line" :class="{ 'spin-anim': loadingTree || gitStore.loading }"></i>
        </button>
        <button
          id="quick-tree-close"
          type="button"
          class="quick-tree-btn"
          :title="t('quickPanel.close')"
          :aria-label="t('quickPanel.close')"
          @click="requestClosePanel"
        >
          <i class="ri-close-line"></i>
        </button>
      </div>
    </div>

    <div class="quick-tree-subbar">
      <span id="quick-panel-path" class="quick-panel-path" :title="subbarPathText">
        {{ subbarPathText }}
      </span>
      <span
        v-if="mode === 'git'"
        id="quick-panel-badge"
        class="quick-git-badge"
      >
        {{ gitStore.branch || 'main' }} • {{ gitStore.files.length }}
      </span>
    </div>

    <!-- FILES PANE: Folder Tree + Inline File View/Edit Workbench -->
    <div v-if="mode === 'files'" id="quick-pane-files" class="quick-pane">
      <div v-show="!activeInlineFile" id="quick-tree-file-toolbar" class="quick-tree-file-toolbar">
        <button
          id="quick-tree-upload-files"
          type="button"
          class="quick-tree-action-btn"
          title="Tải tệp lên thư mục hiện tại"
          aria-label="Tải tệp lên thư mục hiện tại"
          @click="triggerQuickUploadFiles('')"
        >
          <i class="ri-file-upload-line"></i>
          <span>Tải tệp</span>
        </button>
        <button
          id="quick-tree-upload-folder"
          type="button"
          class="quick-tree-action-btn"
          title="Tải cả thư mục lên"
          aria-label="Tải cả thư mục lên"
          @click="triggerQuickUploadFolder('')"
        >
          <i class="ri-folder-upload-line"></i>
          <span>Tải thư mục</span>
        </button>
        <button
          id="quick-tree-download-zip"
          type="button"
          class="quick-tree-action-btn"
          title="Tải về ZIP thư mục hiện tại"
          aria-label="Tải về ZIP thư mục hiện tại"
          @click="downloadQuickPath('', projectStore.currentProject?.name || 'workspace')"
        >
          <i class="ri-download-2-line"></i>
          <span>Tải về ZIP</span>
        </button>
        <input
          ref="quickUploadFilesInputRef"
          id="quick-input-upload-files"
          type="file"
          multiple
          style="display: none"
          @change="onQuickUploadFilesSelected"
        />
        <input
          ref="quickUploadFolderInputRef"
          id="quick-input-upload-folder"
          type="file"
          webkitdirectory
          directory
          multiple
          style="display: none"
          @change="onQuickUploadFolderSelected"
        />
      </div>

      <div v-if="quickTreeNotice" id="quick-tree-notice" class="quick-tree-notice">
        {{ quickTreeNotice }}
      </div>

      <div
        v-show="!activeInlineFile"
        id="quick-tree-list"
        class="quick-tree-list"
      >
        <div v-if="loadingTree && visibleTreeNodes.length === 0" class="quick-empty-state">
          <i class="ri-loader-4-line spin-anim"></i>
          <span>{{ t('common.loading') }}</span>
        </div>

        <div v-else-if="visibleTreeNodes.length === 0" class="quick-empty-state">
          <i class="ri-folder-open-line"></i>
          <span>{{ t('files.emptyFolder') }}</span>
        </div>

        <button
          v-for="item in visibleTreeNodes"
          :key="item.entry.relPath"
          type="button"
          class="quick-tree-node"
          :class="{
            'is-dir': item.entry.isDirectory,
            active: activeInlineFile?.path === item.entry.relPath,
          }"
          :data-node-path="item.entry.relPath"
          :data-node-type="item.entry.isDirectory ? 'dir' : 'file'"
          :style="{ paddingLeft: `${10 + item.depth * 14}px` }"
          @click="onTreeNodeClick(item.entry)"
        >
          <i
            v-if="item.entry.isDirectory"
            class="tree-caret"
            :class="expandedPaths[item.entry.relPath] ? 'ri-arrow-down-s-line' : 'ri-arrow-right-s-line'"
          ></i>
          <span v-else class="tree-caret-spacer"></span>

          <i :class="getEntryIcon(item.entry)"></i>
          <span class="node-label">{{ item.entry.name }}</span>
          <span v-if="!item.entry.isDirectory && item.entry.size > 0" class="node-meta">
            {{ formatFileSize(item.entry.size) }}
          </span>
          <span class="quick-tree-row-actions" @click.stop>
            <span
              v-if="item.entry.isDirectory"
              role="button"
              tabindex="0"
              class="quick-tree-row-btn quick-tree-row-upload"
              :title="`Tải tệp lên ${item.entry.name}`"
              :aria-label="`Tải tệp lên ${item.entry.name}`"
              @click.stop="triggerQuickUploadFiles(item.entry.relPath)"
            >
              <i class="ri-upload-2-line"></i>
            </span>
            <span
              role="button"
              tabindex="0"
              class="quick-tree-row-btn quick-tree-row-download"
              :title="item.entry.isDirectory ? `Tải về ZIP ${item.entry.name}` : `Tải xuống ${item.entry.name}`"
              :aria-label="item.entry.isDirectory ? `Tải về ZIP ${item.entry.name}` : `Tải xuống ${item.entry.name}`"
              @click.stop="downloadQuickPath(item.entry.relPath, item.entry.name)"
            >
              <i class="ri-download-2-line"></i>
            </span>
          </span>
        </button>
      </div>

      <!-- Inline File View & Edit Workbench (stays inside QuickWorkspacePanel) -->
      <div
        id="quick-file-workbench"
        class="quick-file-workbench"
        :class="{ open: Boolean(activeInlineFile) }"
      >
        <template v-if="activeInlineFile">
          <div class="quick-file-bar">
            <button
              id="quick-file-back"
              type="button"
              class="quick-file-back"
              :title="t('quickPanel.backToTreeTitle')"
              @click="closeInlineFile"
            >
              <i class="ri-arrow-left-s-line"></i>
              <span>{{ t('quickPanel.backToTree') }}</span>
            </button>

            <div class="quick-file-meta">
              <i id="quick-file-icon" :class="getFileIconByName(activeInlineFile.name)"></i>
              <span id="quick-file-name" class="quick-file-name" :title="activeInlineFile.path">
                {{ activeInlineFile.name }}
              </span>
              <span
                id="quick-file-dirty"
                class="quick-file-dirty"
                :class="{ show: activeInlineFile.dirty }"
              >
                {{ t('quickPanel.unsaved') }}
              </span>
            </div>

            <button
              id="quick-md-switch"
              type="button"
              class="quick-preview-btn"
              :class="{ active: mdMode === 'preview' }"
              :data-md-mode="mdMode"
              :title="mdMode === 'preview' ? t('quickPanel.mdEdit') : t('quickPanel.mdPreview')"
              :aria-label="mdMode === 'preview' ? t('quickPanel.mdEdit') : t('quickPanel.mdPreview')"
              @click="toggleInlineEditMode"
            >
              <i :class="mdMode === 'preview' ? 'ri-edit-line' : 'ri-eye-line'"></i>
            </button>

            <button
              id="quick-file-download"
              type="button"
              class="quick-preview-btn"
              title="Tải tệp hiện tại về máy"
              aria-label="Tải tệp hiện tại về máy"
              @click="downloadQuickPath(activeInlineFile.path, activeInlineFile.name)"
            >
              <i class="ri-download-2-line"></i>
            </button>

            <button
              id="quick-file-fullscreen"
              type="button"
              class="quick-preview-btn"
              :class="{ active: isFullscreen }"
              :aria-pressed="isFullscreen ? 'true' : 'false'"
              :title="isFullscreen ? 'Thu nhỏ về sidebar' : 'Mở toàn màn hình'"
              :aria-label="isFullscreen ? 'Thu nhỏ về sidebar' : 'Mở toàn màn hình'"
              @click="toggleFullscreen"
            >
              <i :class="isFullscreen ? 'ri-fullscreen-exit-line' : 'ri-fullscreen-line'"></i>
            </button>

            <button
              id="quick-file-save"
              type="button"
              class="quick-file-save"
              :class="{ saved: saveFlash }"
              :disabled="savingInlineFile"
              :title="t('quickPanel.saveTitle')"
              @click="saveInlineFile"
            >
              <i :class="saveFlash ? 'ri-check-line' : 'ri-save-3-line'"></i>
              <span id="quick-file-save-label">
                {{ saveFlash ? t('quickPanel.saved') : t('quickPanel.save') }}
              </span>
            </button>
          </div>

          <div class="quick-file-body">
            <div
              v-if="isMarkdownFile(activeInlineFile.name) && mdMode === 'preview'"
              id="quick-md-preview"
              class="quick-md-preview show"
              v-html="renderedMarkdownHtml"
            ></div>

            <iframe
              v-else-if="isHtmlFile(activeInlineFile.name) && mdMode === 'preview'"
              id="quick-html-preview"
              class="quick-html-preview show"
              sandbox="allow-scripts"
              :srcdoc="activeInlineFile.content"
              :title="activeInlineFile.name"
            ></iframe>

            <div v-else-if="mdMode === 'preview'" id="quick-code-preview" class="quick-code-preview" role="region" aria-label="Xem trước mã nguồn">
              <div v-for="(line, index) in activeInlineFile.content.split('\n')" :key="index" class="quick-code-preview-line">
                <span class="quick-code-preview-number" aria-hidden="true">{{ index + 1 }}</span>
                <span class="quick-code-preview-text">{{ line || ' ' }}</span>
              </div>
            </div>

            <div v-show="mdMode === 'edit'" id="quick-code-wrap" class="quick-code-wrap">
              <div ref="gutterRef" id="quick-code-gutter" class="quick-code-gutter">{{ lineNumbersText }}</div>
              <textarea
                ref="codeInputRef"
                id="quick-code-input"
                v-model="activeInlineFile.content"
                class="quick-code-input"
                spellcheck="false"
                autocapitalize="off"
                autocomplete="off"
                @input="onInlineCodeInput"
                @scroll="syncGutterScroll"
                @keydown="onInlineEditorKeydown"
              ></textarea>
            </div>
          </div>

          <div class="quick-file-foot">
            <span id="quick-file-status">
              {{ inlineStatusText || `UTF-8 • ${lineCount} ${t('quickPanel.linesUnit')}` }}
            </span>
            <span id="quick-file-lang">{{ detectLanguageLabel(activeInlineFile.name) }}</span>
          </div>
        </template>
      </div>
    </div>

    <!-- GIT PANE: Quick Git Management -->
    <div v-else id="quick-pane-git" class="quick-pane">
      <div class="quick-git-repo-section" id="quick-git-repo-section">
        <div class="quick-git-repo-head">
          <div class="quick-git-repo-title">
            <i class="ri-git-repository-line"></i>
            <span>Repositories</span>
            <span id="quick-git-repo-count-badge" class="quick-git-repo-badge">
              {{ gitStore.dirtyRepoCount }}/{{ gitStore.repos.length }}
            </span>
          </div>
          <div class="quick-git-repo-filters">
            <button
              type="button"
              class="quick-git-filter-btn"
              :class="{ active: gitStore.repoFilter === 'all' }"
              data-git-repo-filter="all"
              @click="gitStore.repoFilter = 'all'"
            >
              Tất cả
            </button>
            <button
              type="button"
              class="quick-git-filter-btn"
              :class="{ active: gitStore.repoFilter === 'dirty' }"
              data-git-repo-filter="dirty"
              @click="gitStore.repoFilter = 'dirty'"
            >
              Có thay đổi
            </button>
            <span class="quick-git-depth-tag" title="Quét tối đa 5 cấp thư mục">Tối đa {{ gitStore.maxDepth }} cấp</span>
          </div>
        </div>
        <div id="quick-git-repo-list" class="quick-git-repo-list" role="listbox" aria-label="Danh sách Git repository trong dự án">
          <div v-if="gitStore.filteredRepos.length === 0" class="quick-git-repo-empty">
            Không có repository nào khớp bộ lọc
          </div>
          <button
            v-for="repo in gitStore.filteredRepos"
            :key="repo.relPath"
            type="button"
            class="quick-git-repo-item"
            :class="{ active: repo.relPath === gitStore.selectedRepoPath }"
            :data-git-repo-path="repo.relPath"
            :style="{ paddingLeft: `${8 + Math.min(repo.depth, 5) * 8}px` }"
            @click="gitStore.selectRepo(repo.relPath)"
          >
            <div class="quick-git-repo-row-top">
              <div class="quick-git-repo-name">
                <i :class="repo.depth === 0 ? 'ri-git-repository-fill' : 'ri-git-repository-line'"></i>
                <span :title="repo.relPath === '.' ? `${repo.name} (gốc)` : repo.relPath">
                  {{ repo.relPath === '.' ? repo.name : repo.relPath }}
                </span>
                <span class="quick-git-repo-depth">Cấp {{ repo.depth }}</span>
              </div>
              <span
                class="quick-git-repo-change-pill"
                :class="repo.changedCount > 0 ? 'dirty status-indicator' : 'clean'"
              >
                {{ repo.changedCount > 0 ? `${repo.changedCount} thay đổi` : 'Sạch' }}
              </span>
            </div>
            <div class="quick-git-repo-row-sub">
              <span class="quick-git-repo-branch">
                <i class="ri-git-branch-line"></i> {{ repo.branch }}
              </span>
              <span v-if="repo.ahead > 0 || repo.behind > 0" class="quick-git-repo-sync">
                ↑{{ repo.ahead }} ↓{{ repo.behind }}
              </span>
            </div>
          </button>
        </div>
      </div>

      <div class="quick-git-summary">
        <div class="quick-git-branch">
          <i class="ri-git-branch-line"></i>
          <span>{{ gitStore.branch || 'main' }}</span>
        </div>
        <span class="quick-git-count">
          {{ gitStore.files.length }} {{ t('quickPanel.changedFiles') }}
        </span>
      </div>

      <div id="quick-git-files" class="quick-git-files">
        <div v-if="gitStore.files.length === 0" class="quick-empty-state">
          <i class="ri-checkbox-circle-line"></i>
          <span>{{ t('quickPanel.cleanWorkingTree') }}</span>
        </div>

        <div
          v-for="file in gitStore.files"
          :key="file.path"
          class="quick-git-item"
          :class="{ selected: selectedGitFile === file.path, staged: file.staged }"
          :data-git-file="file.path"
          @click="selectedGitFile = file.path"
        >
          <button
            type="button"
            class="quick-git-check"
            :class="{ checked: file.staged }"
            :title="file.staged ? t('quickPanel.unstage') : t('quickPanel.stage')"
            @click.stop="toggleFileStage(file)"
          >
            <i :class="file.staged ? 'ri-checkbox-fill' : 'ri-checkbox-blank-line'"></i>
          </button>
          <span class="quick-git-file" :title="file.path">{{ file.path }}</span>
          <span
            class="quick-git-status"
            :class="getGitStatusClass(file.status)"
          >
            {{ file.staged ? 'S' : file.status }}
          </span>
        </div>
      </div>

      <div class="quick-git-commit">
        <textarea
          id="quick-git-msg"
          v-model="commitMessage"
          class="quick-git-input"
          :placeholder="t('quickPanel.commitPlaceholder')"
        ></textarea>

        <div class="quick-git-actions">
          <button
            id="quick-git-stage"
            type="button"
            class="quick-git-btn"
            :disabled="gitStore.loading || gitStore.files.length === 0"
            @click="handleStage"
          >
            <i class="ri-add-line"></i> {{ t('quickPanel.stage') }}
          </button>
          <button
            id="quick-git-unstage"
            type="button"
            class="quick-git-btn"
            :disabled="gitStore.loading || gitStore.files.length === 0"
            @click="handleUnstage"
          >
            <i class="ri-subtract-line"></i> {{ t('quickPanel.unstage') }}
          </button>
          <button
            id="quick-git-commit"
            type="button"
            class="quick-git-btn primary"
            :disabled="gitStore.loading || !commitMessage.trim()"
            @click="handleCommit"
          >
            <i class="ri-check-line"></i> {{ t('quickPanel.commit') }}
          </button>
        </div>

        <div class="quick-git-sync">
          <button
            id="quick-git-pull"
            type="button"
            class="quick-git-btn"
            :disabled="gitStore.loading"
            @click="handlePull"
          >
            <i class="ri-download-cloud-2-line"></i> {{ t('quickPanel.pull') }}
          </button>
          <button
            id="quick-git-push"
            type="button"
            class="quick-git-btn"
            :disabled="gitStore.loading"
            @click="handlePush"
          >
            <i class="ri-upload-cloud-2-line"></i> {{ t('quickPanel.push') }}
          </button>
        </div>

        <div
          id="quick-git-toast"
          class="quick-git-toast"
          :class="{ show: Boolean(gitToast) }"
        >
          {{ gitToast }}
        </div>
      </div>
    </div>

    <ConfirmModal
      :is-open="isDiscardConfirmOpen"
      :title="t('common.confirm') || 'Xác Nhận'"
      icon="ri-alert-line"
      :message="t('quickPanel.discardWarning')"
      :confirm-label="t('common.close') || 'Bỏ Thay Đổi'"
      :is-danger="true"
      @close="cancelDiscardInlineFile"
      @confirm="confirmDiscardInlineFile"
    />
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { marked, Renderer } from 'marked';
import { apiUrl } from '../utils/api.js';
import { useServerStore } from '../stores/serverStore.js';
import { useProjectStore } from '../stores/projectStore.js';
import { useFileStore, type FileEntry } from '../stores/fileStore.js';
import { useGitStore, type GitChangedFile } from '../stores/gitStore.js';
import { useI18n } from '../composables/useI18n.js';
import ConfirmModal from './ConfirmModal.vue';

export interface InlineFileState {
  path: string;
  name: string;
  content: string;
  originalContent: string;
  dirty: boolean;
}

const props = withDefaults(
  defineProps<{
    isOpen: boolean;
    mode: 'files' | 'git';
    panelWidth?: number;
    minWidth?: number;
    maxWidth?: number;
    initialEntries?: FileEntry[];
    initialInlineFile?: InlineFileState | null;
    initialPreviewMode?: 'preview' | 'edit';
  }>(),
  {
    panelWidth: 320,
    minWidth: 220,
    maxWidth: 640,
    initialEntries: () => [],
    initialInlineFile: null,
  }
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'update:mode', mode: 'files' | 'git'): void;
  (e: 'update:panelWidth', width: number): void;
}>();

const serverStore = useServerStore();
const projectStore = useProjectStore();
const fileStore = useFileStore();
const gitStore = useGitStore();
const { t } = useI18n();

const rootEntries = ref<FileEntry[]>(props.initialEntries ? [...props.initialEntries] : []);
const childrenByPath = ref<Record<string, FileEntry[]>>({});
const expandedPaths = ref<Record<string, boolean>>({});
const loadingTree = ref(false);

const activeInlineFile = ref<InlineFileState | null>(
  props.initialInlineFile ? { ...props.initialInlineFile } : null
);
const inlineScope = ref<{ serverId: string; projectId: string } | null>(null);
let openGeneration = 0;
let treeGeneration = 0;
const scopeKey = computed(() => `${serverStore.currentServerId}:${projectStore.currentProject?.id || ''}`);
if (activeInlineFile.value) {
  inlineScope.value = { serverId: serverStore.currentServerId, projectId: projectStore.currentProject?.id || '' };
}
const mdMode = ref<'preview' | 'edit'>(props.initialPreviewMode ?? 'preview');
const savingInlineFile = ref(false);
const saveFlash = ref(false);
const inlineStatusText = ref('');

const gutterRef = ref<HTMLElement | null>(null);
const codeInputRef = ref<HTMLTextAreaElement | null>(null);
const quickUploadFilesInputRef = ref<HTMLInputElement | null>(null);
const quickUploadFolderInputRef = ref<HTMLInputElement | null>(null);
const quickUploadTargetDir = ref<string>('');
const quickTreeNotice = ref<string>('');
let quickTreeNoticeTimer: ReturnType<typeof setTimeout> | null = null;

function showQuickTreeNotice(msg: string) {
  quickTreeNotice.value = msg;
  if (quickTreeNoticeTimer) clearTimeout(quickTreeNoticeTimer);
  quickTreeNoticeTimer = setTimeout(() => {
    quickTreeNotice.value = '';
  }, 2600);
}

function triggerQuickUploadFiles(targetRel = '') {
  quickUploadTargetDir.value = targetRel;
  quickUploadFilesInputRef.value?.click();
}

function triggerQuickUploadFolder(targetRel = '') {
  quickUploadTargetDir.value = targetRel;
  quickUploadFolderInputRef.value?.click();
}

async function uploadFilesToQuickTree(files: FileList | File[], targetRel = quickUploadTargetDir.value) {
  if (!files || files.length === 0) return;
  try {
    const serverId = serverStore.currentServerId;
    const projectId = projectStore.currentProject?.id || '';
    const formData = new FormData();
    const fileArr = Array.from(files);
    fileArr.forEach((file) => {
      const relPath = (file as any).webkitRelativePath || file.name;
      formData.append('files', file, encodeURIComponent(relPath));
    });
    const query = new URLSearchParams({
      serverId,
      projectId,
      targetDir: targetRel || '',
    });
    const res = await fetch(apiUrl(`/api/fs/upload?${query.toString()}`), {
      method: 'POST',
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Tải lên thất bại');
    if (targetRel) {
      expandedPaths.value = { ...expandedPaths.value, [targetRel]: true };
      const children = await fetchDirectoryEntries(targetRel);
      childrenByPath.value = { ...childrenByPath.value, [targetRel]: children };
    }
    await loadRootTree();
    await fileStore.fetchFiles(fileStore.currentRel);
    showQuickTreeNotice(`Đã tải lên ${data.count || fileArr.length} tệp`);
  } catch (err: any) {
    showQuickTreeNotice(err?.message || 'Lỗi tải lên tệp');
  }
}

async function onQuickUploadFilesSelected(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    await uploadFilesToQuickTree(input.files, quickUploadTargetDir.value);
    input.value = '';
  }
}

async function onQuickUploadFolderSelected(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    await uploadFilesToQuickTree(input.files, quickUploadTargetDir.value);
    input.value = '';
  }
}

function downloadQuickPath(relPath: string, downloadName?: string) {
  const serverId = serverStore.currentServerId;
  const projectId = projectStore.currentProject?.id || '';
  const query = new URLSearchParams({
    serverId,
    projectId,
    path: relPath || '',
  });
  const url = apiUrl(`/api/fs/download?${query.toString()}`);
  if (typeof document !== 'undefined') {
    const a = document.createElement('a');
    a.href = url;
    if (downloadName) a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  showQuickTreeNotice(`Đang tải xuống ${downloadName || relPath || 'workspace'}`);
}

const selectedGitFile = ref<string>('');
const commitMessage = ref('');
const gitToast = ref('');
let gitToastTimer: ReturnType<typeof setTimeout> | null = null;

const isResizing = ref(false);
const userHasResized = ref(false);
const isFullscreen = ref(false);

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value;
  if (typeof window !== 'undefined') {
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  }
}

const currentRootPath = computed(() => {
  return projectStore.currentProject?.rootPath || '';
});

const effectiveMaxWidth = computed(() => {
  if (typeof window === 'undefined') return props.maxWidth;
  return Math.max(props.minWidth, Math.min(props.maxWidth, Math.floor(window.innerWidth * 0.58)));
});

const subbarPathText = computed(() => {
  if (props.mode === 'git') {
    return `${gitStore.branch || 'main'} • ${gitStore.files.length} ${t('quickPanel.changedFiles')}`;
  }
  if (activeInlineFile.value) {
    return activeInlineFile.value.path;
  }
  return currentRootPath.value || '~';
});

interface FlattenedTreeNode {
  entry: FileEntry;
  depth: number;
}

function sortEntries(entries: FileEntry[]): FileEntry[] {
  return [...entries].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

const visibleTreeNodes = computed<FlattenedTreeNode[]>(() => {
  const result: FlattenedTreeNode[] = [];
  const walk = (entries: FileEntry[], depth: number) => {
    for (const entry of sortEntries(entries)) {
      result.push({ entry, depth });
      if (entry.isDirectory && expandedPaths.value[entry.relPath]) {
        const children = childrenByPath.value[entry.relPath] || [];
        walk(children, depth + 1);
      }
    }
  };
  walk(rootEntries.value, 0);
  return result;
});

const lineCount = computed(() => {
  if (!activeInlineFile.value) return 1;
  return Math.max(1, activeInlineFile.value.content.split('\n').length);
});

const lineNumbersText = computed(() => {
  const count = lineCount.value;
  const lines: string[] = [];
  for (let i = 1; i <= count; i++) lines.push(String(i));
  return lines.join('\n');
});

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
function safeHref(value: string): string {
  const href = value.trim();
  return /^(?:https?:|mailto:|tel:|\/|#)/i.test(href) ? escapeHtml(href) : '#';
}
const markdownRenderer = new Renderer();
markdownRenderer.html = ({ text }: { text: string }) => escapeHtml(text);
markdownRenderer.link = function ({ href, title, tokens }: { href: string; title?: string | null; tokens: any[] }) {
  return `<a href="${safeHref(href)}"${title ? ` title="${escapeHtml(title)}"` : ''}>${this.parser.parseInline(tokens)}</a>`;
};
markdownRenderer.image = ({ href, title, text }: { href: string; title?: string | null; text: string }) =>
  `<img src="${safeHref(href)}" alt="${escapeHtml(text)}"${title ? ` title="${escapeHtml(title)}"` : ''}>`;
const renderedMarkdownHtml = computed(() => {
  if (!activeInlineFile.value) return '';
  const parsed = marked.parse(activeInlineFile.value.content, {
    gfm: true,
    breaks: true,
    renderer: markdownRenderer,
  });
  return typeof parsed === 'string' ? parsed : '';
});

function isMarkdownFile(name: string): boolean {
  return /\.(md|markdown)$/i.test(name || '');
}

function isHtmlFile(name: string): boolean {
  return /\.(html|htm)$/i.test(name || '');
}

function detectLanguageLabel(name: string): string {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const map: Record<string, string> = {
    ts: 'TYPESCRIPT',
    tsx: 'TSX',
    js: 'JAVASCRIPT',
    mjs: 'JAVASCRIPT',
    vue: 'VUE SFC',
    json: 'JSON',
    md: 'MARKDOWN',
    css: 'CSS',
    html: 'HTML',
    py: 'PYTHON',
    sh: 'SHELL',
    yml: 'YAML',
    yaml: 'YAML',
  };
  return map[ext] || (ext ? ext.toUpperCase() : 'TEXT');
}

function getFileIconByName(name: string): string {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (ext === 'vue') return 'ri-vuejs-line';
  if (ext === 'ts' || ext === 'tsx' || ext === 'js' || ext === 'mjs') return 'ri-javascript-line';
  if (ext === 'json') return 'ri-braces-line';
  if (ext === 'md' || ext === 'markdown') return 'ri-markdown-line';
  if (ext === 'css' || ext === 'scss') return 'ri-css3-line';
  if (ext === 'html') return 'ri-html5-line';
  return 'ri-file-code-line';
}

function getEntryIcon(entry: FileEntry): string {
  if (entry.isDirectory) {
    return expandedPaths.value[entry.relPath] ? 'ri-folder-open-line' : 'ri-folder-2-line';
  }
  return getFileIconByName(entry.name);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function fetchDirectoryEntries(dirPath: string): Promise<FileEntry[]> {
  const serverId = serverStore.currentServerId;
  const query = new URLSearchParams();
  if (dirPath) query.set('path', dirPath);
  query.set('serverId', serverId);
  query.set('projectId', projectStore.currentProject?.id || '');
  const res = await fetch(apiUrl(`/api/fs?${query.toString()}`));
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load directory');
  return Array.isArray(data.entries) ? data.entries : [];
}

async function loadRootTree() {
  const generation = ++treeGeneration;
  const scope = scopeKey.value;
  loadingTree.value = true;
  try {
    const entries = await fetchDirectoryEntries('');
    if (generation === treeGeneration && scope === scopeKey.value) rootEntries.value = entries;
  } catch {
    // Keep existing entries on transient error
  } finally {
    if (generation === treeGeneration) loadingTree.value = false;
  }
}

async function onTreeNodeClick(entry: FileEntry) {
  if (entry.isDirectory) {
    const nextExpanded = !expandedPaths.value[entry.relPath];
    expandedPaths.value = { ...expandedPaths.value, [entry.relPath]: nextExpanded };
    if (nextExpanded && !childrenByPath.value[entry.relPath]) {
      try {
        const children = await fetchDirectoryEntries(entry.relPath);
        childrenByPath.value = { ...childrenByPath.value, [entry.relPath]: children };
      } catch {
        // Ignore directory fetch error
      }
    }
    return;
  }
  await openInlineFile(entry.relPath, entry.name);
}

const isDiscardConfirmOpen = ref(false);
let pendingDiscardResolve: ((confirmed: boolean) => void) | null = null;

function requestDiscardInlineFile(): Promise<boolean> {
  isDiscardConfirmOpen.value = true;
  return new Promise<boolean>((resolve) => {
    pendingDiscardResolve = resolve;
  });
}

function confirmDiscardInlineFile() {
  const resolve = pendingDiscardResolve;
  pendingDiscardResolve = null;
  isDiscardConfirmOpen.value = false;
  resolve?.(true);
}

function cancelDiscardInlineFile() {
  const resolve = pendingDiscardResolve;
  pendingDiscardResolve = null;
  isDiscardConfirmOpen.value = false;
  resolve?.(false);
}

async function openInlineFile(filePath: string, fileName?: string) {
  if (activeInlineFile.value?.dirty && !(await requestDiscardInlineFile())) return;
  const generation = ++openGeneration;
  const scope = scopeKey.value;
  const resolvedName = fileName || filePath.split('/').pop() || filePath;
  try {
    const serverId = serverStore.currentServerId;
    const res = await fetch(
      apiUrl(`/api/fs/read?path=${encodeURIComponent(filePath)}&serverId=${encodeURIComponent(serverId)}&projectId=${encodeURIComponent(projectStore.currentProject?.id || '')}`)
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to read file');
    if (generation !== openGeneration || scope !== scopeKey.value) return;
    const content = typeof data.content === 'string' ? data.content : '';
    inlineScope.value = { serverId, projectId: projectStore.currentProject?.id || '' };
    activeInlineFile.value = {
      path: filePath,
      name: resolvedName,
      content,
      originalContent: content,
      dirty: false,
    };
    mdMode.value = 'preview';
    // Editing requires an explicit click for all text files, not just Markdown/HTML.
    inlineStatusText.value = '';

    // Auto-widen panel on desktop/tablet when opening a file if user hasn't manually resized
    if (
      typeof window !== 'undefined' &&
      window.innerWidth >= 800 &&
      !userHasResized.value &&
      props.panelWidth < 380
    ) {
      emit('update:panelWidth', Math.min(400, effectiveMaxWidth.value));
    }
  } catch (err: any) {
    inlineStatusText.value = err?.message || 'Error';
  }
}

function requestClosePanel() {
  // Closing only hides the panel; preserve drafts for reopening.
  isFullscreen.value = false;
  emit('close');
}

async function closeInlineFile() {
  if (activeInlineFile.value?.dirty && !(await requestDiscardInlineFile())) return;
  ++openGeneration;
  activeInlineFile.value = null;
  inlineScope.value = null;
  inlineStatusText.value = '';
}

function toggleInlineEditMode() {
  mdMode.value = mdMode.value === 'preview' ? 'edit' : 'preview';
  if (mdMode.value === 'edit') {
    requestAnimationFrame(() => codeInputRef.value?.focus());
  }
}

function onInlineCodeInput() {
  if (!activeInlineFile.value) return;
  activeInlineFile.value.dirty =
    activeInlineFile.value.content !== activeInlineFile.value.originalContent;
}

function syncGutterScroll() {
  if (!gutterRef.value || !codeInputRef.value) return;
  gutterRef.value.scrollTop = codeInputRef.value.scrollTop;
}

async function saveInlineFile() {
  if (!activeInlineFile.value || savingInlineFile.value) return;
  savingInlineFile.value = true;
  try {
    const scope = inlineScope.value;
    if (!scope) return;
    const file = activeInlineFile.value;
    const serverId = scope.serverId;
    const savedServerId = serverId;
    const savedProjectId = scope.projectId;
    const savedPath = file.path;
    const savedContent = file.content;
    const res = await fetch(apiUrl('/api/fs/save'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: savedPath,
        content: savedContent,
        serverId,
        projectId: savedProjectId,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save file');

    file.originalContent = savedContent;
    file.dirty = file.content !== savedContent;

    // Never overwrite an unsaved editor buffer. Only update the same clean file/scope.
    const editorFile = fileStore.activeFile;
    if (editorFile && !editorFile.isDirty && editorFile.relPath === savedPath &&
        savedServerId === serverStore.currentServerId && savedProjectId === projectStore.currentProject?.id &&
        editorFile.content === editorFile.originalContent) {
      editorFile.content = savedContent;
      editorFile.originalContent = savedContent;
    }

    const nowStr = new Date().toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    inlineStatusText.value = `${t('quickPanel.savedAt')} ${nowStr} • ${lineCount.value} ${t('quickPanel.linesUnit')}`;
    saveFlash.value = true;
    setTimeout(() => {
      saveFlash.value = false;
    }, 1200);
  } catch (err: any) {
    inlineStatusText.value = err?.message || 'Save failed';
  } finally {
    savingInlineFile.value = false;
  }
}

function onInlineEditorKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    saveInlineFile();
    return;
  }
  if (e.key === 'Tab' && activeInlineFile.value && codeInputRef.value) {
    e.preventDefault();
    const el = codeInputRef.value;
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const val = activeInlineFile.value.content;
    activeInlineFile.value.content = `${val.slice(0, start)}  ${val.slice(end)}`;
    activeInlineFile.value.dirty =
      activeInlineFile.value.content !== activeInlineFile.value.originalContent;
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + 2;
    });
  }
}

function clampWidth(width: number): number {
  return Math.round(Math.max(props.minWidth, Math.min(effectiveMaxWidth.value, width)));
}

function onResizePointerDown(e: PointerEvent) {
  e.preventDefault();
  isResizing.value = true;
  userHasResized.value = true;
  const target = e.currentTarget as HTMLElement | null;
  if (target?.setPointerCapture) {
    try {
      target.setPointerCapture(e.pointerId);
    } catch {}
  }

  const onMove = (moveEvent: PointerEvent) => {
    if (!isResizing.value) return;
    const nextWidth = clampWidth(window.innerWidth - moveEvent.clientX);
    emit('update:panelWidth', nextWidth);
  };

  const onUp = () => {
    isResizing.value = false;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
}

function onResizeKeyDown(e: KeyboardEvent) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  e.preventDefault();
  userHasResized.value = true;
  const delta = e.key === 'ArrowLeft' ? 24 : -24;
  emit('update:panelWidth', clampWidth(props.panelWidth + delta));
}

function showGitFeedback(msg: string) {
  gitToast.value = msg;
  if (gitToastTimer) clearTimeout(gitToastTimer);
  gitToastTimer = setTimeout(() => {
    gitToast.value = '';
  }, 2400);
}

function getGitStatusClass(status: string): string {
  const s = (status || '').toUpperCase();
  if (s.includes('A') || s.includes('?')) return 'added';
  if (s.includes('D')) return 'deleted';
  return 'modified';
}

async function toggleFileStage(file: GitChangedFile) {
  try {
    if (file.staged) {
      await gitStore.unstageFile(file.path);
      showGitFeedback(`${t('quickPanel.unstage')}: ${file.path}`);
    } else {
      await gitStore.stageFile(file.path);
      showGitFeedback(`${t('quickPanel.stage')}: ${file.path}`);
    }
  } catch (err: any) {
    showGitFeedback(err?.message || 'Git action failed');
  }
}

async function handleStage() {
  const target =
    selectedGitFile.value ||
    gitStore.files.find((f) => !f.staged)?.path ||
    gitStore.files[0]?.path;
  if (!target) return;
  try {
    await gitStore.stageFile(target);
    showGitFeedback(`${t('quickPanel.stage')}: ${target}`);
  } catch (err: any) { showGitFeedback(err?.message || 'Git action failed'); }
}

async function handleUnstage() {
  const target =
    selectedGitFile.value ||
    gitStore.files.find((f) => f.staged)?.path ||
    gitStore.files[0]?.path;
  if (!target) return;
  try {
    await gitStore.unstageFile(target);
    showGitFeedback(`${t('quickPanel.unstage')}: ${target}`);
  } catch (err: any) { showGitFeedback(err?.message || 'Git action failed'); }
}

async function handleCommit() {
  const msg = commitMessage.value.trim();
  if (!msg) return;
  try {
    await gitStore.commit(msg);
    commitMessage.value = '';
    showGitFeedback(t('git.commitSuccess'));
  } catch (err: any) {
    showGitFeedback(err?.message || gitStore.error || 'Commit failed');
  }
}

async function handlePull() {
  try {
    await gitStore.pull();
    showGitFeedback(t('git.pullSuccess'));
  } catch (err: any) { showGitFeedback(err?.message || 'Pull failed'); }
}

async function handlePush() {
  try {
    await gitStore.push();
    showGitFeedback(t('git.pushSuccess'));
  } catch (err: any) { showGitFeedback(err?.message || 'Push failed'); }
}

async function handleRefresh() {
  if (props.mode === 'git') {
    await Promise.all([gitStore.fetchRepos(), gitStore.fetchStatus()]);
  } else {
    childrenByPath.value = {};
    await loadRootTree();
  }
}

watch(
  () => [props.isOpen, props.mode, currentRootPath.value, serverStore.currentServerId],
  ([open, currentMode]) => {
    if (!open) return;
    if (currentMode === 'git') {
      gitStore.fetchRepos();
      gitStore.fetchStatus();
    } else if (rootEntries.value.length === 0) {
      loadRootTree();
    }
  }
);

watch(
  scopeKey,
  () => {
    ++treeGeneration;
    ++openGeneration;
    rootEntries.value = [];
    childrenByPath.value = {};
    expandedPaths.value = {};
    gitStore.selectedRepoPath = '.';
    // Preserve unsaved content with its original save scope across project/server switches.
    if (!activeInlineFile.value?.dirty) {
      activeInlineFile.value = null;
      inlineScope.value = null;
    }
    if (props.isOpen && props.mode === 'files') loadRootTree();
    else if (props.isOpen && props.mode === 'git') {
      gitStore.fetchRepos();
      gitStore.fetchStatus();
    }
  }
);

onMounted(() => {
  if (props.isOpen) {
    if (props.mode === 'git') {
      gitStore.fetchRepos();
      gitStore.fetchStatus();
    } else if (rootEntries.value.length === 0) {
      loadRootTree();
    }
  }
});

onBeforeUnmount(() => {
  if (gitToastTimer) clearTimeout(gitToastTimer);
});
</script>

<style scoped>
.quick-tree-backdrop {
  display: none;
  position: fixed;
  inset: calc(var(--header-h, 64px) + env(safe-area-inset-top, 0px)) 0 calc(var(--dock-h, 42px) + env(safe-area-inset-bottom, 0px)) 0;
  background: rgba(22, 22, 22, 0.55);
  backdrop-filter: blur(2px);
  z-index: 84;
}
.quick-tree-backdrop.open {
  display: block;
}
@media (min-width: 800px) {
  .quick-tree-backdrop,
  .quick-tree-backdrop.open {
    display: none !important;
  }
}

.quick-tree-panel {
  position: fixed;
  top: calc(var(--header-h, 64px) + env(safe-area-inset-top, 0px));
  right: 0;
  bottom: calc(var(--dock-h, 42px) + env(safe-area-inset-bottom, 0px));
  width: var(--quick-panel-width, 320px);
  max-width: calc(100vw - 48px);
  background: #161616;
  border-left: 1px solid #323232;
  box-shadow: -12px 0 32px rgba(0, 0, 0, 0.45);
  z-index: 85;
  display: flex;
  flex-direction: column;
  transform: translateX(100%);
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: none;
}
@media (min-width: 800px) {
  .quick-tree-panel {
    box-shadow: none;
    transition: none;
  }
}
.quick-tree-panel.open {
  transform: translateX(0);
  pointer-events: auto;
}
.quick-tree-panel.resizing {
  transition: none !important;
  user-select: none;
}
.quick-tree-panel.fullscreen {
  left: 0;
  right: 0;
  width: 100% !important;
  max-width: 100vw !important;
  border-left: none;
  z-index: 90;
}
.quick-tree-panel.fullscreen .quick-tree-resize {
  display: none;
}

.quick-tree-resize {
  position: absolute;
  top: 0;
  left: -5px;
  bottom: 0;
  width: 10px;
  cursor: col-resize;
  z-index: 5;
  touch-action: none;
  display: flex;
  align-items: center;
  justify-content: center;
}
.quick-tree-resize::after {
  content: '';
  width: 2px;
  height: 36px;
  border-radius: 999px;
  background: rgba(64, 64, 64, 0.28);
  transition: background 0.15s, height 0.15s, box-shadow 0.15s;
}
.quick-tree-resize:hover::after,
.quick-tree-resize:focus-visible::after,
.quick-tree-panel.resizing .quick-tree-resize::after {
  height: 64px;
  background: var(--brand, #404040);
  box-shadow: 0 0 10px rgba(64, 64, 64, 0.55);
}

.quick-tree-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  background: rgba(255, 255, 255, 0.02);
  gap: 8px;
}
.quick-tree-title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary, #eeeeee);
  min-width: 0;
}
.quick-tree-title > i {
  color: var(--brand, #10b981);
  font-size: 15px;
}
.quick-panel-tabs {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: 7px;
  background: rgba(23, 23, 23, 0.75);
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  margin-left: 4px;
}
.quick-panel-tab {
  width: 24px;
  height: 22px;
  border-radius: 5px;
  border: none;
  background: transparent;
  color: var(--text-secondary, #a1a1a1);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 13px;
}
.quick-panel-tab.active {
  background: rgba(64, 64, 64, 0.16);
  color: var(--brand, #989898);
}

.quick-tree-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
.quick-tree-btn {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-secondary, #a1a1a1);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.quick-tree-btn:hover {
  color: var(--text-primary, #eeeeee);
  background: rgba(255, 255, 255, 0.06);
}

.quick-tree-subbar {
  padding: 6px 12px;
  font-size: 11px;
  font-family: var(--font-mono, monospace);
  color: var(--text-muted, #989898);
  border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.quick-panel-path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.quick-git-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  color: var(--brand, #10b981);
  background: rgba(16, 185, 129, 0.14);
  flex-shrink: 0;
}

.quick-pane {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.quick-tree-file-toolbar {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 10px;
  border-bottom: 1px solid #2a2a2a;
  background: #1a1a1a;
  flex-wrap: wrap;
}

.quick-tree-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 8px;
  border-radius: 5px;
  border: 1px solid #353535;
  background: #232323;
  color: #cfcfcf;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.quick-tree-action-btn:hover {
  background: #2e2e2e;
  color: #ffffff;
  border-color: #4a4a4a;
}

.quick-tree-notice {
  padding: 5px 10px;
  font-size: 11px;
  color: #d4d4d4;
  background: #1f1f1f;
  border-bottom: 1px solid #2e2e2e;
}

.quick-tree-row-actions {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-left: auto;
  opacity: 0.72;
  flex-shrink: 0;
}

.quick-tree-node:hover .quick-tree-row-actions {
  opacity: 1;
}

.quick-tree-row-btn {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid transparent;
  background: transparent;
  color: #a3a3a3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  cursor: pointer;
}

.quick-tree-row-btn:hover {
  background: #2d2d2d;
  color: #ffffff;
  border-color: #424242;
}

.quick-tree-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.quick-tree-node {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-secondary, #a1a1a1);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.quick-tree-node:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary, #eeeeee);
}
.quick-tree-node.active {
  background: rgba(64, 64, 64, 0.14);
  color: var(--text-primary, #eeeeee);
  border-color: rgba(125, 125, 125, 0.32);
}
.quick-tree-node.is-dir {
  color: var(--text-primary, #eeeeee);
  font-weight: 500;
}
.quick-tree-node[data-node-type="dir"] > i:nth-of-type(2) { color: #f59e0b; }
.quick-tree-node[data-node-type="file"] > i:nth-of-type(1) { color: #7dd3fc; }
.quick-tree-node[data-node-type="file"] > i.ri-markdown-line { color: #a78bfa; }
.quick-tree-node[data-node-type="file"] > i.ri-html5-line { color: #f97316; }
.quick-tree-node[data-node-type="file"] > i.ri-javascript-line { color: #facc15; }
.quick-tree-node .tree-caret {
  font-size: 13px;
  color: var(--text-muted, #989898);
  width: 14px;
  text-align: center;
  flex-shrink: 0;
}
.quick-tree-node .tree-caret-spacer {
  width: 14px;
  flex-shrink: 0;
}
.quick-tree-node .node-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.quick-tree-node .node-meta {
  font-size: 10px;
  font-family: var(--font-mono, monospace);
  color: var(--text-muted, #989898);
}

/* Inline File Workbench */
.quick-file-workbench {
  display: none;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  background: rgba(22, 22, 22, 0.96);
}
.quick-file-workbench.open {
  display: flex;
}
.quick-file-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  background: rgba(23, 23, 23, 0.85);
}
.quick-file-back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 8px;
  border-radius: 6px;
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-secondary, #a1a1a1);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
}
.quick-file-back:hover {
  color: var(--text-primary, #eeeeee);
  background: rgba(255, 255, 255, 0.08);
}
.quick-file-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}
.quick-file-meta i {
  color: var(--brand, #10b981);
  font-size: 14px;
  flex-shrink: 0;
}
.quick-file-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary, #eeeeee);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.quick-file-dirty {
  display: none;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 999px;
  color: #a6a6a6;
  background: rgba(64, 64, 64, 0.15);
  border: 1px solid rgba(125, 125, 125, 0.35);
  flex-shrink: 0;
}
.quick-file-dirty.show {
  display: inline-flex;
}
.quick-preview-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 26px;
  border-radius: 6px;
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.1));
  background: rgba(23, 23, 23, 0.85);
  color: var(--text-secondary, #a1a1a1);
  font-size: 14px;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.quick-preview-btn:hover,
.quick-preview-btn.active {
  background: rgba(64, 64, 64, 0.16);
  border-color: rgba(125, 125, 125, 0.4);
  color: var(--brand, #989898);
}
.quick-file-save {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 9px;
  border-radius: 6px;
  border: 1px solid rgba(125, 125, 125, 0.4);
  background: rgba(64, 64, 64, 0.16);
  color: var(--brand, #989898);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
}
.quick-file-save:hover {
  background: rgba(64, 64, 64, 0.25);
}
.quick-file-save.saved {
  background: rgba(64, 64, 64, 0.28);
  color: #eeeeee;
}

.quick-file-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
}
.quick-code-preview {
  flex: 1;
  min-height: 0;
  overflow: auto;
  color: #e7e7e7;
  font: 12px/1.55 var(--font-mono, monospace);
  background: #161616;
  padding: 10px 0;
  white-space: pre;
  user-select: text;
}
.quick-code-preview-line { display: flex; min-width: max-content; }
.quick-code-preview-number {
  position: sticky;
  left: 0;
  flex: none;
  box-sizing: border-box;
  width: 38px;
  padding: 0 6px 0 4px;
  text-align: right;
  background: #161616;
  color: #989898;
  border-right: 1px solid #323232;
  user-select: none;
}
.quick-code-preview-text { padding: 0 12px; }
.quick-code-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}
.quick-code-gutter {
  padding: 10px 6px 10px 8px;
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  line-height: 1.55;
  color: var(--text-muted, #989898);
  background: rgba(23, 23, 23, 0.65);
  border-right: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  text-align: right;
  user-select: none;
  min-width: 34px;
  overflow: hidden;
  white-space: pre;
}
.quick-code-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  resize: none;
  border: none;
  outline: none;
  padding: 10px;
  background: transparent;
  color: var(--text-primary, #eeeeee);
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  line-height: 1.55;
  tab-size: 2;
  white-space: pre;
  overflow: auto;
}
.quick-md-preview {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 12px 14px;
  color: var(--text-primary, #eeeeee);
  font-size: 12.5px;
  line-height: 1.6;
}
.quick-md-preview :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 8px 0;
  font-size: 12px;
}
.quick-md-preview :deep(th),
.quick-md-preview :deep(td) {
  padding: 6px 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  text-align: left;
  vertical-align: top;
}
.quick-md-preview :deep(th) {
  background: rgba(255, 255, 255, 0.06);
  font-weight: 600;
}
.quick-html-preview {
  flex: 1;
  min-height: 0;
  width: 100%;
  height: 100%;
  border: none;
  background: #ffffff;
  display: block;
}
.quick-file-foot {
  padding: 5px 10px;
  border-top: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  background: rgba(23, 23, 23, 0.75);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 10.5px;
  font-family: var(--font-mono, monospace);
  color: var(--text-muted, #989898);
}

/* Git Quick Pane */
.quick-git-summary {
  padding: 8px 10px;
  border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: 11px;
}
.quick-git-branch {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: var(--font-mono, monospace);
  font-weight: 600;
  color: var(--text-primary, #eeeeee);
}
.quick-git-branch i {
  color: var(--brand, #10b981);
}
.quick-git-count {
  color: var(--text-secondary, #a1a1a1);
}

.quick-git-repo-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  background: rgba(255, 255, 255, 0.015);
}
.quick-git-repo-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  flex-wrap: wrap;
}
.quick-git-repo-title {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-primary, #eeeeee);
}
.quick-git-repo-badge {
  font-family: var(--font-mono, monospace);
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: #d4d4d4;
}
.quick-git-repo-filters {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.quick-git-filter-btn {
  height: 20px;
  padding: 0 6px;
  border-radius: 5px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: transparent;
  color: #989898;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
}
.quick-git-filter-btn.active {
  background: rgba(255, 255, 255, 0.1);
  color: #f5f5f5;
  border-color: rgba(255, 255, 255, 0.22);
}
.quick-git-depth-tag {
  font-family: var(--font-mono, monospace);
  font-size: 9.5px;
  color: #989898;
  padding: 1px 5px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.quick-git-repo-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 156px;
  overflow-y: auto;
}
.quick-git-repo-empty {
  padding: 8px;
  text-align: center;
  font-size: 11px;
  color: #989898;
}
.quick-git-repo-item {
  width: 100%;
  text-align: left;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
  color: #d4d4d4;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.quick-git-repo-item:hover {
  background: rgba(255, 255, 255, 0.05);
}
.quick-git-repo-item.active {
  background: rgba(255, 255, 255, 0.09);
  border-color: rgba(255, 255, 255, 0.24);
  color: #ffffff;
}
.quick-git-repo-row-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.quick-git-repo-name {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  font-weight: 700;
}
.quick-git-repo-name > span:first-of-type {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.quick-git-repo-depth {
  font-size: 9.5px;
  font-weight: 600;
  padding: 0 4px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  color: #a3a3a3;
  flex-shrink: 0;
}
.quick-git-repo-change-pill {
  font-family: var(--font-mono, monospace);
  font-size: 9.5px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 999px;
  flex-shrink: 0;
}
.quick-git-repo-change-pill.dirty.status-indicator {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.14);
}
.quick-git-repo-change-pill.clean {
  color: #989898;
  background: rgba(255, 255, 255, 0.05);
}
.quick-git-repo-row-sub {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-family: var(--font-mono, monospace);
  font-size: 10px;
  color: #989898;
}

.quick-git-files {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.quick-git-item {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: rgba(255, 255, 255, 0.02);
  font-size: 11.5px;
  cursor: pointer;
}
.quick-git-item:hover {
  background: rgba(255, 255, 255, 0.05);
}
.quick-git-item.selected {
  background: rgba(64, 64, 64, 0.12);
  border-color: rgba(125, 125, 125, 0.32);
}
.quick-git-check {
  border: none;
  background: transparent;
  color: var(--text-muted, #989898);
  padding: 0;
  cursor: pointer;
  font-size: 14px;
  display: inline-flex;
}
.quick-git-check.checked {
  color: var(--brand, #989898);
}
.quick-git-file {
  flex: 1;
  font-family: var(--font-mono, monospace);
  color: var(--text-primary, #eeeeee);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.quick-git-status {
  font-family: var(--font-mono, monospace);
  font-size: 10px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
}
.quick-git-status.modified {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.14);
}
.quick-git-status.added {
  color: #10b981;
  background: rgba(16, 185, 129, 0.14);
}
.quick-git-status.deleted {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.14);
}

.quick-git-commit {
  padding: 8px;
  border-top: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  background: rgba(255, 255, 255, 0.02);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.quick-git-input {
  width: 100%;
  min-height: 52px;
  resize: none;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  background: rgba(23, 23, 23, 0.75);
  color: var(--text-primary, #eeeeee);
  font-size: 11.5px;
  font-family: inherit;
}
.quick-git-actions,
.quick-git-sync {
  display: grid;
  gap: 5px;
}
.quick-git-actions {
  grid-template-columns: repeat(3, 1fr);
}
.quick-git-sync {
  grid-template-columns: repeat(2, 1fr);
}
.quick-git-btn {
  height: 28px;
  border-radius: 6px;
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-primary, #eeeeee);
  font-size: 11px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
}
.quick-git-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
}
.quick-git-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.quick-git-btn.primary {
  background: rgba(64, 64, 64, 0.18);
  border-color: rgba(125, 125, 125, 0.4);
  color: var(--brand, #989898);
  font-weight: 600;
}
.quick-git-toast {
  font-size: 11px;
  color: var(--brand, #989898);
  min-height: 15px;
  opacity: 0;
  transition: opacity 0.15s;
}
.quick-git-toast.show {
  opacity: 1;
}

.quick-empty-state {
  padding: 24px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--text-muted, #989898);
  font-size: 12px;
}
.quick-empty-state i {
  font-size: 20px;
}
</style>
